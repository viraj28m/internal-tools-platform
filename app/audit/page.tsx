import { resourceConfigs, type ResourceName } from '@/config';
import { dal, statusForError, type AuditRow } from '@/lib/data';
import { listUsers } from '@/lib/data/users';
import { VerifyChainButton } from '../components/VerifyChainButton';
import { currentUser } from '../current-user';

export const dynamic = 'force-dynamic';

type SearchParams = { actor?: string; resource?: string; from?: string; to?: string };

/** Treats a yyyy-mm-dd input as an inclusive UTC day boundary. */
function dayBoundary(value: string | undefined, edge: 'start' | 'end'): Date | undefined {
  if (!value) return undefined;
  const suffix = edge === 'start' ? 'T00:00:00.000Z' : 'T23:59:59.999Z';
  const date = new Date(`${value}${suffix}`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export default async function AuditPage({ searchParams }: { searchParams: SearchParams }) {
  const user = currentUser();
  if (!user) return <p className="text-sm">Pick a user in the top nav to open the audit log.</p>;

  const actorId = searchParams.actor ? Number(searchParams.actor) : undefined;
  const resource = searchParams.resource || undefined;
  const filters = {
    ...(actorId !== undefined && !Number.isNaN(actorId) ? { actorId } : {}),
    ...(resource ? { resource } : {}),
    ...(dayBoundary(searchParams.from, 'start')
      ? { from: dayBoundary(searchParams.from, 'start') }
      : {}),
    ...(dayBoundary(searchParams.to, 'end') ? { to: dayBoundary(searchParams.to, 'end') } : {}),
  };

  const users = await listUsers();
  const names = new Map(users.map((seedUser) => [seedUser.id, seedUser.name]));

  let rows: AuditRow[] | null = null;
  let error: string | null = null;
  try {
    rows = await dal.audit({ actor: user.actor }).list(filters);
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : 'Unexpected error';
    error = `${statusForError(caught)} — ${message}`;
  }

  return (
    <>
      <h1 className="text-xl font-semibold">Audit Explorer</h1>
      <p className="text-sm text-gray-600">
        Cross-app, append-only history. Rows are restricted to the resources your role may view.
      </p>

      <VerifyChainButton />

      <form method="get" className="flex flex-wrap items-end gap-3 rounded border border-gray-300 p-3">
        <label className="text-sm">
          <span className="block text-gray-600">Actor</span>
          <select name="actor" defaultValue={searchParams.actor ?? ''} className="border px-2 py-1">
            <option value="">any</option>
            {users.map((seedUser) => (
              <option key={seedUser.id} value={seedUser.id}>
                {seedUser.name} ({seedUser.email})
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="block text-gray-600">Resource</span>
          <select
            name="resource"
            defaultValue={searchParams.resource ?? ''}
            className="border px-2 py-1"
          >
            <option value="">any</option>
            {(Object.keys(resourceConfigs) as ResourceName[]).map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="block text-gray-600">From (UTC)</span>
          <input
            type="date"
            name="from"
            defaultValue={searchParams.from ?? ''}
            className="border px-2 py-1"
          />
        </label>
        <label className="text-sm">
          <span className="block text-gray-600">To (UTC)</span>
          <input
            type="date"
            name="to"
            defaultValue={searchParams.to ?? ''}
            className="border px-2 py-1"
          />
        </label>
        <button
          type="submit"
          data-testid="audit-apply"
          className="rounded border border-gray-400 px-3 py-1 text-sm hover:bg-gray-100"
        >
          Apply filters
        </button>
        <a href="/audit" className="text-sm text-blue-700 underline">
          reset
        </a>
      </form>

      {error && (
        <p className="text-sm text-red-700" data-testid="audit-error">
          {error}
        </p>
      )}

      {rows && (
        <>
          <p className="text-sm text-gray-600" data-testid="audit-count">
            {rows.length} {rows.length === 1 ? 'entry' : 'entries'}
          </p>
          <ol className="space-y-3" data-testid="audit-rows">
            {rows.map((row) => (
              <li key={row.id} className="rounded border border-gray-200 p-3 text-sm">
                <div className="flex flex-wrap gap-x-3">
                  <span className="text-gray-500">#{row.id}</span>
                  <span className="font-medium" data-testid="audit-action">
                    {row.resource}:{row.action}
                  </span>
                  <span>record {row.recordId}</span>
                  <span>by {names.get(row.actorId) ?? `user ${row.actorId}`}</span>
                  <span className="text-gray-600">{new Date(row.at).toISOString()}</span>
                  <span className="text-gray-600">permission: {row.permissionUsed}</span>
                </div>
                {row.reason ? <div className="text-gray-600">{row.reason}</div> : null}
                <details className="mt-1">
                  <summary className="cursor-pointer text-xs text-gray-500">before / after</summary>
                  <pre className="overflow-x-auto whitespace-pre-wrap text-xs">
                    {JSON.stringify({ before: row.before, after: row.after }, null, 2)}
                  </pre>
                </details>
              </li>
            ))}
          </ol>
          {rows.length === 0 && <p className="text-sm text-gray-500">No entries match the filters.</p>}
        </>
      )}
    </>
  );
}
