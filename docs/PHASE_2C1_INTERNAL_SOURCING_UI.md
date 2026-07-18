# Phase 2C-1: Internal Sourcing Workspace

Phase 2C-1 implements the internal buyer sourcing workspace against persisted Phase 2B RFQ, supplier, invitation, clarification, quotation, and audit data. The UI does not use mock RFQs, sample suppliers, fabricated KPIs, browser-only draft records, or simulated activity.

## Operational routes

- `/sourcing`: tenant-scoped sourcing overview from `GET /api/v1/rfqs/overview`.
- `/sourcing/rfqs`: RFQ list from `GET /api/v1/rfqs` with server-side pagination, search, filters, and deterministic sorting.
- `/sourcing/rfqs/new`: RFQ draft creation through `POST /api/v1/rfqs`.
- `/sourcing/rfqs/[id]`: RFQ workspace for header editing, lines, invitations, clarifications, quotations, terms, and audit timeline.
- `/sourcing/suppliers`: authorized supplier list from `GET /api/v1/suppliers`.

The root route redirects to `/sourcing`.

## Authenticated session flow

The browser no longer controls tenant ID, user ID, role, permissions, or development bearer identity. The web app loads `GET /api/v1/auth/session` using `credentials: include`. Sessions are established by `POST /api/v1/auth/login`, which authenticates through the configured `AuthProvider`, verifies the selected tenant against persisted active memberships, and issues a signed HTTP-only `procurement_session` cookie. The API derives session identity, active tenant membership, actor type, persisted role display, and permissions from the authenticated backend principal.

Supported authentication inputs are backend-controlled:

- Production: signed `procurement_session` HTTP-only cookie verified with `PROCUREMENT_SESSION_SECRET`, explicit issue/expiry claims, active membership ID validation, `httpOnly`, production `secure`, `sameSite=lax`, and bounded max age.
- Development/test: explicit development login is available only when `ENABLE_DEVELOPMENT_LOGIN=true` and `NODE_ENV` is not `production`; permissions are still loaded by the backend principal loader from persisted membership/registered fixtures. The web UI does not expose editable fields for bearer identity, tenant, role, or permissions.

Logout calls `POST /api/v1/auth/logout` and clears the signed session cookie.

## APIs added or changed

- Added `GET /api/v1/auth/session`.
- Added `POST /api/v1/auth/login`.
- Added `POST /api/v1/auth/logout`.
- Extended `GET /api/v1/rfqs` with validated filters: `status`, `procurementCategory`, `createdFrom`, `createdTo`, `deadlineFrom`, `deadlineTo`, `buyerId`, `sort`, and `direction`.
- Added `GET /api/v1/rfqs/overview` for server-side work-queue counts and limited records.
- Added `GET /api/v1/rfqs/:id/audit` for tenant-scoped persisted RFQ audit events.
- Existing Phase 2B mutation endpoints remain authoritative for RFQ header edits, lines, invitations, transitions, close, cancel, deadline extension, clarification responses, and clarification close.

## Roles and permissions used

- `rfqs.read`: overview, RFQ list, RFQ workspace, RFQ audit timeline.
- `rfqs.create`: create RFQ draft.
- `rfqs.update_draft`: edit RFQ header and add/edit/delete RFQ lines while backend state allows it.
- `rfqs.publish`: Phase 2B transition endpoint actions up to quotation closed.
- `rfqs.close`: close `QUOTATION_CLOSED` RFQs.
- `rfqs.cancel`: cancel eligible RFQs with a reason.
- `rfqs.extend_deadline`: extend supported RFQ deadlines with a reason.
- `rfq_invitations.manage`: add and revoke invitations.
- `rfq_clarifications.manage`: read/respond/close internal clarification threads.
- `quotations.read`: read non-draft internal quotation records.
- `quotations.read_commercial`: display commercial quotation fields returned by the backend.
- `suppliers.read`: supplier list and supplier/contact selection.

Client-side navigation only improves usability. Backend authentication, authorization, tenant isolation, optimistic concurrency, idempotency, and audit behavior remain authoritative.

## Required environment variables

- `API_ORIGIN`: web rewrite target for `/api/:path*`; defaults to `http://localhost:3001`.
- `PROCUREMENT_SESSION_SECRET`: HMAC secret, at least 32 characters, used to issue and verify signed production/development session cookies.
- `ENABLE_DEVELOPMENT_LOGIN`: optional non-production-only flag for development session establishment.
- `DATABASE_URL`: PostgreSQL connection for API, Prisma, migrations, validation, and integration tests.
- Existing API and database variables from `.env.example`, `apps/api/.env.example`, and `packages/database/.env.example` still apply.

## Running locally

```bash
pnpm install
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/procurement pnpm db:generate
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/procurement pnpm --filter @procurement/api dev
API_ORIGIN=http://localhost:3001 pnpm --filter @procurement/web dev
```

## Testing

```bash
pnpm format:check
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/procurement pnpm db:validate
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/procurement pnpm lint
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/procurement pnpm typecheck
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/procurement pnpm test
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/procurement pnpm test:integration
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/procurement pnpm build
pnpm audit:deps
```

Real PostgreSQL integration suites require a reachable PostgreSQL server. If `DATABASE_URL` points to a stopped or missing server, integration tests fail with a connection error rather than silently replacing the database with an in-memory fake.

## Phase 2C-2 deferred scope

Phase 2C-2 will implement the complete external Supplier Portal and supplier quotation-editing experience, including supplier-facing RFQ workspace, invitation response UI, supplier private question authoring, quotation draft editing, quotation line editing, revision management, withdrawal flows, and supplier-facing confidentiality controls.
