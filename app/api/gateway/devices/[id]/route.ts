import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '../../../../../lib/db/mongoose';
import { Profile } from '../../../../../models/Profile';
import { authenticateDevice, unauthorizedResponse } from '../../../../../lib/gateway/auth';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const profile = await authenticateDevice(req);
    if (!profile) return unauthorizedResponse();

    const { id } = await params;
    if (profile.workerId !== id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await connectToDatabase();
    const body = await req.json();

    if (body.fcmToken !== undefined) profile.fcmToken = body.fcmToken;
    if (body.enabled !== undefined) profile.status = body.enabled ? 'active' : 'inactive';
    if (body.brand !== undefined) profile.deviceBrand = body.brand;
    if (body.model !== undefined) profile.deviceModel = body.model;

    profile.lastPing = new Date();
    await profile.save();

    return NextResponse.json({
      id: profile.workerId,
      enabled: profile.status === 'active',
    });
  } catch (error: unknown) {
    console.error('Device update error:', error);
    return NextResponse.json({ error: 'Failed to update device' }, { status: 500 });
  }
}
