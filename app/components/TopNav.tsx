import Link from 'next/link';
import { listUsers } from '@/lib/data/users';
import { currentUser } from '../current-user';
import { UserSwitcher } from './UserSwitcher';

export async function TopNav() {
  const user = currentUser();
  const users = await listUsers();

  return (
    <header className="flex flex-wrap items-center gap-6 bg-gray-800 px-6 py-3 text-white">
      <span className="font-semibold">Internal Tools</span>
      <nav className="flex gap-4 text-sm">
        <Link href="/kyc" className="underline">
          KYC
        </Link>
        <Link href="/approvals" className="underline">
          Approvals
        </Link>
      </nav>
      <div className="ml-auto">
        <UserSwitcher users={users} currentEmail={user?.session.email ?? null} />
      </div>
    </header>
  );
}
