import { createHash } from 'node:crypto';
import { asc, sql } from 'drizzle-orm';
import { getDb, type Database } from './db';
import { auditLog } from './schema';
import { shouldFailAuditInsert } from './test-hooks';

export const GENESIS_HASH = 'genesis:internal-tools-platform';

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

/** Deterministic JSON: object keys sorted, no incidental whitespace. */
export function canonicalJson(value: unknown): string {
  const normalize = (input: unknown): Json => {
    if (input === null || input === undefined) return null;
    if (input instanceof Date) return input.toISOString();
    if (Array.isArray(input)) return input.map(normalize);
    if (typeof input === 'object') {
      const entries = Object.entries(input as Record<string, unknown>)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
      const out: { [key: string]: Json } = {};
      for (const [k, v] of entries) out[k] = normalize(v);
      return out;
    }
    if (typeof input === 'bigint') return input.toString();
    return input as Json;
  };
  return JSON.stringify(normalize(value));
}

export type AuditRowContent = {
  actor_id: number;
  at: string;
  resource: string;
  record_id: string;
  action: string;
  permission_used: string;
  before: unknown;
  after: unknown;
  reason: string | null;
};

/** prev_hash = sha256(previous prev_hash || canonical_json(current row)) */
export function chainHash(previousHash: string, content: AuditRowContent): string {
  return createHash('sha256')
    .update(previousHash + canonicalJson(content))
    .digest('hex');
}

export type AuditEntry = {
  actorId: number;
  resource: string;
  recordId: string | number;
  action: string;
  permissionUsed: string;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
};

/**
 * Appends one audit row inside the caller's transaction. The advisory lock
 * serializes chain writers so prev_hash always references the row that
 * immediately precedes this one.
 */
export async function insertAuditRow(tx: Database, entry: AuditEntry): Promise<void> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext('audit_log_chain'))`);

  const previous = await tx
    .select({ prevHash: auditLog.prevHash })
    .from(auditLog)
    .orderBy(sql`${auditLog.id} desc`)
    .limit(1);
  const previousHash = previous[0]?.prevHash ?? GENESIS_HASH;

  const at = new Date();
  const before = entry.before === undefined ? null : JSON.parse(JSON.stringify(entry.before ?? null));
  const after = entry.after === undefined ? null : JSON.parse(JSON.stringify(entry.after ?? null));

  const content: AuditRowContent = {
    actor_id: entry.actorId,
    at: at.toISOString(),
    resource: entry.resource,
    record_id: String(entry.recordId),
    action: entry.action,
    permission_used: entry.permissionUsed,
    before,
    after,
    reason: entry.reason ?? null,
  };

  if (shouldFailAuditInsert()) {
    // SPEC §7.8: make the database reject the audit insert so the surrounding
    // transaction (mutation included) rolls back.
    await tx.execute(
      sql`insert into audit_log (actor_id, resource, record_id, action, permission_used, prev_hash)
          values (NULL, ${entry.resource}, ${String(entry.recordId)}, ${entry.action}, ${entry.permissionUsed}, ${'x'})`,
    );
  }

  await tx.insert(auditLog).values({
    actorId: entry.actorId,
    at,
    resource: entry.resource,
    recordId: String(entry.recordId),
    action: entry.action,
    permissionUsed: entry.permissionUsed,
    before,
    after,
    reason: entry.reason ?? null,
    prevHash: chainHash(previousHash, content),
  });
}

export type ChainVerification =
  | { ok: true; rows: number }
  | { ok: false; rows: number; brokenRowId: number; expected: string; found: string };

/** Walks audit_log in id order and recomputes the chain. */
export async function verifyAuditChain(db: Database = getDb()): Promise<ChainVerification> {
  const rows = await db.select().from(auditLog).orderBy(asc(auditLog.id));

  let previousHash = GENESIS_HASH;
  for (const row of rows) {
    const content: AuditRowContent = {
      actor_id: row.actorId,
      at: row.at.toISOString(),
      resource: row.resource,
      record_id: row.recordId,
      action: row.action,
      permission_used: row.permissionUsed,
      before: row.before ?? null,
      after: row.after ?? null,
      reason: row.reason ?? null,
    };
    const expected = chainHash(previousHash, content);
    if (expected !== row.prevHash) {
      return { ok: false, rows: rows.length, brokenRowId: row.id, expected, found: row.prevHash };
    }
    previousHash = row.prevHash;
  }

  return { ok: true, rows: rows.length };
}
