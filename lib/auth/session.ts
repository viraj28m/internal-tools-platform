import { cookies } from 'next/headers';
import { readSessionCookie, SESSION_COOKIE, type Session } from './index';

/** Current session for the request, or null when nobody is signed in. */
export function getSession(): Session | null {
  return readSessionCookie(cookies().get(SESSION_COOKIE)?.value);
}
