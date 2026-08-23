import { and, desc, eq, type SQL } from 'drizzle-orm';
import { getResourceConfig, type ResourceConfig, type ResourceName } from '@/config';
import { getProcessor } from '@/lib/processor';
import { insertAuditRow } from './audit';
import { getDb, type Database } from './db';
import { badRequest, conflict, DalError, forbidden, notFound } from './errors';
import { actorRoleNames, hasPermission } from './permissions';
import { auditLog, pendingActions, tables } from './schema';

export type Actor = { id: number };

export type { Database } from './db';
export { closeDb } from './db';
export { DalError } from './errors';
export { verifyAuditChain, type ChainVerification } from './audit';
export { forceAuditInsertFailure } from './test-hooks';

const PENDING_STATUS = 'pending_approval';

type Row = Record<string, unknown>;

function tableFor(resource: ResourceName) {
  const table = tables[resource as keyof typeof tables];
  if (!table) throw badRequest(`Unknown resource '${resource}'`);
  return table;
}

async function requirePermission(
  tx: Database,
  actor: Actor,
  resource: string,
  action: string,
): Promise<string> {
  if (!(await hasPermission(tx, actor.id, resource, action))) {
    throw forbidden(`Actor ${actor.id} lacks permission ${resource}:${action}`);
  }
  return `${resource}:${action}`;
}

async function requireRole(
  tx: Database,
  actor: Actor,
  allowedRoles: string[],
  context: string,
): Promise<void> {
  const held = await actorRoleNames(tx, actor.id);
  if (!held.some((role) => allowedRoles.includes(role))) {
    throw forbidden(`Actor ${actor.id} may not ${context} (roles: ${held.join(', ') || 'none'})`);
  }
}

/**
 * Column configs are written in the database's snake_case, while callers pass
 * Drizzle's camelCase field names; both spellings map to the same column.
 */
function isEditable(config: ResourceConfig, column: string): boolean {
  const snake = column.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
  return Boolean(config.columns[column]?.editable ?? config.columns[snake]?.editable);
}

async function loadRow(tx: Database, resource: ResourceName, id: number): Promise<Row> {
  const table = tableFor(resource);
  const rows = await tx
    .select()
    .from(table)
    .where(eq((table as unknown as { id: never }).id, id as never))
    .limit(1);
  const row = rows[0] as Row | undefined;
  if (!row) throw notFound(`${resource} ${id} not found`);
  return row;
}

/** Applies the effect declared on a transition, e.g. the refund payout. */
async function applyEffect(
  effect: string,
  resource: ResourceName,
  row: Row,
): Promise<Record<string, unknown>> {
  if (effect !== 'processor.executeRefund') throw badRequest(`Unknown effect '${effect}'`);
  if (resource !== 'refunds') throw badRequest(`Effect '${effect}' is only valid for refunds`);

  // Never pay twice for the same refund, whatever the caller does.
  if (row.processorRef) return { processorRef: row.processorRef as string };

  const { processorRef } = await getProcessor().executeRefund({
    orderRef: String(row.orderRef),
    amountCents: Number(row.amountCents),
    currency: String(row.currency),
    idempotencyKey: `refund:${row.id}`,
  });
  return { processorRef };
}

type TransitionExecution = {
  tx: Database;
  actor: Actor;
  resource: ResourceName;
  config: ResourceConfig;
  name: string;
  id: number;
  permissionUsed: string;
  reason?: string | null;
};

/**
 * Writes the status change (plus any effect) and its audit row. Callers have
 * already checked permission, legality of the move, and approval routing.
 */
async function executeTransition({
  tx,
  actor,
  resource,
  config,
  name,
  id,
  permissionUsed,
  reason,
}: TransitionExecution): Promise<Row> {
  const transition = config.transitions[name];
  const before = await loadRow(tx, resource, id);

  const patch: Record<string, unknown> = { status: transition.to, updatedAt: new Date() };
  if (transition.effect) Object.assign(patch, await applyEffect(transition.effect, resource, before));

  const table = tableFor(resource);
  const updated = await tx
    .update(table)
    .set(patch as never)
    .where(eq((table as unknown as { id: never }).id, id as never))
    .returning();
  const after = updated[0] as Row;

  await insertAuditRow(tx, {
    actorId: actor.id,
    resource,
    recordId: id,
    action: name,
    permissionUsed,
    before,
    after,
    reason: reason ?? null,
  });

  return after;
}

