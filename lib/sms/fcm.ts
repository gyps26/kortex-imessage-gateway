import admin from 'firebase-admin';
import crypto from 'crypto';
import { IMessage } from '../../models/Message';
import { IProfile } from '../../models/Profile';

let firebaseInitialized = false;

function initFirebase(): boolean {
  if (firebaseInitialized) return true;
  if (admin.apps.length > 0) {
    firebaseInitialized = true;
    return true;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    console.warn('Firebase credentials not configured — SMS FCM dispatch disabled');
    return false;
  }

  admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
  });
  firebaseInitialized = true;
  return true;
}

export function generateDeviceApiKey(): string {
  return crypto.randomBytes(32).toString('hex');
}

export async function dispatchSmsOutbound(message: IMessage, connector: IProfile): Promise<void> {
  if (!connector.fcmToken) {
    message.status = 'failed';
    message.errorDetails = 'SMS device has no FCM token registered';
    await message.save();
    return;
  }

  if (!initFirebase()) {
    message.status = 'failed';
    message.errorDetails = 'Firebase not configured on server';
    await message.save();
    return;
  }

  const smsId = message._id.toString();
  const smsBatchId = smsId;

  const smsData = JSON.stringify({
    smsId,
    smsBatchId,
    recipients: [message.phone],
    message: message.body,
    receivers: [message.phone],
    smsBody: message.body,
  });

  try {
    await admin.messaging().send({
      token: connector.fcmToken,
      data: { smsData },
      android: { priority: 'high' },
    });

    message.status = 'queued';
    message.workerId = connector.workerId;
    message.deviceId = connector.workerId;
    await message.save();
  } catch (err: unknown) {
    const error = err as { message?: string };
    message.status = 'failed';
    message.errorDetails = error.message || 'FCM dispatch failed';
    await message.save();
    throw err;
  }
}
