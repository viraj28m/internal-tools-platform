import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeDb, dal, DalError, verifyAuditChain } from '@/lib/data';
import {
  attemptAuditWriteAsApp,
  corruptAuditRowAsSuperuser,
  forceAuditInsertFailure,
  restoreAuditRowAsSuperuser,
} from '@/lib/data/test-hooks';
import { listUsers, type UserWithRoles } from '@/lib/data/users';
import { MockProcessor, setProcessor } from '@/lib/processor';

type Actor = { id: number };

const processor = new MockProcessor();
let users: Record<string, UserWithRoles>;
let alice: Actor;
let bob: Actor;
let dana: Actor;
let evan: Actor;
let dev: Actor;

async function expectStatus(promise: Promise<unknown>, status: number, match?: RegExp) {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught,
  );
  expect(error, 'expected the call to be rejected').toBeInstanceOf(DalError);
  expect((error as DalError).status).toBe(status);
  if (match) expect((error as DalError).message).toMatch(match);
}

beforeAll(async () => {
  setProcessor(processor);
  users = Object.fromEntries((await listUsers()).map((user) => [user.email.split('@')[0], user]));
  alice = { id: users.alice.id };
  bob = { id: users.bob.id };
  dana = { id: users.dana.id };
  evan = { id: users.evan.id };
  dev = { id: users.dev.id };
});

afterAll(async () => {
  await closeDb();
});

describe('SPEC §7.1 — migrations + seed', () => {
  it('seeds users, cases, refunds and flags', async () => {
    expect(Object.keys(users).sort()).toEqual(['alice', 'bob', 'dana', 'dev', 'evan']);
    expect(users.dev.roles.sort()).toEqual(['admin', 'engineer']);
    expect((await dal.resource('kyc_cases', { actor: alice }).list()).length).toBe(20);
    expect((await dal.resource('refunds', { actor: dana }).list()).length).toBe(10);
    expect((await dal.resource('feature_flags', { actor: dev }).list()).length).toBe(5);
  });

  it('refuses to build a resource without an actor', () => {
    expect(() => dal.resource('kyc_cases', {} as { actor: Actor })).toThrow(/actor is required/i);
  });
});

describe('SPEC §7.3–7.4 — RBAC and legal moves on kyc_cases', () => {
  it('403s when an analyst tries to approve', async () => {
    const [inReview] = await dal.resource('kyc_cases', { actor: bob }).list({ status: 'in_review' });
    await expectStatus(
      dal.resource('kyc_cases', { actor: bob }).transition(inReview.id as number, 'approve'),
      403,
    );
  });

  it('rejects approving a case that is still open', async () => {
    const [open] = await dal.resource('kyc_cases', { actor: alice }).list({ status: 'open' });
    await expectStatus(
      dal.resource('kyc_cases', { actor: alice }).transition(open.id as number, 'approve'),
      409,
      /illegal move/i,
    );
  });

  it('rejects raw status edits through update()', async () => {
    const [open] = await dal.resource('kyc_cases', { actor: alice }).list({ status: 'open' });
    await expectStatus(
      dal.resource('kyc_cases', { actor: alice }).update(open.id as number, { status: 'approved' }),
      400,
      /transition/i,
    );
  });
});

describe('SPEC §7.5–7.6 — maker-checker parking and self-approval', () => {
  let caseId: number;

  it('parks a senior_analyst approval as a pending action', async () => {
    const [inReview] = await dal
      .resource('kyc_cases', { actor: alice })
      .list({ status: 'in_review' });
    caseId = inReview.id as number;

    const after = await dal.resource('kyc_cases', { actor: alice }).transition(caseId, 'approve');
    expect(after.status).toBe('pending_approval');

    const audit = await dal.resource('kyc_cases', { actor: alice }).audit(caseId);
    const requested = audit.at(-1)!;
    expect(requested.action).toBe('transition_requested');
    expect(requested.permissionUsed).toBe('kyc_cases:approve');

    const pending = await dal.pending({ actor: alice }).listAwaiting();
    expect(pending.some((row) => Number(row.recordId) === caseId && row.canApprove === false)).toBe(
      true,
    );
  });

  it('403s when the initiator approves their own action', async () => {
    const pending = await dal.pending({ actor: alice }).listAwaiting();
    const own = pending.find((row) => Number(row.recordId) === caseId)!;
    await expectStatus(dal.pending({ actor: alice }).approve(own.id as number), 403, /maker-checker/i);
  });
});

