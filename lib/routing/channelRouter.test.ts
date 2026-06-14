import { describe, it, expect } from 'vitest';
import { CHANNEL_PRIORITY } from '../connectors/types';

describe('CHANNEL_PRIORITY', () => {
  it('includes all supported channels', () => {
    expect(CHANNEL_PRIORITY).toContain('IMESSAGE');
    expect(CHANNEL_PRIORITY).toContain('WHATSAPP');
    expect(CHANNEL_PRIORITY).toContain('SMS');
    expect(CHANNEL_PRIORITY.length).toBe(3);
  });
});
