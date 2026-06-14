import { beforeAll, afterAll, afterEach } from 'vitest';
import { connectTestDb, clearTestDb } from './db';

export function useTestDb() {
  beforeAll(async () => {
    await connectTestDb();
  });

  afterEach(async () => {
    await clearTestDb();
  });

  afterAll(async () => {
    // Keep connection alive across test files in single-fork mode
  });
}
