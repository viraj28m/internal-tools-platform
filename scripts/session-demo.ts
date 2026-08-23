import 'dotenv/config';
import { issueSessionCookie, readSessionCookie } from '@/lib/auth';
import { closeDb } from '@/lib/data';
import { listUsers } from '@/lib/data/users';

/** Proves a session can be obtained for every seed user without any UI. */
async function main() {
  for (const user of await listUsers()) {
    const cookie = issueSessionCookie(user);
    const session = readSessionCookie(cookie);
    if (!session) throw new Error(`Could not read back a session for ${user.email}`);
    console.log(`${session.email} -> sub=${session.sub} roles=[${session.roles.join(', ')}]`);
  }
  await closeDb();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
