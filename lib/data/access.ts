import { asc, eq } from 'drizzle-orm';
import { getDb, type Database } from './db';
import { rolePermissions, roles, userRoles, users } from './schema';

export type RoleHolder = { id: number; name: string; email: string };

export type AccessMatrix = {
  roles: string[];
  resources: string[];
  actions: string[];
  /** Grants as stored in role_permissions, the table the DAL enforces from. */
  grants: { role: string; resource: string; action: string }[];
  holders: Record<string, RoleHolder[]>;
};

/** Reads role_permissions and user_roles for the read-only access panel. */
export async function readAccessMatrix(db: Database = getDb()): Promise<AccessMatrix> {
  const grantRows = await db
    .select({ role: roles.name, resource: rolePermissions.resource, action: rolePermissions.action })
    .from(rolePermissions)
    .innerJoin(roles, eq(roles.id, rolePermissions.roleId))
    .orderBy(asc(rolePermissions.resource), asc(rolePermissions.action), asc(roles.name));

  const roleRows = await db.select({ name: roles.name }).from(roles).orderBy(asc(roles.name));

  const holderRows = await db
    .select({ role: roles.name, id: users.id, name: users.name, email: users.email })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .innerJoin(users, eq(users.id, userRoles.userId))
    .orderBy(asc(roles.name), asc(users.id));

  const holders: Record<string, RoleHolder[]> = {};
  for (const role of roleRows) holders[role.name] = [];
  for (const row of holderRows) {
    (holders[row.role] ??= []).push({ id: row.id, name: row.name, email: row.email });
  }

  return {
    roles: roleRows.map((role) => role.name),
    resources: [...new Set(grantRows.map((row) => row.resource))].sort(),
    actions: [...new Set(grantRows.map((row) => row.action))].sort(),
    grants: grantRows,
    holders,
  };
}
