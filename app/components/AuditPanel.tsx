import type { ResourceName } from '@/config';
import { dal, statusForError } from '@/lib/data';
import { listUsers } from '@/lib/data/users';
import { currentUser } from '../current-user';
import type { Row } from './format';

type Props = { resource: ResourceName; recordId: number };

/** Read-only audit trail for one record, straight from the DAL. */
export async function AuditPanel({ resource, recordId }: Props) {
  const user = currentUser();
  if (!user) return null;

  let rows: Row[];
  try {
    rows = await dal.resource(resource, { actor: user.actor }).audit(recordId);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return (
      <p className="text-sm text-red-700">
        {statusForError(error)} — {message}
      </p>
    );
  }

  const names = new Map((await listUsers()).map((seedUser) => [seedUser.id, seedUser.name]));

  return (
    <section className="rounded border border-gray-300 p-4">
      <h3 className="mb-3 text-sm font-semibold uppercase text-gray-600">Audit trail</h3>
      {rows.length === 0 && <p className="text-sm text-gray-500">No audit entries yet.</p>}
      <ol className="space-y-3">
        {rows.map((row) => (
          <li key={String(row.id)} className="border-b border-gray-200 pb-2 text-sm last:border-0">
            <div className="flex flex-wrap gap-x-3">
              <span className="font-medium" data-testid="audit-action">
                {String(row.action)}
              </span>
              <span>by {names.get(Number(row.actorId)) ?? `user ${String(row.actorId)}`}</span>
              <span className="text-gray-600">{new Date(String(row.at)).toISOString()}</span>
              <span className="text-gray-600">permission: {String(row.permissionUsed)}</span>
            </div>
            {row.reason ? <div className="text-gray-600">{String(row.reason)}</div> : null}
            <details className="mt-1">
              <summary className="cursor-pointer text-xs text-gray-500">before / after</summary>
              <pre className="overflow-x-auto whitespace-pre-wrap text-xs">
                {JSON.stringify({ before: row.before, after: row.after }, null, 2)}
              </pre>
            </details>
          </li>
        ))}
      </ol>
    </section>
  );
}
