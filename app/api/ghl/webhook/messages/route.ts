import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '../../../../../lib/db/mongoose';
import { createOutboundMessage } from '../../../../../lib/routing/channelRouter';
import type { Channel } from '../../../../../lib/connectors/types';

function verifyWebhookAuth(req: NextRequest): boolean {
  const expectedSecret = process.env.GHL_WEBHOOK_SECRET;
  if (!expectedSecret) return true;

  const authHeader = req.headers.get('authorization') || req.headers.get('x-ghl-webhook-secret') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
  return token === expectedSecret;
}

export async function POST(req: NextRequest) {
  try {
    if (!verifyWebhookAuth(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();

    const phone = body.phone || body.to;
    const msgBody = body.body || body.message;
    const locationId = body.locationId || body.location_id || req.headers.get('x-ghl-location-id');
    const contactId = body.contactId || body.contact_id;
    const ghlMessageId = body.messageId || body.message_id;
    const channel = body.channel as Channel | undefined;

    if (!phone || !msgBody) {
      return NextResponse.json({ error: 'Missing phone or body' }, { status: 400 });
    }

    if (!locationId) {
      return NextResponse.json({ error: 'Missing locationId — required to route message to a connector' }, { status: 400 });
    }

    await connectToDatabase();

    const message = await createOutboundMessage({
      phone,
      body: msgBody,
      locationId,
      contactId,
      ghlMessageId,
      attachments: body.attachments || [],
      channel,
    });

    return NextResponse.json({ success: true, messageId: message._id, channel: message.channel });
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error('Error handling GHL webhook:', error);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
