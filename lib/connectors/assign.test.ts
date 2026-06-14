import { describe, it, expect } from 'vitest';
import { findAvailableConnector, assignConnectorToMessage } from './assign';
import { Profile } from '../../models/Profile';
import { useTestDb } from '../../tests/with-db';

useTestDb();

describe('assignConnectorToMessage', () => {
  it('increments daily count', async () => {
    const profile = await Profile.create({
      workerId: 'test-worker',
      name: 'Test',
      channel: 'IMESSAGE',
      status: 'active',
      assignedLocationId: 'loc-1',
      dailyCount: 5,
      dailyLimit: 50,
    });

    const result = await assignConnectorToMessage(profile);
    expect(result.workerId).toBe('test-worker');

    const updated = await Profile.findOne({ workerId: 'test-worker' });
    expect(updated?.dailyCount).toBe(6);
  });
});

describe('findAvailableConnector', () => {
  it('returns connector under daily limit', async () => {
    await Profile.create({
      workerId: 'wa-1',
      name: 'WA',
      channel: 'WHATSAPP',
      status: 'active',
      assignedLocationId: 'loc-1',
      dailyCount: 10,
      dailyLimit: 50,
    });

    const connector = await findAvailableConnector('loc-1', 'WHATSAPP');
    expect(connector?.workerId).toBe('wa-1');
  });

  it('returns null when all connectors exceed daily limit', async () => {
    await Profile.create({
      workerId: 'wa-full',
      name: 'WA Full',
      channel: 'WHATSAPP',
      status: 'active',
      assignedLocationId: 'loc-1',
      dailyCount: 50,
      dailyLimit: 50,
    });

    const connector = await findAvailableConnector('loc-1', 'WHATSAPP');
    expect(connector).toBeNull();
  });

  it('returns null for unassigned location', async () => {
    await Profile.create({
      workerId: 'wa-other',
      name: 'WA Other',
      channel: 'WHATSAPP',
      status: 'active',
      assignedLocationId: 'other-loc',
      dailyCount: 0,
      dailyLimit: 50,
    });

    const connector = await findAvailableConnector('loc-1', 'WHATSAPP');
    expect(connector).toBeNull();
  });
});
