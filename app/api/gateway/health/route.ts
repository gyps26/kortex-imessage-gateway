import { NextResponse } from 'next/server';

function isFirebaseConfigured(): boolean {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  return !!(projectId && clientEmail && privateKey);
}

export async function GET() {
  return NextResponse.json({
    firebaseConfigured: isFirebaseConfigured(),
    healthy: isFirebaseConfigured(),
  });
}