class ResourceApi {
  constructor(
    private readonly resource: ResourceName,
    private readonly actor: Actor,
    private readonly config: ResourceConfig,
  ) {}

  private table() {
    return tableFor(this.resource);
  }

  async list(filters?: Record<string, string | number | boolean>): Promise<Row[]> {
    const db = getDb();
    await requirePermission(db, this.actor, this.resource, 'view');

    const table = this.table() as unknown as Record<string, never>;
    const conditions: SQL[] = [];
    for (const [key, value] of Object.entries(filters ?? {})) {
      const column = table[key];
      if (!column) throw badRequest(`Unknown filter column '${key}'`);
      conditions.push(eq(column, value as never));
    }

    const query = getDb().select().from(this.table());
    const rows = conditions.length ? await query.where(and(...conditions)) : await query;
    return rows as Row[];
  }

  async get(id: number): Promise<Row> {
    const db = getDb();
    await requirePermission(db, this.actor, this.resource, 'view');
    return loadRow(db, this.resource, id);
  }

  /** Audit trail for one record, for the AuditPanel and the explorer. */
  async audit(id: number): Promise<Row[]> {
    const db = getDb();
    await requirePermission(db, this.actor, this.resource, 'view');
    const rows = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.resource, this.resource), eq(auditLog.recordId, String(id))))
      .orderBy(auditLog.id);
    return rows as Row[];
  }

  async create(data: Record<string, unknown>): Promise<Row> {
    return getDb().transaction(async (tx) => {
      const permissionUsed = await requirePermission(tx, this.actor, this.resource, 'create');

      const inserted = await tx
        .insert(this.table())
        .values(data as never)
        .returning();
      const after = inserted[0] as Row;

      await insertAuditRow(tx, {
        actorId: this.actor.id,
        resource: this.resource,
        recordId: after.id as number,
        action: 'create',
        permissionUsed,
        before: null,
        after,
      });

      return after;
    });
  }

  async update(id: number, patch: Record<string, unknown>): Promise<Row> {
    if ('status' in patch) {
      throw badRequest('Status changes must go through transition()');
    }
    if (Object.keys(patch).length === 0) throw badRequest('Empty patch');

    for (const column of Object.keys(patch)) {
      if (!isEditable(this.config, column)) {
        throw badRequest(`Column '${column}' is not editable on ${this.resource}`);
      }
    }

    return getDb().transaction(async (tx) => {
      const permissionUsed = await requirePermission(tx, this.actor, this.resource, 'update');
      const before = await loadRow(tx, this.resource, id);

      const table = this.table();
      const values: Record<string, unknown> = { ...patch };
      if ('updatedAt' in before) values.updatedAt = new Date();

      const updated = await tx
        .update(table)
        .set(values as never)
        .where(eq((table as unknown as { id: never }).id, id as never))
        .returning();
      const after = updated[0] as Row;

      await insertAuditRow(tx, {
        actorId: this.actor.id,
        resource: this.resource,
        recordId: id,
        action: 'update',
        permissionUsed,
        before,
        after,
      });

      return after;
    });
  }

  async transition(id: number, name: string, reason?: string): Promise<Row> {
    const transition = this.config.transitions[name];
    if (!transition) throw badRequest(`Unknown transition '${name}' for ${this.resource}`);

    return getDb().transaction(async (tx) => {
      const permissionUsed = await requirePermission(tx, this.actor, this.resource, name);
      await requireRole(tx, this.actor, transition.allowedRoles, `${name} ${this.resource}`);

      const before = await loadRow(tx, this.resource, id);
      const currentStatus = String(before.status);
      if (!transition.from.includes(currentStatus)) {
        throw conflict(
          `Illegal move: ${this.resource} ${id} is '${currentStatus}', ${name} requires one of ${transition.from.join(', ')}`,
        );
      }

      if (!transition.requiresApproval) {
        return executeTransition({
          tx,
          actor: this.actor,
          resource: this.resource,
          config: this.config,
          name,
          id,
          permissionUsed,
          reason,
        });
      }

      // Maker-checker: park the action, park the record, audit the request.
      const table = this.table();
      const parked = await tx
        .update(table)
        .set({ status: PENDING_STATUS, updatedAt: new Date() } as never)
        .where(eq((table as unknown as { id: never }).id, id as never))
        .returning();
      const after = parked[0] as Row;

      await tx.insert(pendingActions).values({
        resource: this.resource,
        recordId: String(id),
        action: name,
        payload: { previousStatus: currentStatus, reason: reason ?? null },
        initiatorId: this.actor.id,
        status: 'pending',
      });

      await insertAuditRow(tx, {
        actorId: this.actor.id,
        resource: this.resource,
        recordId: id,
        action: 'transition_requested',
        permissionUsed,
        before,
        after,
        reason: reason ?? null,
      });

      return after;
    });
  }
}

