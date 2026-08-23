# AGENTS.md

Standing rules for all agent sessions in this repository. These apply to every
task, in every session, unless a human explicitly overrides them in the prompt.

## What this repo is

Three internal tools for a fintech company — a KYC review queue, a refunds
dashboard, and a feature-flag panel — built on one shared audited core. The
two load-bearing systems are **audit logging** and **RBAC**, built as a single
coupled mechanism: permissions decide who may act; the audit log proves who
did act, and every audit row records the permission decision that allowed it.
Compliance guarantees are structural, not per-app: they live in the core and
every app inherits them. Preserve that property in everything you build.

## Invariants — never violate these

1. **All database access goes through `/lib/data` (the DAL).** Never import
   the DB client or connection pool anywhere else. The lint guard enforces
   this; do not weaken, disable, or add exceptions to the guard.

2. **Every mutation requires an actor** (the authenticated user performing the
   action). No DAL write path may be callable without one. Never add a
   "system" or "anonymous" bypass unless explicitly asked.

3. **Every mutation writes its audit row in the same transaction.** If the
   audit insert fails, the mutation rolls back. Never write to `audit_log`
   outside the DAL. The table is append-only: the application role has no
   UPDATE or DELETE on it, and no code path may assume otherwise.

4. **Permission checks happen in the DAL, driven by the `role_permissions`
   table** — never hardcoded in routes or components. UI may *reflect*
   permissions (disabling buttons), but enforcement lives in the DAL only.

5. **Status/lifecycle changes go through `transition()`**, validated against
   the resource config (legal moves, allowed roles, approval requirement).
   Never set a status column via raw update.

6. **Maker-checker is absolute.** A pending action's approver must differ from
   its initiator (403 otherwise), and the approver's permission is re-checked
   at approval time, not initiation time. No flags or shortcuts around this.

7. **External money movement goes through the `PaymentProcessor` interface**
   in `/lib/processor` (mock implementation). Never call, simulate, or inline
   processor behavior elsewhere; the interface boundary is the point.

8. **Do not modify the schema of `audit_log`, the hash-chain logic, the CI
   guard, or this file** unless the task explicitly asks for it.

## Stack and conventions

- Next.js (App Router) + TypeScript, Postgres, Drizzle ORM.
- Layout: `/lib/data` (DAL — only DB access), `/lib/auth` (session),
  `/lib/processor` (mock payment interface), `/config` (one resource config
  per tool), `/app` (routes/UI), `/scripts` (seed, audit:verify).
- Auth is intentionally faked: a user-switcher sets a signed session cookie
  behind `getSession()`. Keep the interface IdP-shaped; session logic stays
  in `/lib/auth`.
- Seed data must be obviously fake ("Test Customer 4417"). No real names,
  keys, or credentials anywhere; secrets via environment variables only.
- Plain, boring, readable TypeScript. Minimal UI polish (default Tailwind).
  This is a reference implementation others will read.

## Workflow

- All work happens on feature branches; deliver via PR against main; never
  push directly to main.
- Before declaring any task done: `npm run lint` (includes the DAL guard),
  migrations + seed from a clean database, and the acceptance tests in
  SPEC.md §7 must pass.
- One PR per task. Every PR description states: what was built, any decisions
  the spec didn't cover (and the option chosen), and anything deliberately
  left out.
- If a requirement is ambiguous, pick the simplest option consistent with the
  invariants and note it in the PR — don't block on questions, don't expand
  scope beyond the task given.
