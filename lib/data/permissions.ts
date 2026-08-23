import { and, eq, inArray } from 'drizzle-orm';
import type { Database } from './db';
import { rolePermissions, roles, userRoles } from './schema';

export async function actorRoleNames(tx: Database, actorId: number): Promise<string[]> {
  const rows = await tx
    .select({ name: roles.name })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(eq(userRoles.userId, actorId));
  return rows.map((r) => r.name);
}

/** RBAC lookup: does any role held by the actor grant (resource, action)? */
export async function hasPermission(
  tx: Database,
  actorId: number,
  resource: string,
  action: string,
): Promise<boolean> {
  const actorRoleIds = await tx
    .select({ roleId: userRoles.roleId })
    .from(userRoles)
    .where(eq(userRoles.userId, actorId));
  if (actorRoleIds.length === 0) return false;

  const granted = await tx
    .select({ roleId: rolePermissions.roleId })
    .from(rolePermissions)
    .where(
      and(
        inArray(
          rolePermissions.roleId,
          actorRoleIds.map((r) => r.roleId),
        ),
        eq(rolePermissions.resource, resource),
        eq(rolePermissions.action, action),
      ),
    )
    .limit(1);

  return granted.length > 0;
}
