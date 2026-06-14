import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '../../../../lib/db/mongoose';
import { Profile } from '../../../../models/Profile';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();
    const channel = req.nextUrl.searchParams.get('channel');
    const filter = channel ? { channel } : {};
    const profiles = await Profile.find(filter).sort({ lastPing: -1 });
    return NextResponse.json({ profiles });
  } catch (error: unknown) {
    console.error('Error fetching workers:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
