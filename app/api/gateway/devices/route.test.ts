import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';
import { Profile } from '../../../../models/Profile';
import { useTestDb } from '../../../../tests/with-db';

useTestDb();

describe('POST /api/gateway/devices', () => {
  it('registers a new device from dashboard', async () => {
    const req = new NextRequest('http://localhost/api/gateway/devices', {
      method: 'POST',
      body: JSON.stringify({ enabled: true }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.apiKey).toBeTruthy();
    expect(data.id).toBeTruthy();

    const profile = await Profile.findOne({ workerId: data.id });
    expect(profile?.channel).toBe('SMS');
    expect(profile?.status).toBe('pending');
  });

  it('links android app with api key', async () => {
    const profile = await Profile.create({
      workerId: 'sms-link-1',
      name: 'Android',
      channel: 'SMS',
      status: 'pending',
      apiKey: 'link-key-abc',
    });

    const req = new NextRequest('http://localhost/api/gateway/devices', {
      method: 'POST',
      headers: { 'x-api-key': 'link-key-abc' },
      body: JSON.stringify({ fcmToken: 'fcm-token-xyz', brand: 'Samsung', model: 'S21' }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);

    const updated = await Profile.findById(profile._id);
    expect(updated?.fcmToken).toBe('fcm-token-xyz');
    expect(updated?.deviceBrand).toBe('Samsung');
    expect(updated?.status).toBe('active');
  });

  it('rejects invalid api key', async () => {
    const req = new NextRequest('http://localhost/api/gateway/devices', {
      method: 'POST',
      headers: { 'x-api-key': 'invalid' },
      body: JSON.stringify({ fcmToken: 'token' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(404);
  });
});
