import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '../../../../lib/db/mongoose';
import { Message } from '../../../../models/Message';
import { Profile } from '../../../../models/Profile';

function checkAuth(req: NextRequest) {
  const bearer = req.headers.get('authorization');
  const secret = process.env.API_SECRET;
  if (!secret) return true;
  const token = bearer?.split(' ')[1];
  return token === secret;
}

export async function GET(req: NextRequest) {
  try {
    if (!checkAuth(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const workerId = req.nextUrl.searchParams.get('workerId');
    if (!workerId) {
      return NextResponse.json({ error: 'workerId parameter required' }, { status: 400 });
    }

    await connectToDatabase();

    let profile = await Profile.findOne({ workerId, channel: 'IMESSAGE' });
    if (!profile) {
      profile = new Profile({
        workerId,
        name: `iMessage Connector ${workerId}`,
        channel: 'IMESSAGE',
        status: 'active',
      });
    } else {
      profile.lastPing = new Date();
      const now = new Date();
      const lastReset = profile.lastReset || new Date(0);
      if (
        now.getDate() !== lastReset.getDate() ||
        now.getMonth() !== lastReset.getMonth() ||
        now.getFullYear() !== lastReset.getFullYear()
      ) {
        profile.dailyCount = 0;
        profile.lastReset = now;
      }
      if (profile.status === 'inactive') {
        profile.status = 'active';
        profile.errorThreshold = 0;
      }
    }

    await profile.save();

    const lastSentMsg = await Message.findOne({
      workerId,
      channel: 'IMESSAGE',
      direction: 'outbound',
      status: 'sent',
    }).sort({ updatedAt: -1 });

    if (lastSentMsg) {
      const timeSinceLastSend = Date.now() - lastSentMsg.updatedAt.getTime();
      if (timeSinceLastSend < 15000) {
        return NextResponse.json({ actions: [] });
      }
    }

    const pendingMsg = await Message.findOneAndUpdate(
      { workerId, channel: 'IMESSAGE', status: 'queued', direction: 'outbound' },
      { status: 'pending' },
      { sort: { createdAt: 1 } }
    );

    if (!pendingMsg) {
      return NextResponse.json({ actions: [] });
    }

    return NextResponse.json({
      actions: [
        {
          id: pendingMsg._id,
          type: 'send_sms',
          phone: pendingMsg.phone,
          body: pendingMsg.body,
          attachments: pendingMsg.attachments || [],
        },
      ],
    });
  } catch (error: unknown) {
    console.error('Error in worker poll:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
