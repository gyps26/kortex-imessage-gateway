import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { connectToDatabase } from '../../../../lib/db/mongoose';
import { Profile } from '../../../../models/Profile';
import { generateDeviceApiKey } from '../../../../lib/sms/fcm';

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();
    const body = await req.json();
    const providedApiKey = req.headers.get('x-api-key');

    // If an API key is provided, the Android app is trying to register/link
    if (providedApiKey) {
      const profile = await Profile.findOne({ apiKey: providedApiKey, channel: 'SMS' });
      if (!profile) {
        return NextResponse.json({ error: 'Invalid API Key' }, { status: 404 });
      }

      // Update the profile with Android device details
      if (body.fcmToken) {
        profile.fcmToken = body.fcmToken;
        profile.status = 'active';
      }
      if (body.brand) profile.deviceBrand = body.brand;
      if (body.model) profile.deviceModel = body.model;
      if (body.enabled !== undefined) profile.status = body.enabled ? 'active' : 'inactive';
      profile.lastPing = new Date();
      await profile.save();

      // Return selfhostsim compatible response
      return NextResponse.json({
        success: true,
        data: {
          _id: profile.workerId,
          enabled: profile.status === 'active',
        }
      });
    }

    // Otherwise, Web Dashboard is generating a new device
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
      status: body.enabled === false ? 'inactive' : 'pending',
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
