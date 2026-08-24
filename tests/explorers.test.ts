import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeDb, dal, DalError } from '@/lib/data';
import { listUsers, type UserWithRoles } from '@/lib/data/users';

type Actor = { id: number };

let users: Record<string, UserWithRoles>;
let alice: Actor;
let bob: Actor;
let dev: Actor;

beforeAll(async () => {
  users = Object.fromEntries((await listUsers()).map((user) => [user.email.split('@')[0], user]));
  alice = { id: users.alice.id };
  bob = { id: users.bob.id };
  dev = { id: users.dev.id };
});

afterAll(async () => {
  await closeDb();
});

describe('audit explorer', () => {
  it('returns cross-app rows restricted to what the actor may view', async () => {
    const [flag] = await dal.resource('feature_flags', { actor: dev }).list();
    await dal
      .resource('feature_flags', { actor: dev })
      .update(flag.id as number, { enabled: !flag.enabled });

    const devRows = await dal.audit({ actor: dev }).list();
    expect(devRows.length).toBeGreaterThan(0);
    expect(devRows[0].id).toBeGreaterThan(devRows[devRows.length - 1].id);
    expect(devRows.some((row) => row.resource === 'feature_flags')).toBe(true);

    // An analyst sees kyc rows but never the flag panel's history.
    const bobRows = await dal.audit({ actor: bob }).list();
    expect(bobRows.every((row) => row.resource !== 'feature_flags')).toBe(true);
    expect(bobRows.some((row) => row.resource === 'kyc_cases')).toBe(true);
  });

  it('filters by actor, resource and date', async () => {
    const byActor = await dal.audit({ actor: dev }).list({ actorId: dev.id });
    expect(byActor.length).toBeGreaterThan(0);
    expect(byActor.every((row) => row.actorId === dev.id)).toBe(true);

    const byResource = await dal.audit({ actor: dev }).list({ resource: 'feature_flags' });
    expect(byResource.length).toBeGreaterThan(0);
    expect(byResource.every((row) => row.resource === 'feature_flags')).toBe(true);

    const future = new Date(Date.now() + 86_400_000);
    expect(await dal.audit({ actor: dev }).list({ from: future })).toEqual([]);
    expect((await dal.audit({ actor: dev }).list({ to: future })).length).toBeGreaterThan(0);
  });

  it('403s a resource filter the actor may not view', async () => {
    const error = await dal
      .audit({ actor: bob })
      .list({ resource: 'feature_flags' })
      .then(
        () => null,
        (caught: unknown) => caught,
      );
    expect(error).toBeInstanceOf(DalError);
    expect((error as DalError).status).toBe(403);
  });

  it('verifies the hash chain', async () => {
    const verification = await dal.audit({ actor: dev }).verifyChain();
    expect(verification.ok).toBe(true);
    expect(verification.rows).toBeGreaterThan(0);
  });

  it('requires an actor', () => {
    expect(() => dal.audit({} as { actor: Actor })).toThrow(/actor is required/i);
  });
});

describe('access explorer', () => {
  it('reports grants from role_permissions and who holds each role', async () => {
    const matrix = await dal.access({ actor: alice }).matrix();

    expect(matrix.roles).toContain('engineer');
    expect(matrix.resources).toEqual(['feature_flags', 'kyc_cases', 'refunds']);
    expect(matrix.actions).toContain('view');

    const has = (role: string, resource: string, action: string) =>
      matrix.grants.some(
        (grant) => grant.role === role && grant.resource === resource && grant.action === action,
      );
    expect(has('engineer', 'feature_flags', 'update')).toBe(true);
    expect(has('analyst', 'feature_flags', 'update')).toBe(false);

    expect(matrix.holders.engineer.map((holder) => holder.email)).toContain('dev@example.test');
  });

  it('requires an actor', () => {
    expect(() => dal.access({} as { actor: Actor })).toThrow(/actor is required/i);
  });
});
