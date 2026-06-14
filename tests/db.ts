import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let mongoServer: MongoMemoryServer | null = null;
let connecting: Promise<void> | null = null;

function syncCachedConnection() {
  (global as { mongoose?: { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null } }).mongoose = {
    conn: mongoose,
    promise: Promise.resolve(mongoose),
  };
}

export async function connectTestDb() {
  if (mongoose.connection.readyState === 1) {
    syncCachedConnection();
    return;
  }
  if (connecting) return connecting;

  connecting = (async () => {
    const externalUri = process.env.TEST_MONGODB_URI || process.env.MONGODB_URI;
    let uri = externalUri;

    if (!uri) {
      try {
        mongoServer = await MongoMemoryServer.create();
        uri = mongoServer.getUri();
      } catch (err) {
        console.warn('MongoMemoryServer unavailable, trying localhost fallback:', err);
        uri = 'mongodb://127.0.0.1:27017/kortex-test';
      }
    }

    process.env.MONGODB_URI = uri;
    await mongoose.connect(uri);
    syncCachedConnection();
  })();

  return connecting;
}

export async function disconnectTestDb() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (mongoServer) {
    await mongoServer.stop();
    mongoServer = null;
  }
  connecting = null;
}

export async function clearTestDb() {
  if (mongoose.connection.readyState !== 1) return;
  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
}
