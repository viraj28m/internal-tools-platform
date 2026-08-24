'use server';

import { revalidatePath } from 'next/cache';
import { getResourceConfig, type ResourceName } from '@/config';
import { dal, statusForError, type ChainVerification } from '@/lib/data';
import { currentUser } from './current-user';
import { resourcePath } from './resource-paths';

export type ActionResult = { ok: boolean; status: number; message: string };
export type VerifyResult = ActionResult & { verification?: ChainVerification };

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

/**
 * Inline enabled-toggle for /flags. It is a plain audited update: the DAL
 * checks feature_flags:update and writes the audit row in the same
 * transaction, so a user without the permission gets a 403 here.
 */
export async function toggleFlagAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = currentUser();
  if (!user) return { ok: false, status: 401, message: 'No session — pick a user first' };

  const id = Number(formData.get('id'));
  const enabled = formData.get('enabled') === 'true';

  try {
    const after = await dal.resource('feature_flags', { actor: user.actor }).update(id, { enabled });
    revalidatePath('/flags');
    revalidatePath(`/flags/${id}`);
    revalidatePath('/audit');
    return {
      ok: true,
      status: 200,
      message: `${String(after.key)} is now ${after.enabled ? 'enabled' : 'disabled'}`,
    };
  } catch (error) {
    return describe(error);
  }
}

/** Runs the audit hash-chain verification for the Audit Explorer. */
export async function verifyChainAction(
  _previous: VerifyResult | null,
  _formData: FormData,
): Promise<VerifyResult> {
  const user = currentUser();
  if (!user) return { ok: false, status: 401, message: 'No session — pick a user first' };

  try {
    const verification = await dal.audit({ actor: user.actor }).verifyChain();
    const message = verification.ok
      ? `Chain OK — ${verification.rows} rows verified`
      : `Chain BROKEN at row ${verification.brokenRowId} — expected ${verification.expected}, found ${verification.found}`;
    return { ok: verification.ok, status: 200, message, verification };
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
