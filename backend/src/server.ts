import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '..', '.env') });

import app from './app';
import { connectPostgres } from './db/postgres';
import { runMigrations } from './db/migrate';
import { connectMongo } from './db/mongo';

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  // Boot databases before accepting traffic (non-fatal — they warn & continue)
  await connectMongo();
  await connectPostgres();

  // Run SQL migrations only when PostgreSQL is available
  if (process.env.DATABASE_URL || process.env.PGHOST) {
    try {
      await runMigrations();
    } catch (err) {
      console.error('❌ SQL migrations failed — server will still start:', (err as Error).message);
    }
  }

  const server = app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/health`);
    console.log(`✅ Ready check: http://localhost:${PORT}/ready`);
  });

  // Graceful shutdown
  const shutdown = (signal: string) => {
    console.log(`${signal} received, shutting down gracefully`);
    server.close(() => {
      console.log('Process terminated');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
};

startServer();
// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});