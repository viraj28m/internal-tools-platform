# Internal tools platform — audited core

Shared core for three fintech internal tools (KYC review queue, refunds
dashboard, feature-flag panel). This repository currently contains the core
only: schema, data access layer, RBAC enforcement, audit logging, and the
payment-processor boundary. The apps and UI come later.

See `SPEC.md` for the specification and `AGENTS.md` for the standing rules.

## Layout

- `lib/data` — the DAL, the only module that touches the database.
- `lib/auth` — fake, IdP-shaped session (`getSession()`, signed cookie).
- `lib/processor` — `PaymentProcessor` interface plus `MockProcessor`.
- `config` — one resource config per tool (columns, permissions, transitions).
- `drizzle` — checked-in migrations, including the audit-hardening grants.
- `scripts` — database provisioning, migrate, seed, `audit:verify`.
- `tests` — SPEC §7 acceptance suite.

## Setup

```bash
cp .env.example .env       # adjust if your Postgres differs
npm install
npm run db:reset           # drops/recreates the database and app_user role
npm run db:migrate
npm run db:seed
```

`DATABASE_URL` must point at the limited `app_user` role (no UPDATE/DELETE on
`audit_log`); `ADMIN_DATABASE_URL` is the owner connection used only by
provisioning, migrations, and tests that assert the app role's limits.

## Checks

```bash
npm run lint          # includes the "no DB imports outside /lib/data" guard
npm test              # SPEC §7 acceptance criteria, against a fresh database
npm run audit:verify  # walks the audit hash chain
npm run session:demo  # issues and reads back a session for every seed user
```
