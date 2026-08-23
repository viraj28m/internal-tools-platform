# Internal tools platform

A prototype evaluating whether Devin can replace Microsoft Power Apps for a
fintech's internal tools. Three tools — a KYC review queue, a refunds
dashboard, and a feature-flag panel — sit on one shared audited core, so RBAC,
audit logging, and maker-checker approvals are structural rather than
reimplemented per app: permissions are enforced in the data access layer from
the `role_permissions` table, every mutation writes its audit row in the same
transaction, and transitions marked `requiresApproval` park in
`pending_actions` until a different qualifying user approves them. UI is
deliberately thin. See [SPEC.md](SPEC.md) for the specification and
[AGENTS.md](AGENTS.md) for the standing rules.

## Quickstart

Prerequisites: Node 20 (verified on 20.18.1; 20.19+ avoids an npm engine
warning) and PostgreSQL 14+ running locally.

```bash
sudo service postgresql start   # or however you start Postgres
cp .env.example .env
npm install
```

Environment variables (all in `.env.example`):

- `DATABASE_URL` — application connection, the limited `app_user` role with no
  UPDATE/DELETE on `audit_log`.
- `ADMIN_DATABASE_URL` — owner connection, used only by `db:reset`,
  `db:migrate`, and tests that assert the app role's limits.
- `APP_DB_PASSWORD` — password `db:reset` grants to the application role.
- `SESSION_SECRET` — signs the fake session cookie.

If your Postgres requires a password for TCP connections to localhost (SCRAM
auth), `ADMIN_DATABASE_URL` needs one — the example value has no password and
fails with `SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a
string`.

```bash
npm run db:reset       # drops/recreates the database and app_user role
npm run db:migrate     # applies the checked-in migrations
npm run db:seed        # seed users, roles, permissions, and fake records
npm run dev            # http://localhost:3000, redirects to /kyc
npm test               # SPEC §7 acceptance suite
npm run lint           # includes the "no DB imports outside /lib/data" guard
npm run audit:verify   # walks the audit hash chain
```

Order matters: `db:reset` does not migrate or seed. `npm test` resets,
migrates, and seeds a fresh database itself, so it wipes whatever you had
locally and needs `ADMIN_DATABASE_URL`. `npm run session:demo` issues and
reads back a session for every seed user.

## Tour

| Route | What it does | Status |
| --- | --- | --- |
| `/kyc` | Case queue table → case detail with audit panel and config-driven transitions. | Built |
| `/refunds` | Refund table → detail; `submit` parks for approval, `execute` calls the mock processor. | Built |
| `/approvals` | Pending actions awaiting the current user; self-initiated items marked unapprovable. | Built |
| `/flags` | Flag table with an inline audited enabled-toggle. | Specified (SPEC §6), not built |
| `/audit` | Audit explorer: cross-app log, filters, before/after JSON, chain verification. | Specified (SPEC §6), not built |
| `/access` | Read-only matrix of roles × resources × actions, and who holds each role. | Specified (SPEC §6), not built |

Seed users (switch between them with the user-switcher in the top nav):

| User | Roles | Demonstrates |
| --- | --- | --- |
| `alice@example.test` | senior_analyst | Can request a KYC approval, which parks as a pending action. |
| `sara@example.test` | senior_analyst | The second qualifying approver, so maker-checker works from a clean seed. |
| `bob@example.test` | analyst | Can start a review but is denied the KYC `approve` transition (403). |
| `dana@example.test` | support_lead | Approves parked refunds and runs `execute` against the mock processor. |
| `evan@example.test` | support_agent | Initiates refunds; cannot approve his own submission. |
| `dev@example.test` | engineer, admin | Flag updates and cross-resource read access. |

## Architecture in brief

- `/lib/data` is the only module that imports the DB client — every read,
  write, permission check, and audit insert goes through it.
- One config per resource in `/config` (columns, permissions, transitions)
  drives both DAL enforcement and the shared UI components, so behavior
  changes are config changes.
- Each mutation runs permission check → mutation → audit insert in one
  transaction; if the audit insert fails, the mutation rolls back.
- `audit_log` is append-only (no UPDATE/DELETE for the app role) and
  hash-chained via `prev_hash`; `npm run audit:verify` reports the first
  broken row.
- An ESLint `no-restricted-imports` guard fails the build if anything outside
  `/lib/data` imports `pg`, the Drizzle client, or the DAL's internals.
- Money movement crosses the `PaymentProcessor` interface in `/lib/processor`;
  the only implementation is `MockProcessor`, called from the refunds
  `execute` transition with an idempotency key derived from the refund id.

## Deliberate scope cuts

From SPEC §9 — out of scope for the prototype:

- Real SSO/IdP — auth is faked behind an IdP-shaped `getSession()`; wiring a
  real provider proves nothing about the audited core.
- Real payment or external integrations — the `PaymentProcessor` boundary is
  the deliverable, not a live gateway.
- Row-level/region scoping — role-level RBAC already exercises the
  enforcement path.
- Notifications — no user in the demo waits on being told.
- Retention/archival jobs — operational concern, orthogonal to the audit
  chain.
- Multi-level approval chains — single maker-checker step already proves the
  mechanism.
- Field-level permissions — resource/action grants cover these three tools.
- Soft deletes — nothing in the three tools deletes records.
- Dashboards/charts — reporting, not the audit/RBAC question under evaluation.
- Mobile — internal desktop tools.
