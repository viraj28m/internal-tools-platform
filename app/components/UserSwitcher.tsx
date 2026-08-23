'use client';

import { useRouter } from 'next/navigation';
import { useState, type ChangeEvent } from 'react';

type Option = { email: string; name: string; roles: string[] };

type Props = { users: Option[]; currentEmail: string | null };

/** Fake sign-in: POSTs to the session route, which sets the signed cookie. */
export function UserSwitcher({ users, currentEmail }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onChange(event: ChangeEvent<HTMLSelectElement>) {
    const email = event.target.value;
    if (!email) return;
    setBusy(true);
    await fetch('/api/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-gray-300">Acting as</span>
      <select
        className="rounded border border-gray-500 bg-white px-2 py-1 text-gray-900"
        value={currentEmail ?? ''}
        onChange={onChange}
        disabled={busy}
        data-testid="user-switcher"
      >
        <option value="">— pick a user —</option>
        {users.map((user) => (
          <option key={user.email} value={user.email}>
            {user.name} ({user.roles.join(', ') || 'no roles'})
          </option>
        ))}
      </select>
    </label>
  );
}