describe('SPEC §7.7 + §7.11 — approval by another user, then an idempotent payout', () => {
  let refundId: number;
  let pendingId: number;

  it('parks a support_agent submission', async () => {
    const [requested] = await dal.resource('refunds', { actor: evan }).list({ status: 'requested' });
    refundId = requested.id as number;

    const after = await dal.resource('refunds', { actor: evan }).transition(refundId, 'submit');
    expect(after.status).toBe('pending_approval');

    const pending = await dal.pending({ actor: dana }).listAwaiting();
    const item = pending.find((row) => row.resource === 'refunds' && Number(row.recordId) === refundId)!;
    expect(item.canApprove).toBe(true);
    pendingId = item.id as number;
  });

  it('executes the parked transition when a different qualifying user approves', async () => {
    const resolved = await dal.pending({ actor: dana }).approve(pendingId);
    expect(resolved.status).toBe('approved');
    expect(resolved.approverId).toBe(dana.id);
    expect(resolved.resolvedAt).toBeTruthy();

    const refund = await dal.resource('refunds', { actor: dana }).get(refundId);
    expect(refund.status).toBe('approved');

    const audit = await dal.resource('refunds', { actor: dana }).audit(refundId);
    const executed = audit.at(-1)!;
    expect(executed.action).toBe('submit');
    expect(executed.actorId).toBe(dana.id);
    expect(executed.permissionUsed).toBe('refunds:submit');
  });

  it('calls the processor exactly once even when execute is invoked twice', async () => {
    const before = processor.callCount();
    const executed = await dal.resource('refunds', { actor: dana }).transition(refundId, 'execute');
    expect(executed.status).toBe('executed');
    expect(executed.processorRef).toMatch(/^mock_refund:/);

    await expectStatus(
      dal.resource('refunds', { actor: dana }).transition(refundId, 'execute'),
      409,
      /illegal move/i,
    );

    expect(processor.callCount() - before).toBe(1);
    const refund = await dal.resource('refunds', { actor: dana }).get(refundId);
    expect(refund.processorRef).toBe(executed.processorRef);
  });
});

describe('SPEC §7.12 — feature flags', () => {
  it('audits an engineer toggle and 403s an analyst toggle', async () => {
    const [flag] = await dal.resource('feature_flags', { actor: dev }).list();
    const flagId = flag.id as number;

    const toggled = await dal
      .resource('feature_flags', { actor: dev })
      .update(flagId, { enabled: !flag.enabled });
    expect(toggled.enabled).toBe(!flag.enabled);

    const audit = await dal.resource('feature_flags', { actor: dev }).audit(flagId);
    const entry = audit.at(-1)!;
    expect(entry.action).toBe('update');
    expect(entry.permissionUsed).toBe('feature_flags:update');
    expect((entry.before as { enabled: boolean }).enabled).toBe(flag.enabled);
    expect((entry.after as { enabled: boolean }).enabled).toBe(!flag.enabled);

    await expectStatus(
      dal.resource('feature_flags', { actor: bob }).update(flagId, { enabled: true }),
      403,
    );
  });

  it('rejects editing a column the config does not mark editable', async () => {
    const [flag] = await dal.resource('feature_flags', { actor: dev }).list();
    const flagId = flag.id as number;

    await expectStatus(
      dal.resource('feature_flags', { actor: dev }).update(flagId, { key: 'tmp_probe_key' }),
      400,
    );

    const unchanged = await dal.resource('feature_flags', { actor: dev }).get(flagId);
    expect(unchanged.key).toBe(flag.key);
  });
});

describe('SPEC §7.8 — a failing audit insert rolls the mutation back', () => {
  it('leaves neither the record nor the audit log changed', async () => {
    const [flag] = await dal.resource('feature_flags', { actor: dev }).list();
    const flagId = flag.id as number;
    const auditBefore = await dal.resource('feature_flags', { actor: dev }).audit(flagId);

    forceAuditInsertFailure(true);
    try {
      await expect(
        dal.resource('feature_flags', { actor: dev }).update(flagId, { enabled: !flag.enabled }),
      ).rejects.toThrow();
    } finally {
      forceAuditInsertFailure(false);
    }

    const after = await dal.resource('feature_flags', { actor: dev }).get(flagId);
    expect(after.enabled).toBe(flag.enabled);
    expect((await dal.resource('feature_flags', { actor: dev }).audit(flagId)).length).toBe(
      auditBefore.length,
    );
  });
});

describe('SPEC §7.9 — audit_log is append-only for the application role', () => {
  it('cannot UPDATE or DELETE audit rows', async () => {
    expect(await attemptAuditWriteAsApp('update')).toMatch(/permission denied/i);
    expect(await attemptAuditWriteAsApp('delete')).toMatch(/permission denied/i);
  });
});

describe('SPEC §7.10 — hash chain verification', () => {
  it('passes on seeded + mutated data and fails on a tampered row', async () => {
    const clean = await verifyAuditChain();
    expect(clean.ok).toBe(true);

    const targetId = 2;
    const original = await corruptAuditRowAsSuperuser(targetId);
    const broken = await verifyAuditChain();
    expect(broken.ok).toBe(false);
    if (!broken.ok) expect(broken.brokenRowId).toBe(targetId);

    await restoreAuditRowAsSuperuser(targetId, original);
    expect((await verifyAuditChain()).ok).toBe(true);
  });
});
