import mongoose from 'mongoose';

let isConnected = false;

/**
 * Connect to MongoDB. Safe to call multiple times — only opens one connection.
 */
export const connectMongo = async (): Promise<void> => {
  if (isConnected) return;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn('⚠️  MONGODB_URI not set — chat conversation storage disabled.');
    return;
  }

  try {
    await mongoose.connect(uri, {
      dbName: process.env.MONGODB_DB_NAME || 'pdfchat',
    });
    isConnected = true;
    console.log('✅ MongoDB connected successfully');
  } catch (err) {
    console.error('❌ MongoDB connection failed:', (err as Error).message);
    console.warn('   Chat history features will be unavailable.');
  }

  mongoose.connection.on('disconnected', () => {
    isConnected = false;
    console.warn('⚠️  MongoDB disconnected');
  });

  mongoose.connection.on('error', (err) => {
    console.error('❌ MongoDB error:', err.message);
  });
};

export { mongoose };
