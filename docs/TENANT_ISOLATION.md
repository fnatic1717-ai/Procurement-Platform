# Phase 1 Foundation

This document describes Phase 1 production foundation work only. Procurement workflow modules, fake operational data, decorative dashboards, Excel reports, and PDF reports are intentionally deferred.

## Scope
- Monorepo foundation with pnpm workspaces and Turborepo.
- PostgreSQL, Redis, Prisma schema, and explicit SQL RLS migration.
- NestJS foundation services for health, authentication boundaries, authorization, audit events, and secure file metadata authorization.
- Next.js application shell and design-system primitives without workflow pages or fake data.

## Security posture
Tenant-owned persistence includes `tenant_id`; RLS policies compare it to `current_setting('app.current_tenant_id', true)` and deny access when absent. Authorization is deny-by-default and server-side. Audit events are append-only and sensitive metadata is redacted.
