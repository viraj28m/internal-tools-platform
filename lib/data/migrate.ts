import path from 'node:path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

/** Runs the checked-in migrations as the database owner. */
export async function runMigrations(): Promise<void> {
  const url = process.env.ADMIN_DATABASE_URL;
  if (!url) throw new Error('ADMIN_DATABASE_URL is not set');

  const pool = new Pool({ connectionString: url });
  try {
    await migrate(drizzle(pool), { migrationsFolder: path.join(process.cwd(), 'drizzle') });
  } finally {
    await pool.end();
  }
}
