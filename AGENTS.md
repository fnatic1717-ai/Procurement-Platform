# AGENTS.md

## Repository Instructions

This repository defines a production-grade, multi-tenant B2B procurement SaaS foundation. All contributors and automation agents must preserve the MVP scope and architecture-first delivery approach.

## Language

- All documentation and user-facing MVP text must be English-only.
- Use clear business terminology for procurement, sourcing, purchasing, receiving, invoicing, and supplier performance.

## MVP Scope Guardrails

Include:

- Purchase requisition lifecycle.
- Approval workflows.
- RFQ and quotation management.
- Evaluation, negotiation, and award.
- Purchase order lifecycle.
- Delivery and goods receipt.
- Invoice matching.
- Supplier performance records.
- Multi-tenant security, audit, practical dashboards, analytics, professional Excel and PDF reporting, and deployment foundations.

Exclude until architecture review and approval:

- Decorative, fake, vanity, or unsupported dashboards and KPIs.
- Screens, metrics, icons, charts, or features without a real procurement business purpose.
- Mock data as product behavior.
- Application page implementation.
- Advanced analytics, AI recommendations, and marketplace features.

## Engineering Expectations

- Maintain tenant isolation in every design and implementation decision.
- Enforce role-based access control and workflow authorization server-side.
- Preserve immutable audit trails for lifecycle and security-sensitive events.
- Keep supplier quotation and commercial data confidential.
- Add tests for business rules, authorization, tenant isolation, and audit behavior.
- Never put try/catch blocks around imports.


## Permanent Engineering Rules

- Use `pnpm` as the only package manager. Do not add or use npm, Yarn, Bun, or alternate lockfiles.
- Preserve the approved stack and architecture: NestJS API, Next.js web, PostgreSQL persistence, multi-tenancy, RBAC, PostgreSQL RLS where applicable, immutable audit logging, idempotency protections, and optimistic concurrency for lifecycle updates.
- Never weaken tenant isolation, authorization, audit behavior, session security, or idempotency controls to make tests pass. Fix the implementation or the test setup instead.
- Do not use mock or hard-coded production tenant, user, supplier, RFQ, permission, financial, or analytics data as product behavior.
- Do not ship placeholders, unconditional throws, TODO-only production paths, fake success responses, or silent catches.
- Do not expand the requested scope. Implement only what the task or approved architecture explicitly requires.
- Do not create branches, commits, or pull requests unless the user explicitly requests them.

## Testing and Verification Rules

- Never claim a command passed unless it was actually executed and completed successfully.
- Explicitly report commands that were skipped or not run, including the reason.
- Do not present source-file string checks as component tests. Component tests must render and interact with real React components.
- Do not present arrays of journey descriptions as browser or E2E tests. Browser and E2E tests must launch Playwright or Cypress and interact with the running application when required by acceptance criteria.
- Do not add a general rule that browser or E2E testing is deferred; approved application pages may require real browser coverage.
- API integration tests must call actual HTTP endpoints.
- PostgreSQL integration tests must use the PostgreSQL test database.
- Preserve and test cross-tenant denial, inactive membership denial, permission denial, audit creation, and idempotency behavior.
- Stop and report clearly when Docker, PostgreSQL, Redis, required environment variables, browser tooling, or external identity-provider configuration is unavailable.
- `--passWithNoTests` is not evidence of meaningful test coverage.

### Root Verification Commands

The currently available root verification commands are:

- `pnpm format:check`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm test:integration`
- `pnpm build`
- `pnpm db:validate`
- `pnpm audit:deps`

Known verification gaps at the repository root:

- `pnpm test:component` is currently missing.
- `pnpm test:e2e` and browser tooling are currently missing.
- Do not claim these gaps are fixed unless a task explicitly adds the missing tooling and verifies it.

## Documentation Expectations

- Keep documentation aligned with MVP boundaries.
- Prefer explicit workflow states and permission rules over vague descriptions.
- Document assumptions and future enhancements separately from MVP commitments.
- Do not add decorative metrics or dashboard requirements without explicit approval.
- Do not remove practical procurement dashboards, analytics, Excel reporting, or PDF reporting merely because they include charts; require real operational data and a clear business purpose.
