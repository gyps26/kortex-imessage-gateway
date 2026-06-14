import { NextResponse } from 'next/server';
import { connectToDatabase } from '../../../../lib/db/mongoose';
import { GhlLocation } from '../../../../models/GhlLocation';
import { Profile } from '../../../../models/Profile';
import { Message } from '../../../../models/Message';
import { outboundQueue, whatsappOutboundQueue } from '../../../../lib/queue/redis';

export const dynamic = 'force-dynamic';

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
    ]);

    const assignedWorkers = await Profile.countDocuments({ assignedLocationId: { $exists: true, $ne: null } });

    const channelQueue: Record<string, number> = {};
    for (const row of pendingByChannel) {
      channelQueue[row._id || 'UNKNOWN'] = row.count;
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
      mongoConnected: true,
      connectorsByChannel: {
        IMESSAGE: imessageConnectors,
        WHATSAPP: whatsappConnectors,
        SMS: smsConnectors,
      },
      channelQueue,
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
        mongoConnected: false,
        connectorsByChannel: { IMESSAGE: 0, WHATSAPP: 0, SMS: 0 },
        channelQueue: {},
      },
      { status: 500 }
    );
  }
}
