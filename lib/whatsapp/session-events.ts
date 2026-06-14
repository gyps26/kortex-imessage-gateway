import { getRedisConnection } from '../queue/redis';

export const WASP_SESSION_CREATE_CHANNEL = 'wasp:session:create';
export const WASP_SESSION_DESTROY_CHANNEL = 'wasp:session:destroy';
export const WASP_WORKER_HEARTBEAT_KEY = 'wasp:worker:heartbeat';

export interface SessionCreateEvent {
  sessionId: string;
  workerId: string;
}

export interface SessionDestroyEvent {
  sessionId: string;
  workerId: string;
}

export async function publishSessionCreate(event: SessionCreateEvent): Promise<void> {
  const redis = getRedisConnection();
  if (!redis) return;
  await redis.publish(WASP_SESSION_CREATE_CHANNEL, JSON.stringify(event));
}

export async function publishSessionDestroy(event: SessionDestroyEvent): Promise<void> {
  const redis = getRedisConnection();
  if (!redis) return;
  await redis.publish(WASP_SESSION_DESTROY_CHANNEL, JSON.stringify(event));
}

export async function isWhatsappWorkerOnline(): Promise<boolean> {
  const redis = getRedisConnection();
  if (!redis) return false;

  try {
    const heartbeat = await redis.get(WASP_WORKER_HEARTBEAT_KEY);
    if (heartbeat) {
      const ts = parseInt(heartbeat, 10);
      if (!isNaN(ts) && Date.now() - ts < 60_000) return true;
    }
    await redis.ping();
    return false;
  } catch {
    return false;
  }
}

export async function touchWorkerHeartbeat(): Promise<void> {
  const redis = getRedisConnection();
  if (!redis) return;
  await redis.set(WASP_WORKER_HEARTBEAT_KEY, Date.now().toString(), 'EX', 120);
}
