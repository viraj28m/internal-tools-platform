import Link from 'next/link';
import { dal, statusForError } from '@/lib/data';
import { listUsers } from '@/lib/data/users';
import { currentUser } from '../current-user';
import { PendingDecisionButtons } from './PendingDecisionButtons';

/** Actions parked for approval that the current user is allowed to see. */
export async function PendingApprovals() {
  const user = currentUser();
  if (!user) return <p className="text-sm">Pick a user in the top nav to see pending approvals.</p>;

  let items;
  try {
    items = await dal.pending({ actor: user.actor }).listAwaiting();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return (
      <p className="text-sm text-red-700">
        {statusForError(error)} — {message}
      </p>
    );
  }

  const names = new Map((await listUsers()).map((seedUser) => [seedUser.id, seedUser.name]));

  if (items.length === 0) {
    return <p className="text-sm text-gray-600">Nothing is awaiting approval.</p>;
  }

  return (
    <ul className="space-y-4">
      {items.map((item) => {
        const recordHref =
          item.resource === 'kyc_cases' ? `/kyc/${String(item.recordId)}` : undefined;
        return (
          <li key={String(item.id)} className="rounded border border-gray-300 p-4">
            <div className="mb-2 flex flex-wrap gap-x-3 text-sm">
              <span className="font-medium">{String(item.action)}</span>
              <span>
                {String(item.resource)}{' '}
                {recordHref ? (
                  <Link className="text-blue-700 underline" href={recordHref}>
                    #{String(item.recordId)}
                  </Link>
                ) : (
                  `#${String(item.recordId)}`
                )}
              </span>
              <span className="text-gray-600">
                requested by {names.get(Number(item.initiatorId)) ?? `user ${String(item.initiatorId)}`}
              </span>
            </div>
            {!item.canApprove && (
              <p className="mb-2 text-sm font-medium text-red-700" data-testid="self-initiated">
                Self-initiated — you cannot approve this (maker-checker)
              </p>
            )}
            <PendingDecisionButtons
              key={`${user.session.sub}-${String(item.id)}`}
              pendingId={Number(item.id)}
              canApprove={item.canApprove}
            />
          </li>
        );
      })}
    </ul>
  );
}
