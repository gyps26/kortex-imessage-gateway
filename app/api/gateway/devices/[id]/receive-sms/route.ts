import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '../../../../../../lib/db/mongoose';
import { Message } from '../../../../../../models/Message';
import { injectInbound } from '../../../../../../lib/ghl/messages';
import { authenticateDevice, unauthorizedResponse } from '../../../../../../lib/gateway/auth';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const profile = await authenticateDevice(req);
    if (!profile) return unauthorizedResponse();

    const { id } = await params;

    if (!profile.assignedLocationId) {
      return NextResponse.json({ error: 'Device not assigned to a location' }, { status: 400 });
    }

    const body = await req.json();
    const sender = body.sender;
    const messageText = body.message;
    const receivedAtInMillis = body.receivedAtInMillis || Date.now();

    if (!sender || !messageText) {
      return NextResponse.json({ error: 'Missing sender or message' }, { status: 400 });
    }

    await connectToDatabase();

    profile.lastPing = new Date();
    await profile.save();

    const message = await Message.create({
      workerId: profile.workerId,
      deviceId: profile.workerId,
      locationId: profile.assignedLocationId,
      phone: sender,
      body: messageText,
      channel: 'SMS',
      direction: 'inbound',
      status: 'delivered',
    });

    try {
      await injectInbound({
        locationId: profile.assignedLocationId,
        phone: sender,
        message: messageText,
        conversationProviderId: profile.assignedLocationId,
      });
    } catch (ghlErr: unknown) {
      const err = ghlErr as { response?: { data?: unknown }; message?: string };
      console.error('Failed to inject inbound SMS to GHL:', err.response?.data || err.message);
    }

    return NextResponse.json({
      smsId: message._id.toString(),
      receivedAtInMillis,
    });
  } catch (error: unknown) {
    console.error('Inbound SMS error:', error);
    return NextResponse.json({ error: 'Failed to process inbound SMS' }, { status: 500 });
  }
}
