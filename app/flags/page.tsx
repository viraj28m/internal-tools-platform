import { getResourceConfig } from '@/config';
import { dal, statusForError } from '@/lib/data';
import { FlagToggle } from '../components/FlagToggle';
import { ResourceTable } from '../components/ResourceTable';
import type { Row } from '../components/format';
import { currentUser } from '../current-user';

export const dynamic = 'force-dynamic';

const config = getResourceConfig('feature_flags');

export default async function FlagsPage() {
  const user = currentUser();
  if (!user) return <p className="text-sm">Pick a user in the top nav to open the flag panel.</p>;

  let rows: Row[];
  try {
    rows = await dal.resource('feature_flags', { actor: user.actor }).list();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return (
      <p className="text-sm text-red-700" data-testid="flags-error">
        {statusForError(error)} — {message}
      </p>
    );
  }

  // Reflects what the DAL would allow; the DAL still enforces it on submit.
  const allowedRoles = config.permissions.update ?? [];
  const mayUpdate = allowedRoles.some((role) => user.session.roles.includes(role));
  const disabledReason = mayUpdate
    ? null
    : `Your role (${user.session.roles.join(', ') || 'none'}) may not update flags; requires ${allowedRoles.join(' or ')}`;

  return (
    <>
      <h1 className="text-xl font-semibold">{config.displayName}</h1>
      <p className="text-sm text-gray-600">
        Toggling a flag is a plain audited update — every toggle writes an audit row with the
        permission that allowed it.
      </p>
      <ResourceTable
        config={config}
        rows={rows.sort((a, b) => Number(a.id) - Number(b.id))}
        hrefFor={(row) => `/flags/${String(row.id)}`}
        renderCell={(column, row) =>
          column === 'enabled' ? (
            <FlagToggle
              key={`${user.session.sub}-${String(row.id)}`}
              id={Number(row.id)}
              flagKey={String(row.key)}
              enabled={Boolean(row.enabled)}
              disabledReason={disabledReason}
            />
          ) : null
        }
      />
    </>
  );
}
