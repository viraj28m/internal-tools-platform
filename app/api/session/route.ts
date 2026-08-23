import { NextResponse } from 'next/server';
import { issueSessionCookie, SESSION_COOKIE } from '@/lib/auth';
import { getSession } from '@/lib/auth/session';
import { findUserByEmail, listUsers } from '@/lib/data/users';

export const dynamic = 'force-dynamic';

/** Current session plus the users the switcher can choose from. */
export async function GET() {
  return NextResponse.json({ session: getSession(), users: await listUsers() });
}

/** User switcher: fake sign-in as a seed user. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { email?: string } | null;
  if (!body?.email) {
    return NextResponse.json({ error: 'email is required' }, { status: 400 });
  }

  const user = await findUserByEmail(body.email);
  if (!user) {
    return NextResponse.json({ error: `Unknown user '${body.email}'` }, { status: 404 });
  }

  const response = NextResponse.json({ user });
  response.cookies.set(SESSION_COOKIE, issueSessionCookie(user), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });
  return response;
}
