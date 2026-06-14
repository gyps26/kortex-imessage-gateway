import { NextResponse } from 'next/server';
import { connectToDatabase } from '../../../../../lib/db/mongoose';
import { Profile } from '../../../../../models/Profile';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await connectToDatabase();
  const { id } = await params;

  const profile = await Profile.findOne({ workerId: id, channel: 'WHATSAPP' }).lean();
  if (!profile) {
    return NextResponse.json({ error: 'Connector not found' }, { status: 404 });
  }

  return NextResponse.json({
    workerId: profile.workerId,
    sessionId: profile.sessionId,
    qrCode: profile.qrCode,
    whatsappPhone: profile.whatsappPhone,
    status: profile.status,
    assignedLocationId: profile.assignedLocationId,
    lastPing: profile.lastPing,
  });
}
