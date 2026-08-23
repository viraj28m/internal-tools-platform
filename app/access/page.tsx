import { dal, statusForError, type AccessMatrix } from '@/lib/data';
import { currentUser } from '../current-user';

export const dynamic = 'force-dynamic';

export default async function AccessPage() {
  const user = currentUser();
  if (!user) return <p className="text-sm">Pick a user in the top nav to open the access matrix.</p>;

  let matrix: AccessMatrix;
  try {
    matrix = await dal.access({ actor: user.actor }).matrix();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return (
      <p className="text-sm text-red-700" data-testid="access-error">
        {statusForError(error)} — {message}
      </p>
    );
  }

  const granted = new Set(
    matrix.grants.map((grant) => `${grant.role}|${grant.resource}|${grant.action}`),
  );

  return (
    <>
      <h1 className="text-xl font-semibold">Access Explorer</h1>
      <p className="text-sm text-gray-600">
        Read-only view of <code>role_permissions</code> — the table the DAL enforces from. Nothing on
        this page can be edited.
      </p>

      <table className="w-full border-collapse text-sm" data-testid="access-matrix">
        <thead>
          <tr className="border-b border-gray-300 text-left">
            <th className="px-3 py-2">Resource</th>
            <th className="px-3 py-2">Action</th>
            {matrix.roles.map((role) => (
              <th key={role} className="px-3 py-2">
                {role}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.resources.map((resource) =>
            matrix.actions.map((action) => (
              <tr key={`${resource}:${action}`} className="border-b border-gray-200">
                <td className="px-3 py-2 text-gray-600">{resource}</td>
                <td className="px-3 py-2 font-medium">{action}</td>
                {matrix.roles.map((role) => {
                  const has = granted.has(`${role}|${resource}|${action}`);
                  return (
                    <td
                      key={role}
                      className={`px-3 py-2 ${has ? 'text-green-700' : 'text-gray-300'}`}
                      data-testid={`grant-${resource}-${action}-${role}`}
                      title={has ? `${role} may ${action} ${resource}` : undefined}
                    >
                      {has ? 'yes' : '—'}
                    </td>
                  );
                })}
              </tr>
            )),
          )}
        </tbody>
      </table>

      <h2 className="text-lg font-semibold">Who holds each role</h2>
      <table className="w-full border-collapse text-sm" data-testid="role-holders">
        <thead>
          <tr className="border-b border-gray-300 text-left">
            <th className="px-3 py-2">Role</th>
            <th className="px-3 py-2">Holders</th>
          </tr>
        </thead>
        <tbody>
          {matrix.roles.map((role) => {
            const holders = matrix.holders[role] ?? [];
            return (
              <tr key={role} className="border-b border-gray-200">
                <td className="px-3 py-2 font-medium">{role}</td>
                <td className="px-3 py-2" data-testid={`holders-${role}`}>
                  {holders.length === 0 ? (
                    <span className="text-gray-500">nobody</span>
                  ) : (
                    holders.map((holder) => `${holder.name} (${holder.email})`).join(', ')
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}
