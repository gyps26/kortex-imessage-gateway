import { NextResponse } from 'next/server';
import { connectToDatabase } from '../../../../lib/db/mongoose';
import { GhlLocation } from '../../../../models/GhlLocation';
import { Profile } from '../../../../models/Profile';
import { Message } from '../../../../models/Message';
import { outboundQueue, whatsappOutboundQueue } from '../../../../lib/queue/redis';
import { isWhatsappWorkerOnline } from '../../../../lib/whatsapp/session-events';

export const dynamic = 'force-dynamic';

function isFirebaseConfigured(): boolean {
  return !!(
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  );
}

export async function GET() {
  try {
    await connectToDatabase();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      connectedSubaccounts,
      activeWorkers,
      totalWorkers,
      messagesSentToday,
      pendingMessages,
      failedMessages,
      imessageConnectors,
      whatsappConnectors,
      smsConnectors,
      pendingByChannel,
      failedByChannel,
      connectorsNeedingAttention,
      lastFailedMessage,
      whatsappWorkerOnline,
    ] = await Promise.all([
      GhlLocation.countDocuments(),
      Profile.countDocuments({ status: 'active' }),
      Profile.countDocuments(),
      Message.countDocuments({
        direction: 'outbound',
        status: { $in: ['sent', 'delivered'] },
        createdAt: { $gte: today },
      }),
      Message.countDocuments({ status: { $in: ['pending', 'queued'] } }),
      Message.countDocuments({ status: 'failed', createdAt: { $gte: today } }),
      Profile.countDocuments({ channel: 'IMESSAGE', status: 'active' }),
      Profile.countDocuments({ channel: 'WHATSAPP', status: 'active' }),
      Profile.countDocuments({ channel: 'SMS', status: 'active' }),
      Message.aggregate([
        { $match: { status: { $in: ['pending', 'queued'] } } },
        { $group: { _id: '$channel', count: { $sum: 1 } } },
      ]),
      Message.aggregate([
        { $match: { status: 'failed', createdAt: { $gte: today } } },
        { $group: { _id: '$channel', count: { $sum: 1 } } },
      ]),
      Profile.countDocuments({
        $or: [
          { assignedLocationId: { $exists: false } },
          { assignedLocationId: null },
          { status: 'pending' },
          { status: 'inactive' },
        ],
      }),
      Message.findOne({ status: 'failed' }).sort({ updatedAt: -1 }).lean(),
      isWhatsappWorkerOnline(),
    ]);

    const assignedWorkers = await Profile.countDocuments({ assignedLocationId: { $exists: true, $ne: null } });

    const channelQueue: Record<string, number> = {};
    for (const row of pendingByChannel) {
      channelQueue[row._id || 'UNKNOWN'] = row.count;
    }

    const channelFailed: Record<string, number> = {};
    for (const row of failedByChannel) {
      channelFailed[row._id || 'UNKNOWN'] = row.count;
    }

    return NextResponse.json({
      connectedSubaccounts,
      activeWorkers,
      totalWorkers,
      assignedWorkers,
      messagesSentToday,
      pendingMessages,
      failedMessages,
      redisConnected: !!outboundQueue,
      whatsappQueueConnected: !!whatsappOutboundQueue,
      whatsappWorkerOnline,
      firebaseConfigured: isFirebaseConfigured(),
      connectorsNeedingAttention,
      lastFailedReason: lastFailedMessage?.errorDetails || null,
      mongoConnected: true,
      connectorsByChannel: {
        IMESSAGE: imessageConnectors,
        WHATSAPP: whatsappConnectors,
        SMS: smsConnectors,
      },
      channelQueue,
      channelFailed,
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return NextResponse.json(
      {
        connectedSubaccounts: 0,
        activeWorkers: 0,
        totalWorkers: 0,
        assignedWorkers: 0,
        messagesSentToday: 0,
        pendingMessages: 0,
        failedMessages: 0,
        redisConnected: false,
        whatsappQueueConnected: false,
        whatsappWorkerOnline: false,
        firebaseConfigured: false,
        connectorsNeedingAttention: 0,
        lastFailedReason: null,
        mongoConnected: false,
        connectorsByChannel: { IMESSAGE: 0, WHATSAPP: 0, SMS: 0 },
        channelQueue: {},
        channelFailed: {},
      },
      { status: 500 }
    );
  }
}
