import { NextResponse } from 'next/server';
import { connectToDatabase } from '../../../../../../lib/db/mongoose';
import { Profile } from '../../../../../../models/Profile';
import { generateDeviceApiKey } from '../../../../../../lib/sms/fcm';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectToDatabase();
    const { id } = await params;

    const profile = await Profile.findOne({ workerId: id, channel: 'SMS' });
    if (!profile) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 });
    }

    const apiKey = generateDeviceApiKey();
    profile.apiKey = apiKey;
    profile.status = 'pending';
    profile.fcmToken = undefined;
    profile.lastPing = new Date();
    await profile.save();

    return NextResponse.json({ apiKey, workerId: profile.workerId });
  } catch (error: unknown) {
    console.error('Rotate key error:', error);
    return NextResponse.json({ error: 'Failed to rotate API key' }, { status: 500 });
  }
}
