import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { connectToDatabase } from '../../../lib/db/mongoose';
import { Profile } from '../../../models/Profile';

export async function GET(req: NextRequest) {
  await connectToDatabase();
  const channel = req.nextUrl.searchParams.get('channel');

  const filter: Record<string, string> = {};
  if (channel) filter.channel = channel;

  const profiles = await Profile.find(filter).sort({ lastPing: -1 }).lean();
  return NextResponse.json({ profiles });
}

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();
    const body = await req.json();
    const channel = body.channel || 'WHATSAPP';

    if (channel !== 'WHATSAPP') {
      return NextResponse.json({ error: 'Use /api/gateway/devices for SMS registration' }, { status: 400 });
    }

    const sessionId = body.sessionId || crypto.randomUUID();
    const workerId = `wa-${sessionId.slice(0, 8)}`;

    const profile = await Profile.create({
      workerId,
      sessionId,
      name: body.name || `WhatsApp ${workerId}`,
      channel: 'WHATSAPP',
      status: 'inactive',
      assignedLocationId: body.assignedLocationId,
    });

    return NextResponse.json({ profile });
  } catch (error: unknown) {
    console.error('WhatsApp connector creation error:', error);
    return NextResponse.json({ error: 'Failed to create connector' }, { status: 500 });
  }
}
