import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '../../../../../../lib/db/mongoose';
import { Message } from '../../../../../../models/Message';
import { Profile } from '../../../../../../models/Profile';
import { updateMessageStatus } from '../../../../../../lib/ghl/messages';
import { authenticateDevice, unauthorizedResponse } from '../../../../../../lib/gateway/auth';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const profile = await authenticateDevice(req);
    if (!profile) return unauthorizedResponse();

    const { id } = await params;

    const body = await req.json();
    const { smsId, status, errorMessage, errorCode } = body;

    if (!smsId || !status) {
      return NextResponse.json({ error: 'Missing smsId or status' }, { status: 400 });
    }

    await connectToDatabase();

    const message = await Message.findById(smsId);
    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    const normalizedStatus = status.toLowerCase();
    if (['sent', 'delivered', 'failed'].includes(normalizedStatus)) {
      message.status = normalizedStatus as 'sent' | 'delivered' | 'failed';
    }
    if (errorMessage || errorCode) {
      message.errorDetails = errorMessage || String(errorCode);
    }
    await message.save();

    profile.lastPing = new Date();
    await profile.save();

    if (message.ghlMessageId && message.locationId && ['sent', 'delivered', 'failed'].includes(normalizedStatus)) {
      try {
        await updateMessageStatus({
          locationId: message.locationId,
          ghlMessageId: message.ghlMessageId,
          status: normalizedStatus as 'sent' | 'delivered' | 'failed',
          errorDetails: message.errorDetails,
        });
      } catch (e: unknown) {
        const err = e as { response?: { data?: unknown }; message?: string };
        console.error('Failed to sync SMS status to GHL:', err.response?.data || err.message);
      }
    }

    if (normalizedStatus === 'failed') {
      const connector = await Profile.findOne({ workerId: profile.workerId, channel: 'SMS' });
      if (connector) {
        connector.errorThreshold += 1;
        if (connector.errorThreshold >= 3) {
          connector.status = 'inactive';
        }
        await connector.save();
      }
    } else if (normalizedStatus === 'sent') {
      const connector = await Profile.findOne({ workerId: profile.workerId, channel: 'SMS' });
      if (connector) {
        connector.errorThreshold = 0;
        await connector.save();
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('SMS status update error:', error);
    return NextResponse.json({ error: 'Failed to update status' }, { status: 500 });
  }
}
