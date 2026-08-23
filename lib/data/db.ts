import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

export type Database = NodePgDatabase<typeof schema>;

let pool: Pool | undefined;
let database: Database | undefined;

function connectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  return url;
}

export function getPool(): Pool {
  if (!pool) pool = new Pool({ connectionString: connectionString() });
  return pool;
}

export function getDb(): Database {
  if (!database) database = drizzle(getPool(), { schema });
  return database;
}

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = undefined;
    database = undefined;
  }
}
