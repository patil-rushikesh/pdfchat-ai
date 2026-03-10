/**
 * Lightweight migration runner.
 * Reads every *.sql file from the migrations directory in lexicographic order,
 * skips files that have already been applied (tracked in schema_migrations),
 * and runs the rest inside individual transactions so a failure is isolated.
 *
 * Usage (one-off or at startup):
 *   import { runMigrations } from './migrate';
 *   await runMigrations();
 */

import fs from 'fs/promises';
import path from 'path';
import { getPool } from './postgres';

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

export const runMigrations = async (): Promise<void> => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    // Ensure the tracking table exists before we query it
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id         SERIAL       PRIMARY KEY,
        name       VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `);

    // Collect already-applied migration names
    const { rows: applied } = await client.query<{ name: string }>(
      'SELECT name FROM schema_migrations'
    );
    const appliedSet = new Set(applied.map((r) => r.name));

    // Read migration files sorted alphabetically
    const files = (await fs.readdir(MIGRATIONS_DIR))
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      if (appliedSet.has(file)) {
        continue; // already run
      }

      const sql = await fs.readFile(path.join(MIGRATIONS_DIR, file), 'utf-8');

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (name) VALUES ($1)',
          [file]
        );
        await client.query('COMMIT');
        console.log(`✅ Migration applied: ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`❌ Migration failed: ${file}`, (err as Error).message);
        throw err; // halt on any failure
      }
    }
  } finally {
    client.release();
  }
};
