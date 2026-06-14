import { Worker } from 'bullmq';
import { WaSP, RedisStore, EventType } from 'wasp-protocol';
import { connectToDatabase } from '../lib/db/mongoose';
import { Message } from '../models/Message';
import { Profile } from '../models/Profile';
import { injectInbound, updateMessageStatus } from '../lib/ghl/messages';
import { getRedisConnection } from '../lib/queue/redis';

const REDIS_URL = process.env.REDIS_URL;

function parseRedisConfig(urlStr: string) {
  const parsed = new URL(urlStr);
  return {
    host: parsed.hostname,
    port: parsed.port ? parseInt(parsed.port, 10) : 6379,
    password: parsed.password || undefined,
    db: parsed.pathname && parsed.pathname.length > 1 ? parseInt(parsed.pathname.slice(1), 10) : undefined,
    keyPrefix: 'wasp:',
  };
}

async function main() {
  if (!REDIS_URL) {
    console.error('REDIS_URL is required for WhatsApp worker');
    process.exit(1);
  }

  await connectToDatabase();

  let urlStr = REDIS_URL.includes('-u ') ? REDIS_URL.split('-u ')[1].trim() : REDIS_URL.trim();
  const isUpstash = urlStr.includes('upstash.io');
  const requireTls = REDIS_URL.includes('--tls') || isUpstash;
  if (requireTls && urlStr.startsWith('redis://')) {
    urlStr = urlStr.replace('redis://', 'rediss://');
  }

  const wasp = new WaSP({
    store: new RedisStore(parseRedisConfig(urlStr)),
    queue: { minDelay: 20000, maxDelay: 45000, maxConcurrent: 1 },
    debug: process.env.WASP_DEBUG === 'true',
  });

  wasp.on(EventType.SESSION_QR, async (event) => {
    const sessionId = event.sessionId;
    const qr = (event.data as { qr?: string })?.qr;
    if (!sessionId || !qr) return;

    await Profile.updateOne({ sessionId, channel: 'WHATSAPP' }, { qrCode: qr, lastPing: new Date() });
    console.log(`QR updated for session ${sessionId}`);
  });

  wasp.on(EventType.SESSION_CONNECTED, async (event) => {
    const sessionId = event.sessionId;
    const phone = (event.data as { phone?: string })?.phone;

    await Profile.updateOne(
      { sessionId, channel: 'WHATSAPP' },
      { status: 'active', whatsappPhone: phone, qrCode: undefined, lastPing: new Date() }
    );
    console.log(`WhatsApp connected: session ${sessionId} phone ${phone}`);
  });

  wasp.on(EventType.SESSION_DISCONNECTED, async (event) => {
    await Profile.updateOne(
      { sessionId: event.sessionId, channel: 'WHATSAPP' },
      { status: 'inactive', lastPing: new Date() }
    );
    console.log(`WhatsApp disconnected: session ${event.sessionId}`);
  });

  wasp.on(EventType.MESSAGE_RECEIVED, async (event) => {
    try {
      const sessionId = event.sessionId;
      const data = event.data as { from?: string; body?: string; id?: string };

      const profile = await Profile.findOne({ sessionId, channel: 'WHATSAPP' });
      if (!profile?.assignedLocationId) return;

      const phone = (data.from || '').replace(/@s\.whatsapp\.net$/, '');
      const body = data.body || '';

      if (!phone || !body) return;

      await Message.create({
        workerId: profile.workerId,
        deviceId: profile.workerId,
        locationId: profile.assignedLocationId,
        phone,
        body,
        channel: 'WHATSAPP',
        direction: 'inbound',
        status: 'delivered',
      });

      await injectInbound({
        locationId: profile.assignedLocationId,
        phone,
        message: body,
        conversationProviderId: profile.assignedLocationId,
      });
    } catch (err) {
      console.error('Failed to handle inbound WhatsApp message:', err);
    }
  });

  const connectors = await Profile.find({ channel: 'WHATSAPP', sessionId: { $exists: true } });
  for (const connector of connectors) {
    if (connector.sessionId) {
      try {
        await wasp.createSession(connector.sessionId);
        console.log(`Restored WhatsApp session ${connector.sessionId}`);
      } catch (err) {
        console.error(`Failed to restore session ${connector.sessionId}:`, err);
      }
    }
  }

  setInterval(async () => {
    const pending = await Profile.find({
      channel: 'WHATSAPP',
      status: 'inactive',
      sessionId: { $exists: true },
      qrCode: { $exists: false },
    });
    for (const connector of pending) {
      if (connector.sessionId && !wasp.getSession(connector.sessionId)) {
        try {
          await wasp.createSession(connector.sessionId);
        } catch {
          // session may already exist
        }
      }
    }
  }, 30000);

  const connection = getRedisConnection();
  if (!connection) {
    console.error('Redis connection unavailable');
    process.exit(1);
  }

  const worker = new Worker(
    'whatsappOutbound',
    async (job) => {
      const { messageId } = job.data as { messageId: string };
      const message = await Message.findById(messageId);
      if (!message) return;

      const profile = await Profile.findOne({ workerId: message.workerId, channel: 'WHATSAPP' });
      if (!profile?.sessionId) {
        throw new Error('WhatsApp connector not found');
      }

      if (!wasp.getSession(profile.sessionId)) {
        await wasp.createSession(profile.sessionId);
      }

      await wasp.sendMessage(profile.sessionId, message.phone, message.body);
      message.status = 'sent';
      await message.save();

      profile.lastPing = new Date();
      await profile.save();

      if (message.ghlMessageId && message.locationId) {
        try {
          await updateMessageStatus({
            locationId: message.locationId,
            ghlMessageId: message.ghlMessageId,
            status: 'sent',
          });
        } catch (err) {
          console.error('Failed to sync WhatsApp status to GHL:', err);
        }
      }
    },
    { connection: connection as any, concurrency: 1 }
  );

  worker.on('failed', (job, err) => {
    console.error(`WhatsApp job ${job?.id} failed:`, err);
  });

  console.log('WhatsApp worker started');
}

main().catch((err) => {
  console.error('WhatsApp worker fatal error:', err);
  process.exit(1);
});
