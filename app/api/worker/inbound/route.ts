import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '../../../../lib/db/mongoose';
import { Message } from '../../../../models/Message';
import { Profile } from '../../../../models/Profile';
import { injectInbound } from '../../../../lib/ghl/messages';

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
    const { workerId, phone, body: smsBody, isFromMe } = body;

    if (!workerId || !phone || !smsBody) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    await connectToDatabase();

    const profile = await Profile.findOne({ workerId, channel: 'IMESSAGE' });
    if (!profile || !profile.assignedLocationId) {
      return NextResponse.json({ error: 'Worker unassigned or not found' }, { status: 400 });
    }

    if (isFromMe) {
      const recentOutbound = await Message.findOne({
        phone,
        body: smsBody,
        direction: 'outbound',
        createdAt: { $gt: new Date(Date.now() - 120000) },
      });
      if (recentOutbound) {
        return NextResponse.json({ success: true, messageId: recentOutbound._id });
      }
    }

    const message = new Message({
      workerId,
      deviceId: workerId,
      locationId: profile.assignedLocationId,
      phone,
      body: smsBody,
      channel: 'IMESSAGE',
      direction: isFromMe ? 'outbound' : 'inbound',
      status: 'delivered',
    });

    await message.save();

    try {
      await injectInbound({
        locationId: profile.assignedLocationId,
        phone,
        message: smsBody,
        conversationProviderId: profile.assignedLocationId,
        direction: isFromMe ? 'outbound' : undefined,
      });
    } catch (ghlErr: unknown) {
      const err = ghlErr as { response?: { data?: unknown }; message?: string };
      console.error('Failed to inject into GHL:', err.response?.data || err.message);
    }

    return NextResponse.json({ success: true, messageId: message._id });
  } catch (error: unknown) {
    console.error('Error handling inbound SMS:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
