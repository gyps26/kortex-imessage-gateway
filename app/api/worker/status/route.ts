import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '../../../../lib/db/mongoose';
import { Message } from '../../../../models/Message';
import { Profile } from '../../../../models/Profile';
import { updateMessageStatus, tagNonIMessage } from '../../../../lib/ghl/messages';

function checkAuth(req: NextRequest) {
  const bearer = req.headers.get('authorization');
  const secret = process.env.API_SECRET;
  if (!secret) return true;
  const token = bearer?.split(' ')[1];
  return token === secret;
}

export async function POST(req: NextRequest) {
  try {
    if (!checkAuth(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { workerId, messageId, status, errorDetails } = body;

    if (!workerId || !messageId || !status) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    await connectToDatabase();

    const msg = await Message.findById(messageId);
    if (!msg) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    msg.status = status;
    if (errorDetails) {
      msg.errorDetails = errorDetails;
    }
    await msg.save();

    if (msg.ghlMessageId && msg.locationId && ['sent', 'delivered', 'failed'].includes(status)) {
      try {
        await updateMessageStatus({
          locationId: msg.locationId,
          ghlMessageId: msg.ghlMessageId,
          status: status as 'sent' | 'delivered' | 'failed',
          errorDetails,
        });
      } catch (e: unknown) {
        const err = e as { response?: { data?: unknown }; message?: string };
        console.error('Failed to sync status to GHL:', err.response?.data || err.message);
      }
    }

    if (status === 'failed') {
      if (errorDetails === 'failed_not_imessage' && msg.ghlContactId && msg.locationId) {
        try {
          await tagNonIMessage(msg.locationId, msg.ghlContactId);
          console.log(`Successfully tagged contact ${msg.ghlContactId} as Non-iPhone`);
        } catch (err: unknown) {
          const e = err as { response?: { data?: unknown }; message?: string };
          console.error('Failed to tag contact in GHL:', e.response?.data || e.message);
        }
      } else {
        const profile = await Profile.findOne({ workerId, channel: 'IMESSAGE' });
        if (profile) {
          profile.errorThreshold += 1;
          if (profile.errorThreshold >= 3) {
            profile.status = 'inactive';
            console.warn(`Profile ${workerId} marked inactive due to repeated failures!`);
          }
          await profile.save();
        }
      }
    } else if (status === 'sent') {
      const profile = await Profile.findOne({ workerId, channel: 'IMESSAGE' });
      if (profile) {
        profile.errorThreshold = 0;
        await profile.save();
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Error updating worker status:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
