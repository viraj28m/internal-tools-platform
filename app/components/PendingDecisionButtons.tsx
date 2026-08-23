'use client';

import { useFormState } from 'react-dom';
import { pendingDecisionAction, type ActionResult } from '../actions';

type Props = { pendingId: number; canApprove: boolean };

export function PendingDecisionButtons({ pendingId, canApprove }: Props) {
  const [result, formAction] = useFormState<ActionResult | null, FormData>(
    pendingDecisionAction,
    null,
  );

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="pendingId" value={pendingId} />
      <button
        type="submit"
        name="decision"
        value="approve"
        title={
          canApprove
            ? undefined
            : 'Maker-checker: you initiated this action, so the DAL will refuse the approval'
        }
        data-testid={`approve-${pendingId}`}
        className={`rounded border px-3 py-1 text-sm ${
          canApprove ? 'border-gray-400 hover:bg-gray-100' : 'border-red-400 text-red-700'
        }`}
      >
        Approve
      </button>
      <button
        type="submit"
        name="decision"
        value="reject"
        data-testid={`reject-${pendingId}`}
        className="rounded border border-gray-400 px-3 py-1 text-sm hover:bg-gray-100"
      >
        Reject
      </button>
      {result && (
        <span
          data-testid={`pending-result-${pendingId}`}
          className={`text-sm ${result.ok ? 'text-green-700' : 'text-red-700'}`}
        >
          {result.ok ? result.message : `${result.status} — ${result.message}`}
        </span>
      )}
    </form>
  );
}
