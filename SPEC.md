# SPEC.md — Fintech Internal Tools on an Audited Core (Prototype)

## §1 Context and thesis

A fintech company runs three internal tools on Microsoft Power Apps — a KYC
review queue, a refunds dashboard, and a feature-flag admin panel — and plans
~10 more. This prototype evaluates building those three tools with Devin on a
shared code-first core instead.

We are NOT rebuilding Power Apps. We are building the three tools this client
actually needs, going deep on the two capabilities that carry Power Apps'
value for a regulated fintech: **audit logging** and **RBAC**, built as one
coupled system. RBAC answers "who can do this?"; the audit log answers "who
did do this?" — and every audit row records the permission decision that
allowed the action. UI is deliberately thin.

Runtime architecture contains no AI components: these are deterministic,
auditable tools. Devin is the builder, not part of the system.

Build quality bar: reference implementation for a demo, not production.

## §2 Schema

Postgres via Drizzle. Migrations checked in. All timestamps UTC.

```
users            (id, email unique, name, created_at)
roles            (id, name unique)
                 -- analyst, senior_analyst, support_agent, support_lead, engineer, admin
user_roles       (user_id, role_id)
role_permissions (role_id, resource, action)
                 -- e.g. ('kyc_cases','view'), ('refunds','approve')
audit_log        (id, actor_id, at, resource, record_id, action,
                  permission_used,          -- the (resource, action) that authorized this
                  before jsonb, after jsonb, reason, prev_hash)
pending_actions  (id, resource, record_id, action, payload jsonb,
                  initiator_id, status,     -- pending | approved | rejected
                  approver_id, resolved_at, created_at)
kyc_cases        (id, customer_name, risk_score int, status, notes,
                  created_at, updated_at)
                 -- status: open | in_review | pending_approval | approved | rejected
refunds          (id, customer_name, order_ref, amount_cents int, currency,
                  reason, status, processor_ref, created_at, updated_at)
                 -- status: requested | pending_approval | approved | executed | rejected
feature_flags    (id, key unique, description, enabled bool, updated_at)
```

Audit hardening (both required):
- The application's Postgres role has `REVOKE UPDATE, DELETE ON audit_log`.
- `prev_hash = sha256(previous_row.prev_hash || canonical_json(current_row))`;
  first row hashes against a fixed genesis string. `npm run audit:verify`
  walks the chain and reports OK or the first broken row.

## §3 Data access layer (DAL)

Location: `/lib/data`. The ONLY module that imports the DB client (lint guard
enforces this — see §7.2).

```ts
dal.resource('refunds', { actor })   // actor REQUIRED on construction
   .list(filters?) / .get(id)
   .create(data)
   .update(id, patch)                // field edits only; cannot touch status
   .transition(id, name)             // lifecycle changes; config-driven
dal.pending({ actor })
   .listAwaiting() / .approve(id) / .reject(id)
```

Every mutation, in order, inside ONE transaction:
1. Permission check: actor's roles grant (resource, action) via role_permissions.
2. The mutation.
3. Audit insert — actor, action, permission_used, before/after, prev_hash.
   If this insert fails, the transaction rolls back.

`transition(id, name)` additionally validates against the resource config:
current status ∈ from-list; actor's role ∈ allowedRoles. If the config marks
the transition `requiresApproval`, do NOT execute — insert a pending_actions
row plus an audit entry (action: "transition_requested").

Approvals:
- `approve(pendingId)`: 403 if approver == initiator; re-check the approver's
  permission AT APPROVAL TIME; execute the parked transition through the
  normal DAL path (own audit row); mark resolved.
- `reject(pendingId)`: same checks; audit entry; no mutation executes.

## §4 Resource configs

One file per tool in `/config`, read by the DAL and the shared UI components.
Keep the format minimal — just what these three tools need:

```ts
// config/kyc_cases.ts
export default {
  table: 'kyc_cases',
  displayName: 'KYC Review Queue',
  columns: {
    customer_name: { label: 'Customer' },
    risk_score:    { label: 'Risk', type: 'number' },
    status:        { type: 'status' },
    notes:         { label: 'Notes', editable: true },
  },
  permissions: { view: ['analyst','senior_analyst','admin'],
                 update: ['analyst','senior_analyst'] },
  transitions: {
    start_review: { from: ['open'], to: 'in_review',
                    allowedRoles: ['analyst','senior_analyst'],
                    requiresApproval: false },
    approve:      { from: ['in_review'], to: 'approved',
                    allowedRoles: ['senior_analyst'], requiresApproval: true },
    reject:       { from: ['in_review'], to: 'rejected',
                    allowedRoles: ['senior_analyst'], requiresApproval: false },
  },
}
```

