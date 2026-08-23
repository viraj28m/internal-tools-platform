'use server';

import { revalidatePath } from 'next/cache';
import { getResourceConfig, type ResourceName } from '@/config';
import { dal, statusForError } from '@/lib/data';
import { currentUser } from './current-user';
import { resourcePath } from './resource-paths';

export type ActionResult = { ok: boolean; status: number; message: string };

function describe(error: unknown): ActionResult {
  const status = statusForError(error);
  const message = error instanceof Error ? error.message : 'Unexpected error';
  return { ok: false, status, message };
}

/**
 * Runs a config-driven transition. The UI only reflects permissions; the DAL
 * is what actually allows or refuses the move, and its error surfaces here.
 */
export async function transitionAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = currentUser();
  if (!user) return { ok: false, status: 401, message: 'No session — pick a user first' };

  const resource = String(formData.get('resource')) as ResourceName;
  const id = Number(formData.get('id'));
  const name = String(formData.get('name'));

  try {
    const after = await dal.resource(resource, { actor: user.actor }).transition(id, name);
    const base = resourcePath(resource);
    if (base) {
      revalidatePath(base);
      revalidatePath(`${base}/${id}`);
    }
    revalidatePath('/approvals');
    const parked = getResourceConfig(resource).transitions[name]?.requiresApproval;
    const outcome = parked ? 'parked for a second approver' : 'applied';
    return { ok: true, status: 200, message: `${name} ${outcome} — status is now ${after.status}` };
  } catch (error) {
    return describe(error);
  }
}

/** Approves or rejects a parked action; maker-checker is enforced in the DAL. */
export async function pendingDecisionAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = currentUser();
  if (!user) return { ok: false, status: 401, message: 'No session — pick a user first' };

  const pendingId = Number(formData.get('pendingId'));
  const decision = String(formData.get('decision'));
  const pending = dal.pending({ actor: user.actor });

  try {
    const resolved =
      decision === 'reject' ? await pending.reject(pendingId) : await pending.approve(pendingId);
    revalidatePath('/approvals');
    const base = resourcePath(String(resolved.resource));
    if (base) {
      revalidatePath(base);
      revalidatePath(`${base}/${resolved.recordId}`);
    }
    return { ok: true, status: 200, message: `Pending action ${pendingId} ${resolved.status}` };
  } catch (error) {
    return describe(error);
  }
}
