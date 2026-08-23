import { eq } from 'drizzle-orm';
import { getDb } from './db';
import { roles, userRoles, users } from './schema';

export type UserWithRoles = { id: number; email: string; name: string; roles: string[] };

export async function listUsers(): Promise<UserWithRoles[]> {
  const db = getDb();
  const rows = await db
    .select({ id: users.id, email: users.email, name: users.name, role: roles.name })
    .from(users)
    .leftJoin(userRoles, eq(userRoles.userId, users.id))
    .leftJoin(roles, eq(roles.id, userRoles.roleId))
    .orderBy(users.id);

  const byId = new Map<number, UserWithRoles>();
  for (const row of rows) {
    const user = byId.get(row.id) ?? { id: row.id, email: row.email, name: row.name, roles: [] };
    if (row.role) user.roles.push(row.role);
    byId.set(row.id, user);
  }
  return [...byId.values()];
}

export async function findUserByEmail(email: string): Promise<UserWithRoles | null> {
  const all = await listUsers();
  return all.find((user) => user.email === email) ?? null;
}
