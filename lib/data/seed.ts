import { resourceConfigs } from '@/config';
import { closeDb, getDb } from './db';
import {
  featureFlags,
  kycCases,
  refunds,
  rolePermissions,
  roles,
  userRoles,
  users,
} from './schema';

const ROLE_NAMES = [
  'analyst',
  'senior_analyst',
  'support_agent',
  'support_lead',
  'engineer',
  'admin',
] as const;

const SEED_USERS = [
  { email: 'alice@example.test', name: 'Alice Example', roles: ['senior_analyst'] },
  // Second senior_analyst so maker-checker approvals work from a clean seed.
  { email: 'sara@example.test', name: 'Sara Example', roles: ['senior_analyst'] },
  { email: 'bob@example.test', name: 'Bob Example', roles: ['analyst'] },
  { email: 'dana@example.test', name: 'Dana Example', roles: ['support_lead'] },
  { email: 'evan@example.test', name: 'Evan Example', roles: ['support_agent'] },
  { email: 'dev@example.test', name: 'Dev Example', roles: ['engineer', 'admin'] },
];

const KYC_STATUSES = ['open', 'in_review', 'approved', 'rejected'];
const REFUND_STATUSES = ['requested', 'approved', 'executed', 'rejected'];

/** (resource, action) grants implied by the resource configs. */
export function permissionMatrix(): { role: string; resource: string; action: string }[] {
  const grants: { role: string; resource: string; action: string }[] = [];
  for (const [resource, config] of Object.entries(resourceConfigs)) {
    for (const [action, allowed] of Object.entries(config.permissions)) {
      for (const role of allowed) grants.push({ role, resource, action });
    }
    for (const [action, transition] of Object.entries(config.transitions)) {
      for (const role of transition.allowedRoles) grants.push({ role, resource, action });
    }
  }
  return grants;
}

export async function seed(): Promise<void> {
  const db = getDb();

  await db.transaction(async (tx) => {
    const insertedRoles = await tx
      .insert(roles)
      .values(ROLE_NAMES.map((name) => ({ name })))
      .returning();
    const roleIds = new Map(insertedRoles.map((role) => [role.name, role.id]));

    const insertedUsers = await tx
      .insert(users)
      .values(SEED_USERS.map(({ email, name }) => ({ email, name })))
      .returning();
    const userIds = new Map(insertedUsers.map((user) => [user.email, user.id]));

    await tx.insert(userRoles).values(
      SEED_USERS.flatMap((user) =>
        user.roles.map((role) => ({
          userId: userIds.get(user.email)!,
          roleId: roleIds.get(role)!,
        })),
      ),
    );

    await tx.insert(rolePermissions).values(
      permissionMatrix().map(({ role, resource, action }) => ({
        roleId: roleIds.get(role)!,
        resource,
        action,
      })),
    );

    await tx.insert(kycCases).values(
      Array.from({ length: 20 }, (_, i) => ({
        customerName: `Test Customer ${4400 + i}`,
        riskScore: (i * 7) % 100,
        status: KYC_STATUSES[i % KYC_STATUSES.length],
        notes: `Synthetic case ${i + 1} for the prototype`,
      })),
    );

    await tx.insert(refunds).values(
      Array.from({ length: 10 }, (_, i) => {
        const status = REFUND_STATUSES[i % REFUND_STATUSES.length];
        return {
          customerName: `Test Customer ${5500 + i}`,
          orderRef: `TEST-ORDER-${9000 + i}`,
          amountCents: 1500 + i * 1375,
          currency: 'USD',
          reason: `Synthetic refund ${i + 1}`,
          status,
          processorRef: status === 'executed' ? `mock_seeded_${i}` : null,
        };
      }),
    );

    await tx.insert(featureFlags).values([
      { key: 'new_kyc_queue', description: 'Test flag: new KYC queue layout', enabled: true },
      { key: 'refund_bulk_actions', description: 'Test flag: bulk refund actions', enabled: false },
      { key: 'audit_explorer_v2', description: 'Test flag: audit explorer rewrite', enabled: false },
      { key: 'dark_mode', description: 'Test flag: dark mode', enabled: true },
      { key: 'maintenance_banner', description: 'Test flag: maintenance banner', enabled: false },
    ]);
  });

  await closeDb();
}
