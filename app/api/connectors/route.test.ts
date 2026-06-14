import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST, GET } from './route';
import { Profile } from '../../../models/Profile';
import { useTestDb } from '../../../tests/with-db';

vi.mock('../../../lib/whatsapp/session-events', () => ({
  publishSessionCreate: vi.fn().mockResolvedValue(undefined),
}));

useTestDb();

describe('POST /api/connectors', () => {
  it('creates a WhatsApp connector', async () => {
    const req = new NextRequest('http://localhost/api/connectors', {
      method: 'POST',
      body: JSON.stringify({ name: 'My WhatsApp' }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.profile.channel).toBe('WHATSAPP');
    expect(data.profile.status).toBe('inactive');
    expect(data.profile.workerId).toMatch(/^wa-/);
    expect(data.profile.sessionId).toBeTruthy();
  });

  it('rejects non-WhatsApp channel', async () => {
    const req = new NextRequest('http://localhost/api/connectors', {
      method: 'POST',
      body: JSON.stringify({ channel: 'SMS' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

describe('GET /api/connectors', () => {
  it('lists connectors by channel', async () => {
    await Profile.create({
      workerId: 'wa-list-1',
      name: 'WA List',
      channel: 'WHATSAPP',
      status: 'inactive',
      sessionId: 'sess-1',
    });

    const req = new NextRequest('http://localhost/api/connectors?channel=WHATSAPP');
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    const match = data.profiles.find((p: { workerId: string }) => p.workerId === 'wa-list-1');
    expect(match).toBeTruthy();
    expect(match.workerId).toBe('wa-list-1');
  });
});
