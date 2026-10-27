import mongoose from 'mongoose';

/**
 * Connect to MongoDB. Exits the process on an initial connection failure so the
 * server never starts up in a half-working state.
 */
export async function connectDB(uri) {
  if (!uri) {
    throw new Error('MONGO_URI is not set. Copy server/.env.example to server/.env.');
  }

  mongoose.set('strictQuery', true);

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
    });
    console.log(`[db] connected to ${mongoose.connection.name}`);
  } catch (err) {
    console.error('[db] initial connection error:', err.message);
    throw err;
  }

  mongoose.connection.on('error', (err) => {
    console.error('[db] connection error:', err.message);
  });
  mongoose.connection.on('disconnected', () => {
    console.warn('[db] disconnected');
  });

  return mongoose.connection;
}