```ts
// config/refunds.ts
export default {
  table: 'refunds',
  displayName: 'Refunds',
  columns: {
    customer_name: { label: 'Customer' },
    order_ref:     { label: 'Order' },
    amount_cents:  { label: 'Amount', type: 'money' },
    reason:        { label: 'Reason', editable: true },
    status:        { type: 'status' },
  },
  permissions: { view: ['support_agent','support_lead','admin'],
                 create: ['support_agent','support_lead'] },
  transitions: {
    submit:  { from: ['requested'], to: 'pending_approval',
               allowedRoles: ['support_agent','support_lead'],
               requiresApproval: true },
    execute: { from: ['approved'], to: 'executed',
               allowedRoles: ['support_lead'], requiresApproval: false,
               effect: 'processor.executeRefund' },
    reject:  { from: ['requested','approved'], to: 'rejected',
               allowedRoles: ['support_lead'], requiresApproval: false },
  },
}
```

```ts
// config/feature_flags.ts — deliberately trivial
export default {
  table: 'feature_flags',
  displayName: 'Feature Flags',
  columns: {
    key:         { label: 'Flag' },
    description: { label: 'Description', editable: true },
    enabled:     { label: 'Enabled', type: 'boolean', editable: true },
  },
  permissions: { view: ['engineer','admin'], update: ['engineer','admin'] },
  transitions: {},   // plain audited updates are sufficient for this tool
}
```

## §5 The payment processor boundary

`/lib/processor` exports:

```ts
interface PaymentProcessor {
  executeRefund(input: { orderRef: string; amountCents: number;
                         currency: string; idempotencyKey: string })
    : Promise<{ processorRef: string }>
}
```

One implementation: `MockProcessor` (returns a fake ref after a short delay;
logs to console). The refunds `execute` transition calls it via its `effect`
and stores `processor_ref`. The idempotencyKey is derived from the refund id —
executing the same refund twice must not produce two processor calls (test
this). No real payment integration; the interface boundary is the deliverable.

## §6 Apps and UI

Shared components: `<ResourceTable config>`, `<ResourceDetail>` (fields +
transition buttons from config; disabled with a tooltip reason when role or
state disallows), `<AuditPanel resource recordId>`, `<PendingApprovals>`.
User-switcher in the top nav (four seed users; signed cookie via
`getSession()` in `/lib/auth`, structured as if an IdP issued it).

- `/kyc` — queue table → case detail with AuditPanel → transitions per config.
- `/refunds` — table → detail; submit parks in pending_actions; a support_lead
  other than the initiator approves at `/approvals`; execute calls the mock
  processor.
- `/flags` — table with inline enabled-toggle; every toggle audited.
- `/approvals` — pending items awaiting the current user; self-initiated items
  visibly marked unapprovable.
- `/audit` — **Audit Explorer**: cross-app log, filterable by actor, resource,
  and date; row expands to before/after JSON; "Verify chain" button runs the
  hash verification and shows the result.
- `/access` — **Access panel**: read-only matrix of roles × resources ×
  actions from role_permissions, and who holds each role.

Styling: default Tailwind, minimal. Zero effort on visual polish.

## §7 Acceptance criteria (all must pass; implement as `npm test` + lint)

1. Migrations + seed succeed from a clean database.
2. Guard: `npm run lint` fails if any file outside `/lib/data` imports the DB
   client. Include a demonstration that it fires (violating fixture),
   referenced in the PR description.
3. analyst calling kyc `transition('approve')` → 403 (role not allowed).
4. kyc `approve` from status `open` → rejected as an illegal move.
5. senior_analyst's kyc `approve` parks a pending_action; case shows
   `pending_approval`; audit has `transition_requested`.
6. Initiator approving their own pending action → 403.
7. A different qualifying user approving → executed through the DAL; audit
   shows the executed transition with `permission_used`; pending resolved.
8. If the audit insert is forced to fail (test hook), the mutation rolls back.
9. App DB role cannot UPDATE or DELETE audit_log rows.
10. `npm run audit:verify` passes on seeded+mutated data; corrupting one row
    via a superuser connection makes it fail at that row.
11. Refund `execute` calls MockProcessor exactly once for a given refund, even
    if invoked twice (idempotency), and stores processor_ref.
12. Flag toggle by an engineer produces an audit row; toggle by an analyst →
    403.

## §8 Seed data

Users: alice (senior_analyst), bob (analyst), dana (support_lead),
evan (support_agent), dev (engineer + admin).
~20 kyc_cases across statuses and risk scores; ~10 refunds across statuses
with varying amounts; 5 feature_flags. All data obviously fake
(e.g. "Test Customer 4417"); no real names or keys anywhere.

## §9 Out of scope — do not build

Real SSO/IdP; real payment or any external integration; row-level/region
scoping; notifications; retention/archival jobs; multi-level approval chains;
field-level permissions; soft deletes; dashboards/charts; mobile. If tempted,
don't — note it as a possible extension in the PR description instead.
