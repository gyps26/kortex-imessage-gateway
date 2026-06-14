import mongoose from 'mongoose';
import type { Channel } from '../lib/connectors/types';

export interface IProfile extends mongoose.Document {
  workerId: string;
  name: string;
  channel: Channel;
  assignedLocationId?: string;
  appleId?: string;
  fcmToken?: string;
  sessionId?: string;
  apiKey?: string;
  qrCode?: string;
  whatsappPhone?: string;
  deviceBrand?: string;
  deviceModel?: string;
  status: 'active' | 'inactive';
  lastPing: Date;
  dailyCount: number;
  dailyLimit: number;
  lastReset: Date;
  errorThreshold: number;
}

const profileSchema = new mongoose.Schema<IProfile>({
  workerId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  channel: { type: String, enum: ['IMESSAGE', 'WHATSAPP', 'SMS'], default: 'IMESSAGE', required: true },
  assignedLocationId: { type: String, index: true },
  appleId: { type: String },
  fcmToken: { type: String },
  sessionId: { type: String },
  apiKey: { type: String, index: true },
  qrCode: { type: String },
  whatsappPhone: { type: String },
  deviceBrand: { type: String },
  deviceModel: { type: String },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  lastPing: { type: Date, default: Date.now },
  dailyCount: { type: Number, default: 0 },
  dailyLimit: { type: Number, default: 50 },
  lastReset: { type: Date, default: Date.now },
  errorThreshold: { type: Number, default: 0 },
});

export const Profile = mongoose.models.Profile || mongoose.model<IProfile>('Profile', profileSchema);
