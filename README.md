# Procurement Platform

Production-grade, multi-tenant B2B procurement SaaS foundation. Phase 1 implements platform foundations only: monorepo, API shell, web shell, database schema, RLS migration, authorization, audit, file metadata interfaces, local infrastructure, tests, and CI.

## Architecture overview
- `apps/web`: Next.js application shell using approved English-only design tokens.
- `apps/api`: NestJS API with versioning, validation, health endpoints, CORS, security headers, rate-limiting foundations, OpenAPI setup, authentication boundary, authorization policy services, audit service, and file authorization service.
- `packages/database`: Prisma schema and explicit SQL migration for PostgreSQL Row-Level Security.
- `packages/shared`, `packages/config`, `packages/ui`: shared permissions/types, validated configuration, and reusable UI primitives.

## Prerequisites
Node.js 22, pnpm 9, Docker, and Docker Compose.

## Local setup
```bash
cp .env.example .env
pnpm install
docker compose up -d
pnpm db:generate
pnpm db:migrate
pnpm dev
```

## Environment variables
See `.env.example`. Values are local placeholders only. Real secrets must come from a managed secret store and must not be committed.

## Database migrations
Use `pnpm db:validate`, `pnpm db:generate`, and `pnpm db:migrate`. RLS is implemented in explicit SQL migration `packages/database/prisma/migrations/0001_platform_foundation/migration.sql`.

## Test commands
Run `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:integration`, and `pnpm build`.

## Application commands
- API: `pnpm --filter @procurement/api dev` then `/v1/health`, `/v1/health/database`, `/v1/health/redis`, and `/docs`.
- Web: `pnpm --filter @procurement/web dev`.

## Security assumptions
Tenant context is set per transaction using `app.current_tenant_id`. Production authentication must use Auth0 Organizations/OIDC. The development auth adapter is rejected in production configuration. Object storage is private by default through signed-URL interfaces.

## Implemented scope
Phase 1 foundation: tenancy, membership, role and permission models, organization structures, audit events, file metadata, RLS migration, deny-by-default policies, segregation-of-duties hooks, and local infrastructure.

## Explicitly unimplemented future modules
Requisitions, RFQs, quotations, awards, purchase orders, receiving, invoices, dashboards, Excel reports, PDF reports, supplier portal pages, marketplace features, and AI recommendations are intentionally not implemented in Phase 1.
