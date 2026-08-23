'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { transitionAction, type ActionResult } from '../actions';
import type { TransitionOption } from './transitions';

type Props = {
  resource: string;
  id: number;
  options: TransitionOption[];
};

function SubmitButton({ name, disabledReason }: TransitionOption) {
  const { pending } = useFormStatus();
  const disabled = Boolean(disabledReason) || pending;
  const tooltipId = `transition-${name}-reason`;

  return (
    <span className="group relative inline-block">
      <button
        type="submit"
        disabled={disabled}
        aria-describedby={disabledReason ? tooltipId : undefined}
        data-testid={`transition-${name}`}
        className="rounded border border-gray-400 px-3 py-1 text-sm enabled:hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {name}
      </button>
      {disabledReason && (
        <span
          id={tooltipId}
          role="tooltip"
          className="pointer-events-none absolute left-0 top-full z-10 mt-1 hidden w-max max-w-sm rounded bg-gray-900 px-2 py-1 text-xs text-white group-hover:block"
        >
          {disabledReason}
        </span>
      )}
    </span>
  );
}

export function TransitionButtons({ resource, id, options }: Props) {
  const [result, formAction] = useFormState<ActionResult | null, FormData>(transitionAction, null);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        {options.map((option) => (
          <form key={option.name} action={formAction}>
            <input type="hidden" name="resource" value={resource} />
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="name" value={option.name} />
            <SubmitButton {...option} />
          </form>
        ))}
      </div>
      {result && (
        <p
          data-testid="transition-result"
          className={`mt-3 text-sm ${result.ok ? 'text-green-700' : 'text-red-700'}`}
        >
          {result.ok ? result.message : `${result.status} — ${result.message}`}
        </p>
      )}
    </div>
  );
}
