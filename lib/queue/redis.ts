import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { connectToDatabase } from '../db/mongoose';
import { Message } from '../../models/Message';
import { Profile } from '../../models/Profile';
import { processOutboundJob, OUTBOUND_JOB_NAME } from '../routing/channelRouter';

const REDIS_URL = process.env.REDIS_URL;

let connection: IORedis | null = null;
if (REDIS_URL) {
  try {
    let urlStr = REDIS_URL.includes('-u ') ? REDIS_URL.split('-u ')[1].trim() : REDIS_URL.trim();
    const isUpstash = urlStr.includes('upstash.io');
    const requireTls = REDIS_URL.includes('--tls') || isUpstash;
    if (requireTls && urlStr.startsWith('redis://')) {
      urlStr = urlStr.replace('redis://', 'rediss://');
    }
    connection = new IORedis(urlStr, {
      maxRetriesPerRequest: null,
      tls: requireTls ? { rejectUnauthorized: false } : undefined,
    });
    connection.on('error', (err) => console.error('Redis connection error:', err));
  } catch (err) {
    console.error('Invalid REDIS_URL provided:', err);
  }
}

export const outboundQueue = connection ? new Queue('outboundMessages', { connection: connection as any }) : null;
export const whatsappOutboundQueue = connection
  ? new Queue('whatsappOutbound', { connection: connection as any })
  : null;

export const setupWorker = () => {
  if (!connection) return null;

  setInterval(async () => {
    try {
      await connectToDatabase();
      const threshold = new Date(Date.now() - 15000);
      const staleProfiles = await Profile.find({
        status: 'active',
        channel: 'IMESSAGE',
        lastPing: { $lt: threshold },
      });

      for (const profile of staleProfiles) {
        profile.status = 'inactive';
        await profile.save();
        console.log(`Profile ${profile.workerId} marked offline due to inactivity.`);

        const messagesToRequeue = await Message.find({ workerId: profile.workerId, status: 'queued' });
        for (const m of messagesToRequeue) {
          m.status = 'pending';
          m.workerId = undefined;
          m.deviceId = undefined;
          await m.save();
          if (outboundQueue) {
            await outboundQueue.add(OUTBOUND_JOB_NAME, { messageId: m._id.toString() });
          }
        }
      }
    } catch (e) {
      console.error('Error checking stale nodes', e);
    }
  }, 10000);

  const worker = new Worker(
    'outboundMessages',
    async (job) => {
      const { messageId } = job.data;
      const result = await processOutboundJob(messageId);
      if (!result) {
        throw new Error(`Message ${messageId} not found`);
      }
      if (result.status === 'pending' && result.channel !== 'SMS') {
        throw new Error(`No available connector for ${result.channel}`);
      }
      return result;
    },
    { connection: connection as any, concurrency: 1 }
  );

  worker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} failed:`, err);
  });

  return worker;
};

export function getRedisConnection(): IORedis | null {
  return connection;
}
