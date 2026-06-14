import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '../../../lib/db/mongoose';
import { Message } from '../../../models/Message';
import { createOutboundMessage } from '../../../lib/routing/channelRouter';

export async function GET() {
  await connectToDatabase();
  try {
    const messages = await Message.find().sort({ createdAt: -1 }).limit(100).lean();
    return NextResponse.json({ messages });
  } catch {
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  await connectToDatabase();
  try {
    const { to, body, locationId, channel } = await req.json();
    if (!to || !body) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

    if (!locationId) {
      return NextResponse.json({ error: 'locationId is required for multi-channel routing' }, { status: 400 });
    }

    const message = await createOutboundMessage({
      phone: to,
      body,
      locationId,
      channel,
    });

    return NextResponse.json({ success: true, queued: true, message });
  } catch {
    return NextResponse.json({ error: 'Failed to send' }, { status: 500 });
  }
}
