import { Pool, PoolClient } from 'pg';

let pool: Pool | null = null;

/**
 * Returns the singleton PostgreSQL connection pool.
 * Lazy-initialized on first call so the app can start without a DB connection.
 */
export const getPool = (): Pool => {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;

    if (connectionString) {
      pool = new Pool({
        connectionString,
        ssl:
          process.env.NODE_ENV === 'production'
            ? { rejectUnauthorized: false }
            : false,
        max: 10,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 5_000,
      });
    } else {
      pool = new Pool({
        host: process.env.PGHOST || 'localhost',
        port: parseInt(process.env.PGPORT || '5432', 10),
        database: process.env.PGDATABASE || 'pdfchat',
        user: process.env.PGUSER || 'postgres',
        password: process.env.PGPASSWORD || '',
        max: 10,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 5_000,
      });
    }

    pool.on('error', (err) => {
      console.error('❌ PostgreSQL pool error:', err.message);
    });
  }

  return pool;
};

/**
 * Test the PostgreSQL connection and log the result.
 */
export const connectPostgres = async (): Promise<void> => {
  if (!process.env.DATABASE_URL && !process.env.PGHOST) {
    console.warn('⚠️  PostgreSQL env vars not set — document metadata storage disabled.');
    return;
  }

  let client: PoolClient | undefined;
  try {
    client = await getPool().connect();
    await client.query('SELECT 1');
    console.log('✅ PostgreSQL connected successfully');
  } catch (err) {
    console.error('❌ PostgreSQL connection failed:', (err as Error).message);
    console.warn('   Document metadata features will be unavailable.');
  } finally {
    client?.release();
  }
};

/**
 * Run a parameterised SQL query against the pool.
 */
export const query = async <T = any>(
  sql: string,
  params?: unknown[]
): Promise<T[]> => {
  const result = await getPool().query(sql, params);
  return result.rows as T[];
};
