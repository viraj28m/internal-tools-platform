'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { verifyChainAction, type VerifyResult } from '../actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      data-testid="verify-chain"
      className="rounded border border-gray-400 px-3 py-1 text-sm hover:bg-gray-100 disabled:opacity-50"
    >
      {pending ? 'Verifying…' : 'Verify chain'}
    </button>
  );
}

/** Runs the hash-chain verification in the DAL and shows the result. */
export function VerifyChainButton() {
  const [result, formAction] = useFormState<VerifyResult | null, FormData>(verifyChainAction, null);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-3">
      <SubmitButton />
      {result && (
        <span
          data-testid="verify-chain-result"
          className={`rounded px-2 py-1 text-sm ${
            result.ok ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}
        >
          {result.message}
        </span>
      )}
    </form>
  );
}
