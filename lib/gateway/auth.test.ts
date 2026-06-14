import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { Profile } from '../../models/Profile';
import { authenticateDevice } from './auth';
import { useTestDb } from '../../tests/with-db';

useTestDb();

describe('authenticateDevice', () => {
  it('returns null without api key header', async () => {
    const req = new NextRequest('http://localhost/api/gateway/devices/test');
    const result = await authenticateDevice(req);
    expect(result).toBeNull();
  });

  it('returns profile for valid api key', async () => {
    await Profile.create({
      workerId: 'sms-device-1',
      name: 'Android',
      channel: 'SMS',
      status: 'active',
      apiKey: 'test-api-key-123',
    });

    const req = new NextRequest('http://localhost/api/gateway/devices/sms-device-1', {
      headers: { 'x-api-key': 'test-api-key-123' },
    });

    const result = await authenticateDevice(req);
    expect(result?.workerId).toBe('sms-device-1');
  });

  it('returns null for invalid api key', async () => {
    const req = new NextRequest('http://localhost/api/gateway/devices/test', {
      headers: { 'x-api-key': 'wrong-key' },
    });

    const result = await authenticateDevice(req);
    expect(result).toBeNull();
  });
});
