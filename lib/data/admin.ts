import { Client } from 'pg';

/**
 * Owner/superuser connection. Used only by migrations, database provisioning,
 * and tests that need to prove what the *application* role cannot do.
 */
export async function withAdminConnection<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const url = process.env.ADMIN_DATABASE_URL;
  if (!url) throw new Error('ADMIN_DATABASE_URL is not set');

  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

/** Connects to the maintenance database to create/drop the app database. */
export async function withMaintenanceConnection<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const url = process.env.ADMIN_DATABASE_URL;
  if (!url) throw new Error('ADMIN_DATABASE_URL is not set');

  const maintenance = new URL(url);
  maintenance.pathname = '/postgres';

  const client = new Client({ connectionString: maintenance.toString() });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

export function appDatabaseName(): string {
  const url = process.env.ADMIN_DATABASE_URL;
  if (!url) throw new Error('ADMIN_DATABASE_URL is not set');
  return new URL(url).pathname.replace(/^\//, '');
}

export function appRoleName(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  return decodeURIComponent(new URL(url).username);
}
