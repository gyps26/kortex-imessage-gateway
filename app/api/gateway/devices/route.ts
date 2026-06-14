import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { connectToDatabase } from '../../../../lib/db/mongoose';
import { Profile } from '../../../../models/Profile';
import { generateDeviceApiKey } from '../../../../lib/sms/fcm';

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();
    const body = await req.json();

    const deviceId = crypto.randomUUID();
    const apiKey = generateDeviceApiKey();

    const profile = await Profile.create({
      workerId: deviceId,
      name: body.model ? `${body.brand || 'Android'} ${body.model}` : `Android Device ${deviceId.slice(0, 8)}`,
      channel: 'SMS',
      apiKey,
      fcmToken: body.fcmToken,
      deviceBrand: body.brand,
      deviceModel: body.model,
      status: body.enabled === false ? 'inactive' : 'active',
      lastPing: new Date(),
    });

    return NextResponse.json({
      id: profile.workerId,
      apiKey,
      enabled: profile.status === 'active',
    });
  } catch (error: unknown) {
    console.error('Device registration error:', error);
    return NextResponse.json({ error: 'Failed to register device' }, { status: 500 });
  }
}
