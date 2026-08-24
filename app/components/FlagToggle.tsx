'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { toggleFlagAction, type ActionResult } from '../actions';

type Props = {
  id: number;
  flagKey: string;
  enabled: boolean;
  /** Why the toggle is disabled, or null when the session's role may update. */
  disabledReason: string | null;
};

function ToggleButton({ enabled, disabledReason, flagKey }: Omit<Props, 'id'>) {
  const { pending } = useFormStatus();
  const disabled = Boolean(disabledReason) || pending;

  return (
    <span className="group relative inline-block">
      <button
        type="submit"
        disabled={disabled}
        title={disabledReason ?? undefined}
        aria-pressed={enabled}
        aria-label={`Toggle ${flagKey}`}
        data-testid={`flag-toggle-${flagKey}`}
        className={`w-24 rounded border px-3 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-50 ${
          enabled
            ? 'border-green-600 bg-green-50 text-green-800 enabled:hover:bg-green-100'
            : 'border-gray-400 text-gray-700 enabled:hover:bg-gray-100'
        }`}
      >
        {enabled ? 'enabled' : 'disabled'}
      </button>
      {disabledReason && (
        <span
          role="tooltip"
          className="pointer-events-none absolute left-0 top-full z-10 mt-1 hidden w-max max-w-sm rounded bg-gray-900 px-2 py-1 text-xs text-white group-hover:block"
        >
          {disabledReason}
        </span>
      )}
    </span>
  );
}

/** Inline toggle; the DAL audits the update and refuses it without permission. */
export function FlagToggle({ id, flagKey, enabled, disabledReason }: Props) {
  const [result, formAction] = useFormState<ActionResult | null, FormData>(toggleFlagAction, null);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="enabled" value={String(!enabled)} />
      <ToggleButton flagKey={flagKey} enabled={enabled} disabledReason={disabledReason} />
      {result && (
        <span
          data-testid={`flag-result-${flagKey}`}
          className={`text-xs ${result.ok ? 'text-green-700' : 'text-red-700'}`}
        >
          {result.ok ? result.message : `${result.status} — ${result.message}`}
        </span>
      )}
    </form>
  );
}
