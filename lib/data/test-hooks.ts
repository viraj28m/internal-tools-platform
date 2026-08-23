import { sql } from 'drizzle-orm';
import { withAdminConnection } from './admin';
import { getDb } from './db';

/**
 * Test seams used by the acceptance suite (SPEC §7). None of these are
 * reachable from application code paths.
 */
let failNextAuditInsert = false;

export function forceAuditInsertFailure(enabled: boolean): void {
  failNextAuditInsert = enabled;
}

export function shouldFailAuditInsert(): boolean {
  return failNextAuditInsert;
}

/** SPEC §7.9: run a write against audit_log as the application role. */
export async function attemptAuditWriteAsApp(kind: 'update' | 'delete'): Promise<string | null> {
  const db = getDb();
  try {
    if (kind === 'update') {
      await db.execute(sql`update audit_log set reason = 'tampered' where id = 1`);
    } else {
      await db.execute(sql`delete from audit_log where id = 1`);
    }
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

/** SPEC §7.10: tamper with a row through a superuser connection. */
export async function corruptAuditRowAsSuperuser(id: number): Promise<string | null> {
  return withAdminConnection(async (client) => {
    const before = await client.query<{ reason: string | null }>(
      'select reason from audit_log where id = $1',
      [id],
    );
    await client.query('update audit_log set reason = $1 where id = $2', ['tampered by test', id]);
    return before.rows[0]?.reason ?? null;
  });
}

export async function restoreAuditRowAsSuperuser(id: number, reason: string | null): Promise<void> {
  await withAdminConnection(async (client) => {
    await client.query('update audit_log set reason = $1 where id = $2', [reason, id]);
  });
}
