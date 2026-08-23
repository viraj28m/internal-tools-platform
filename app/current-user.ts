import { actorFromSession, type Session } from '@/lib/auth';
import { getSession } from '@/lib/auth/session';
import type { Actor } from '@/lib/data';

export type CurrentUser = { session: Session; actor: Actor };

/** The signed-in seed user, or null when the switcher has not been used yet. */
export function currentUser(): CurrentUser | null {
  const session = getSession();
  if (!session) return null;
  return { session, actor: actorFromSession(session) };
}
