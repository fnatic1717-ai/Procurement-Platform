# Deployment Architecture

## Deployment Goals
- Support secure, reliable, multi-tenant SaaS operations.
- Separate environments for development, testing, staging, and production.
- Enable repeatable releases, rollback, observability, and tenant-safe operations.

## Environment Model
- Development: local and shared development validation.
- Test: automated integration and regression testing.
- Staging: production-like release validation with synthetic data.
- Production: live tenant workloads.

Production data must not be copied into lower environments unless anonymized and approved by policy.

## Application Services
MVP deployment should support these logical services:

- Web application or API gateway.
- Application API service.
- Background worker service.
- Scheduler service.
- Database.
- Object storage.
- Cache or queue where needed.
- Email or notification provider.
- Observability stack.

The main production stack is selected for MVP and documented below. Runtime substitutions require architecture review because tenant isolation, reporting, and security controls depend on these choices.


## Chosen Production Technology Stack

| Area | Selection | Why it fits secure multi-tenant procurement SaaS |
| --- | --- | --- |
| Frontend | Next.js with React and TypeScript | Provides a mature enterprise UI foundation, server rendering where useful, strong typing, and a broad component ecosystem for data-heavy workflows. |
| Backend | NestJS on Node.js with TypeScript | Provides modular service boundaries, dependency injection, guards, validation, background-job integration, and a consistent TypeScript stack. |
| Database | PostgreSQL | Supports transactions, relational integrity, JSON where appropriate, row-level security, strong indexing, and reporting queries. |
| ORM and data layer | Prisma with raw SQL for RLS-sensitive and reporting queries | Provides type-safe schema management while allowing explicit SQL for tenant isolation, analytics, and performance-critical reports. |
| Authentication | Auth0 Organizations with OIDC, integrated through Auth.js for the web application | Supports enterprise SSO readiness, MFA, secure sessions, organization-aware access, and external supplier identities. |
| Authorization | Server-side NestJS guards and policy services backed by PostgreSQL RLS | Combines application-level deny-by-default rules with database-enforced tenant isolation. |
| Background jobs | BullMQ with Redis | Supports tenant-scoped asynchronous report rendering, notifications, SLA jobs, and retryable workflows. |
| Object storage | Private Amazon S3 buckets with KMS encryption | Provides durable file storage, signed temporary URLs, lifecycle policies, and tenant-scoped object keys. |
| Excel generation | ExcelJS | Supports `.xlsx` workbooks, formatting, filters, frozen headers, formulas, conditional formatting patterns, metadata, and charts where supported through templates. |
| PDF generation | Playwright Chromium rendering from versioned HTML templates | Produces branded PDFs from controlled templates with reliable layout and server-side rendering. |
| Malware scanning | ClamAV service or managed scanning integration | Provides required validation before uploaded files are exposed to users. |
| Testing | Vitest for unit tests, Playwright for approved UI end-to-end tests, Supertest for API integration tests | Covers business rules, API workflows, and future approved page flows in the TypeScript stack. |
| Observability | OpenTelemetry, structured logs, Sentry, and cloud metrics | Provides traces, safe error reporting, tenant-safe correlation, and operational visibility. |
| CI/CD | GitHub Actions with security scans and deployment gates | Supports repeatable builds, tests, dependency scanning, secret scanning, and controlled promotion. |
| Hosting | AWS using ECS Fargate or EKS, RDS PostgreSQL, ElastiCache Redis, S3, CloudFront, WAF, Secrets Manager, and KMS | Provides managed security, scaling, private networking, encrypted services, and enterprise deployment controls. |

## Configuration Management
- Environment-specific configuration must be externalized.
- Secrets must be stored in a managed secret store.
- Tenant configuration must be stored in application data, not environment variables.
- Feature flags may be used to control incomplete or tenant-specific capabilities.

## Release Management
- Use source control and pull request review.
- Run automated tests before deployment.
- Apply database migrations through controlled release steps.
- Support rollback for application deployment.
- Treat destructive schema changes as multi-step migrations.

## Observability
MVP observability should include:

- Structured application logs with redaction for secrets, supplier prices where not required, invoice data where not required, signed URLs, and personal data beyond operational necessity.
- Request tracing with tenant-safe identifiers.
- Error tracking.
- Background job monitoring.
- Database performance metrics.
- Authentication and authorization event monitoring.

Logs must not expose supplier quotations, invoice content, secrets, or personal data beyond operational necessity.

## Availability and Recovery
- Define backup schedule and retention for database and object storage.
- Test restore procedures before production launch.
- Define recovery time and recovery point objectives during architecture review.
- Background jobs must be idempotent where possible.

## Tenant Operations
- Tenant provisioning must create tenant settings, administrator assignment, numbering sequences, and default policies.
- Tenant suspension must block access without deleting records.
- Tenant deletion must follow legal and contractual retention requirements.

## MVP Boundaries
Deployment architecture includes the selected production stack, secure report rendering, background jobs, private storage, observability, backup, and recovery. It excludes prototype hosting, production mock datasets, complex multi-region active-active deployment, and nonessential enterprise integrations until architecture approval.
