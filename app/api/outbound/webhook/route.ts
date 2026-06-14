import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { connectToDatabase } from '../../../../lib/db/mongoose';
import { createOutboundMessage } from '../../../../lib/routing/channelRouter';
import type { Channel } from '../../../../lib/connectors/types';

function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.GHL_WEBHOOK_SECRET;
  if (!secret) return true;
  if (!signature) return false;

  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  if (expected.length !== signature.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-wh-signature');

    if (!verifyWebhookSignature(rawBody, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const body = JSON.parse(rawBody);

    const customData = body.customData || {};
    const contactId = body.contact_id || body.contactId || body.contact?.id;
    const phoneNum = body.phone || body.to || customData.phone || body.contact?.phone;
    const msgBody = body.message || body.body || customData.message || customData.body;
    const locId = body.location_id || body.locationId || body.location?.id;
    const ghlMsgId = body.messageId || body.message_id || `wf_${Date.now()}`;
    const attachments = body.attachments || [];
    const channel = (body.channel || customData.channel) as Channel | undefined;

    if (!phoneNum || !msgBody || !locId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    await connectToDatabase();

    const message = await createOutboundMessage({
      contactId,
      ghlMessageId: ghlMsgId,
      locationId: locId,
      phone: phoneNum,
      body: msgBody,
      attachments,
      channel,
    });

    return NextResponse.json({ success: true, messageId: message._id, channel: message.channel });
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error('Outbound Webhook Error:', err.message);
    return NextResponse.json({ error: 'Failed to process webhook' }, { status: 500 });
  }
}
