import { NextRequest } from 'next/server';
import { connectToDatabase } from '../db/mongoose';
import { Profile, IProfile } from '../../models/Profile';

export async function authenticateDevice(req: NextRequest): Promise<IProfile | null> {
  const apiKey = req.headers.get('x-api-key');
  if (!apiKey) return null;

  await connectToDatabase();
  return Profile.findOne({ apiKey, channel: 'SMS' });
}

export function unauthorizedResponse() {
  return Response.json({ error: 'Unauthorized' }, { status: 401 });
}