export type PendingItem = Row & { canApprove: boolean };

class PendingApi {
  constructor(private readonly actor: Actor) {}

  /** Pending actions the actor may see; self-initiated ones are unapprovable. */
  async listAwaiting(): Promise<PendingItem[]> {
    const db = getDb();
    const rows = await db
      .select()
      .from(pendingActions)
      .where(eq(pendingActions.status, 'pending'))
      .orderBy(desc(pendingActions.id));

    const visible: PendingItem[] = [];
    for (const row of rows) {
      if (!(await hasPermission(db, this.actor.id, row.resource, 'view'))) continue;
      visible.push({ ...(row as Row), canApprove: row.initiatorId !== this.actor.id });
    }
    return visible;
  }

  async approve(pendingId: number): Promise<Row> {
    return this.resolve(pendingId, 'approve');
  }

  async reject(pendingId: number): Promise<Row> {
    return this.resolve(pendingId, 'reject');
  }

  private async resolve(pendingId: number, decision: 'approve' | 'reject'): Promise<Row> {
    return getDb().transaction(async (tx) => {
      const found = await tx
        .select()
        .from(pendingActions)
        .where(eq(pendingActions.id, pendingId))
        .for('update')
        .limit(1);
      const pending = found[0];
      if (!pending) throw notFound(`Pending action ${pendingId} not found`);
      if (pending.status !== 'pending') {
        throw conflict(`Pending action ${pendingId} is already ${pending.status}`);
      }
      if (pending.initiatorId === this.actor.id) {
        throw forbidden('Maker-checker: the approver must differ from the initiator');
      }

      const resource = pending.resource as ResourceName;
      const config = getResourceConfig(resource);
      const transition = config.transitions[pending.action];
      if (!transition) throw badRequest(`Unknown transition '${pending.action}' for ${resource}`);

      // Permission is re-checked now, not at initiation time.
      const permissionUsed = await requirePermission(tx, this.actor, resource, pending.action);
      await requireRole(tx, this.actor, transition.allowedRoles, `${decision} ${pending.action}`);

      const recordId = Number(pending.recordId);

      if (decision === 'reject') {
        const record = await loadRow(tx, resource, recordId);
        await insertAuditRow(tx, {
          actorId: this.actor.id,
          resource,
          recordId,
          action: 'transition_rejected',
          permissionUsed,
          before: record,
          after: record,
          reason: `Rejected pending action ${pendingId} (${pending.action})`,
        });
      } else {
        // Post-approval status: the approval itself resolves the parked state.
        const resolvedStatus = transition.to === PENDING_STATUS ? 'approved' : transition.to;
        await executeTransition({
          tx,
          actor: this.actor,
          resource,
          config: {
            ...config,
            transitions: {
              ...config.transitions,
              [pending.action]: { ...transition, to: resolvedStatus },
            },
          },
          name: pending.action,
          id: recordId,
          permissionUsed,
          reason: `Approved pending action ${pendingId}`,
        });
      }

      const resolved = await tx
        .update(pendingActions)
        .set({
          status: decision === 'approve' ? 'approved' : 'rejected',
          approverId: this.actor.id,
          resolvedAt: new Date(),
        })
        .where(eq(pendingActions.id, pendingId))
        .returning();

      return resolved[0] as Row;
    });
  }
}

function requireActor(options: { actor?: Actor }): Actor {
  const actor = options?.actor;
  if (!actor || typeof actor.id !== 'number') {
    throw badRequest('An actor is required for every DAL operation');
  }
  return actor;
}

export const dal = {
  resource(resource: ResourceName, options: { actor: Actor }): ResourceApi {
    const actor = requireActor(options);
    return new ResourceApi(resource, actor, getResourceConfig(resource));
  },
  pending(options: { actor: Actor }): PendingApi {
    return new PendingApi(requireActor(options));
  },
};

/** Convenience for callers that want the DAL's HTTP-ish status codes. */
export function statusForError(error: unknown): number {
  return error instanceof DalError ? error.status : 500;
}
