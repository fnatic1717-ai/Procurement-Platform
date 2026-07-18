# Phase 2C-1: Internal Sourcing Workspace

Phase 2C-1 implements the authenticated internal buyer workspace for day-to-day RFQ work. The UI uses the Phase 2B backend as the source of truth and does not create mock RFQs, sample suppliers, fabricated KPI totals, browser-only draft records, or simulated activity.

## Scope delivered

- Authenticated application shell with collapsible sidebar, top context, breadcrumbs, tenant identity, user identity, current role display, and permission-aware navigation.
- Real sourcing overview work queues grouped from RFQs returned by `GET /api/v1/rfqs`.
- RFQ list with server-side pagination contract, search, status/date/category filter controls, URL query preservation, row navigation, loading, empty, forbidden, conflict, and server-error states.
- RFQ draft creation through `POST /api/v1/rfqs` and RFQ line creation through `POST /api/v1/rfqs/:id/lines`.
- RFQ workspace showing persisted header fields, lines, supplier invitations, clarifications, quotations, files/terms notes, and activity/audit guidance only where backend data exists.
- Workflow transitions using `POST /api/v1/rfqs/:id/transition` with current RFQ version and an idempotency key generated for the user action.
- Supplier invitation creation using `POST /api/v1/rfqs/:id/invitations` and persisted suppliers from `GET /api/v1/suppliers`.
- Internal clarification read model using `GET /api/v1/rfqs/:id/clarifications` and quotation read model using `GET /api/v1/rfqs/:id/quotations` when authorized.

## Internal routes

The current web application is implemented at `/` and exposes these internal sourcing views within the authenticated shell:

- Sourcing overview
- RFQs
- Create RFQ draft
- Suppliers
- Activity and audit guidance
- RFQ detail workspace opened from a real RFQ row

## Required environment variables

The web application uses the existing Next.js rewrite configuration:

- `API_ORIGIN`: backend API origin used by `/api/:path*` rewrites. Defaults to `http://localhost:3001`.

The API still requires the existing backend environment from `.env.example`, `apps/api/.env.example`, and `packages/database/.env.example`, including database connectivity and authentication adapter configuration.

## Running the web application

```bash
pnpm install
pnpm db:generate
pnpm --filter @procurement/api dev
API_ORIGIN=http://localhost:3001 pnpm --filter @procurement/web dev
```

The development sign-in form expects a real tenant ID, user ID, and comma-separated persisted permissions. These values are used to send the development bearer token and tenant header required by the existing API guards. The backend remains authoritative for membership and permission enforcement.

## Running frontend tests

```bash
pnpm --filter @procurement/web test
pnpm --filter @procurement/web typecheck
pnpm --filter @procurement/web lint
```

## Running real integration tests

```bash
pnpm db:migrate
pnpm test:integration
```

Integration tests use the configured PostgreSQL database and the existing API/database packages. Tests labeled integration must not replace tenant isolation, authorization, or database behavior with in-memory fakes.

## Roles and permissions used

Navigation and actions are derived from persisted permissions loaded into the current principal by the backend authorization model:

- `rfqs.read`: sourcing overview, RFQ list, RFQ workspace.
- `rfqs.create`: create RFQ draft.
- `rfqs.update_draft`: add RFQ lines while the RFQ is in draft status.
- `rfqs.publish`: valid RFQ state transitions from the Phase 2B state machine.
- `rfq_invitations.manage`: supplier invitation creation and management.
- `rfq_clarifications.manage`: internal clarification visibility and responses where supported.
- `quotations.read`: internal quotation visibility.
- `quotations.read_commercial`: commercial quotation fields when the backend returns them.
- `suppliers.read`: supplier navigation and supplier selection records.

Client-side navigation hiding is only a usability improvement; it is not a security control. The backend remains authoritative for RBAC, tenant isolation, optimistic concurrency, idempotency, and audit behavior.

## Deferred to Phase 2C-2

Phase 2C-2 will implement the complete external Supplier Portal and supplier quotation-editing experience. Deferred items include supplier-facing RFQ discovery, invitation response workspace, private supplier question authoring, supplier quotation draft editing, quotation line editing, revision management, withdrawal flows, and supplier-facing confidentiality controls.
