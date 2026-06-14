import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { PUT, DELETE } from './route';
import { Profile } from '../../../models/Profile';
import { useTestDb } from '../../../tests/with-db';

vi.mock('../../../lib/whatsapp/session-events', () => ({
  publishSessionDestroy: vi.fn().mockResolvedValue(undefined),
}));

useTestDb();

describe('PUT /api/workers', () => {
  it('updates daily limit', async () => {
    await Profile.create({
      workerId: 'worker-1',
      name: 'Worker 1',
      channel: 'IMESSAGE',
      status: 'active',
      dailyLimit: 50,
    });

    const req = new NextRequest('http://localhost/api/workers', {
      method: 'PUT',
      body: JSON.stringify({ workerId: 'worker-1', dailyLimit: 100 }),
    });

    const res = await PUT(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.profile.dailyLimit).toBe(100);
  });

  it('returns 404 for unknown worker', async () => {
    const req = new NextRequest('http://localhost/api/workers', {
      method: 'PUT',
      body: JSON.stringify({ workerId: 'missing', dailyLimit: 100 }),
    });

    const res = await PUT(req);
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/workers', () => {
  it('deletes a connector', async () => {
    await Profile.create({
      workerId: 'to-delete',
      name: 'Delete Me',
      channel: 'SMS',
      status: 'pending',
    });

    const req = new NextRequest('http://localhost/api/workers?workerId=to-delete', {
      method: 'DELETE',
    });

    const res = await DELETE(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);

    const found = await Profile.findOne({ workerId: 'to-delete' });
    expect(found).toBeNull();
  });
});
