import { createHmac, timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE = 'session';

/**
 * Shaped like a token an IdP would issue. Roles are informational for the UI;
 * the DAL always re-reads them from the database before enforcing anything.
 */
export type Session = {
  sub: string;
  email: string;
  name: string;
  roles: string[];
  iat: number;
};

export type SessionUser = { id: number; email: string; name: string; roles: string[] };

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value) throw new Error('SESSION_SECRET is not set');
  return value;
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('base64url');
}

export function issueSessionCookie(user: SessionUser): string {
  const session: Session = {
    sub: String(user.id),
    email: user.email,
    name: user.name,
    roles: user.roles,
    iat: Date.now(),
  };
  const payload = Buffer.from(JSON.stringify(session)).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function readSessionCookie(cookieValue: string | undefined): Session | null {
  if (!cookieValue) return null;
  const [payload, signature] = cookieValue.split('.');
  if (!payload || !signature) return null;

  const expected = Buffer.from(sign(payload));
  const found = Buffer.from(signature);
  if (expected.length !== found.length || !timingSafeEqual(expected, found)) return null;

  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString()) as Session;
  } catch {
    return null;
  }
}

/** The actor shape the DAL expects. */
export function actorFromSession(session: Session): { id: number } {
  return { id: Number(session.sub) };
}
