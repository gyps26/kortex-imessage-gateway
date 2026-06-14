import { Worker } from 'bullmq';
import { WaSP, RedisStore, EventType } from 'wasp-protocol';
import { connectToDatabase } from '../lib/db/mongoose';
import { Message } from '../models/Message';
import { Profile } from '../models/Profile';
import { injectInbound, updateMessageStatus } from '../lib/ghl/messages';
import { getRedisConnection } from '../lib/queue/redis';
import {
  WASP_SESSION_CREATE_CHANNEL,
  WASP_SESSION_DESTROY_CHANNEL,
  touchWorkerHeartbeat,
  type SessionCreateEvent,
  type SessionDestroyEvent,
} from '../lib/whatsapp/session-events';

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

async function createWaspSession(wasp: WaSP, sessionId: string) {
  const existing = await wasp.getSession(sessionId);
  if (existing) return;
  try {
    await wasp.createSession(sessionId, 'BAILEYS' as Parameters<WaSP['createSession']>[1]);
    console.log(`WhatsApp session created: ${sessionId}`);
  } catch (err) {
    console.error(`Failed to create session ${sessionId}:`, err);
  }
}

async function destroyWaspSession(wasp: WaSP, sessionId: string) {
  try {
    if (typeof (wasp as { destroySession?: (id: string) => Promise<void> }).destroySession === 'function') {
      await (wasp as { destroySession: (id: string) => Promise<void> }).destroySession(sessionId);
    }
    console.log(`WhatsApp session destroyed: ${sessionId}`);
  } catch (err) {
    console.error(`Failed to destroy session ${sessionId}:`, err);
  }
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

  const { default: pino } = await import('pino');
  const logger = pino({ level: process.env.WASP_DEBUG === 'true' ? 'debug' : 'warn' });

  const wasp = new WaSP({
    store: new RedisStore(parseRedisConfig(urlStr)),
    queue: { minDelay: 20000, maxDelay: 45000, maxConcurrent: 1 },
    debug: process.env.WASP_DEBUG === 'true',
    logger,
  });

  wasp.on(EventType.SESSION_QR, async (event) => {
    const sessionId = event.sessionId;
    const qr = (event.data as { qr?: string })?.qr;
    if (!sessionId || !qr) return;

    await Profile.updateOne({ sessionId, channel: 'WHATSAPP' }, { $set: { qrCode: qr, lastPing: new Date() } });
    console.log(`QR updated for session ${sessionId}`);
  });

  wasp.on(EventType.SESSION_CONNECTED, async (event) => {
    const sessionId = event.sessionId;
    const phone = (event.data as { phone?: string })?.phone;

    await Profile.updateOne(
      { sessionId, channel: 'WHATSAPP' },
      {
        $set: { status: 'active', whatsappPhone: phone, lastPing: new Date() },
        $unset: { qrCode: 1 },
      }
    );
    console.log(`WhatsApp connected: session ${sessionId} phone ${phone}`);
  });

  wasp.on(EventType.SESSION_DISCONNECTED, async (event) => {
    await Profile.updateOne(
      { sessionId: event.sessionId, channel: 'WHATSAPP' },
      {
        $set: { status: 'inactive', lastPing: new Date() },
        $unset: { qrCode: 1 },
      }
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
      await createWaspSession(wasp, connector.sessionId);
    }
  }

  setInterval(async () => {
    const pending = await Profile.find({
      channel: 'WHATSAPP',
      status: 'inactive',
      sessionId: { $exists: true },
      $or: [{ qrCode: { $exists: false } }, { qrCode: null }],
    });
    for (const connector of pending) {
      if (connector.sessionId) {
        const session = await wasp.getSession(connector.sessionId);
        if (!session) {
          await createWaspSession(wasp, connector.sessionId);
        }
      }
    }
  }, 30000);

  const connection = getRedisConnection();
  if (!connection) {
    console.error('Redis connection unavailable');
    process.exit(1);
  }

  const subscriber = connection.duplicate();
  await subscriber.subscribe(WASP_SESSION_CREATE_CHANNEL, WASP_SESSION_DESTROY_CHANNEL);

  subscriber.on('message', async (channel, message) => {
    try {
      if (channel === WASP_SESSION_CREATE_CHANNEL) {
        const event = JSON.parse(message) as SessionCreateEvent;
        if (event.sessionId) {
          await createWaspSession(wasp, event.sessionId);
        }
      } else if (channel === WASP_SESSION_DESTROY_CHANNEL) {
        const event = JSON.parse(message) as SessionDestroyEvent;
        if (event.sessionId) {
          await destroyWaspSession(wasp, event.sessionId);
        }
      }
    } catch (err) {
      console.error('Session event handler error:', err);
    }
  });

  setInterval(() => {
    touchWorkerHeartbeat().catch((err) => console.error('Heartbeat error:', err));
  }, 30_000);
  await touchWorkerHeartbeat();

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

      const session = await wasp.getSession(profile.sessionId);
      if (!session) {
        await createWaspSession(wasp, profile.sessionId);
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
    { connection: connection as object, concurrency: 1 }
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
