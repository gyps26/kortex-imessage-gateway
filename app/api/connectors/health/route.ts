import { NextResponse } from 'next/server';
import { connectToDatabase } from '../../../../lib/db/mongoose';
import { getRedisConnection } from '../../../../lib/queue/redis';
import { isWhatsappWorkerOnline } from '../../../../lib/whatsapp/session-events';

export async function GET() {
  try {
    await connectToDatabase();
    const redis = getRedisConnection();
    const redisReachable = redis ? await redis.ping().then(() => true).catch(() => false) : false;
    const workerOnline = await isWhatsappWorkerOnline();

    return NextResponse.json({
      redisReachable,
      workerOnline,
      healthy: redisReachable && workerOnline,
    });
  } catch (error: unknown) {
    console.error('WhatsApp health check error:', error);
    return NextResponse.json({ redisReachable: false, workerOnline: false, healthy: false }, { status: 500 });
  }
}
