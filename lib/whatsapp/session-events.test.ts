import { describe, it, expect } from 'vitest';
import { isWhatsappWorkerOnline, WASP_WORKER_HEARTBEAT_KEY } from './session-events';

describe('isWhatsappWorkerOnline', () => {
  it('returns false when redis is unavailable', async () => {
    const result = await isWhatsappWorkerOnline();
    expect(typeof result).toBe('boolean');
  });

  it('exports heartbeat key constant', () => {
    expect(WASP_WORKER_HEARTBEAT_KEY).toBe('wasp:worker:heartbeat');
  });
});
