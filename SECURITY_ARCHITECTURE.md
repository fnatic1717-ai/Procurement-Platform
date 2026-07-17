# Security Architecture

## Security Objectives

- Enforce tenant isolation across users, suppliers, records, files, reports, dashboards, jobs, and audit logs.
- Protect confidential procurement data including prices, supplier offers, budgets, evaluations, negotiations, financial terms, and approval decisions.
- Provide auditable access, decisions, administrative actions, report generation, and downloads.
- Support enterprise security expectations from the MVP.

## Identity and Authentication

MVP authentication uses Auth0 Organizations with OIDC support and secure application sessions.

Controls:

- Strong password policy when local credentials are enabled by the identity provider.
- Multi-factor authentication support for tenant administrators, finance users, procurement managers, and platform administrators.
- Secure, HttpOnly, SameSite cookies with the Secure flag in production.
- Short-lived application sessions with refresh rotation where supported.
- Separate internal tenant users and external supplier users.
- Brute-force protection, login rate limiting, suspicious login monitoring, and account lockout or step-up verification.

## Authorization

Authorization is deny-by-default and enforced server-side for every API, job, file, report, and dashboard request.

Authorization inputs:

- Tenant membership.
- Role assignment.
- Workflow assignment.
- Supplier account membership.
- Object ownership.
- Department, cost center, category, amount, and policy constraints.
- Segregation-of-duties rules.

Segregation-of-duties controls:

- A requester must not approve their own requisition by default.
- A buyer must not solely approve their own award recommendation or high-value PO.
- Supplier users must never access competing quotations, internal budgets, evaluations, approvals, or negotiation records.
- Any exceptional override requires explicit tenant policy, written justification, additional approval by an independent authorized approver, and immutable audit logging.

## Database-Enforced Tenant Isolation

- PostgreSQL row-level security must be enabled for tenant-owned tables.
- Every tenant-owned table must include `tenant_id` with foreign key constraints where applicable.
- Database sessions must set tenant context for request and background job execution.
- RLS policies must deny access when tenant context is absent.
- Automated tests must verify cross-tenant reads, writes, updates, deletes, reports, and file references are denied.
- Administrative maintenance paths must be separated, restricted, logged, and reviewed.

## Application and Browser Security

- CSRF protection is required for cookie-authenticated state-changing requests.
- Content Security Policy must restrict script, style, image, frame, and connection sources to approved origins.
- Security headers must include HSTS, X-Content-Type-Options, Referrer-Policy, frame protections, and permissions policy.
- Input validation is required at all API and file upload boundaries.
- Output encoding is required for future web UI.
- Rate limiting must protect authentication, supplier invitation, quotation submission, report generation, file download, and public callback endpoints.

## File and Object Storage Security

- Object storage must be private by default.
- File downloads must use signed temporary URLs issued only after a fresh authorization check.
- Uploads must validate file type, extension, MIME type, size, tenant scope, object link, and malware scan result.
- Malware scanning is required before files are made available to other users.
- File metadata must include tenant, uploader, checksum, scan status, linked object, retention policy, and classification.
- Supplier-uploaded files must not be executable and must be isolated from internal-only files.

## Data Protection, Secrets, and Keys

- Encrypt data in transit with TLS 1.2 or higher, with TLS 1.3 preferred.
- Encrypt database, backups, queues, caches where supported, and object storage at rest using managed keys.
- Store secrets in AWS Secrets Manager or an equivalent managed secret store, never in source code or CI logs.
- Rotate application secrets, signing keys, database credentials, and report download signing keys on a defined schedule and immediately after suspected compromise.
- Use least-privilege IAM roles for application services, background workers, CI/CD, and operators.

## Audit-Log Tamper Resistance

- Audit events must be append-only at the application layer.
- Audit tables should restrict updates and deletes to controlled retention operations.
- Audit events must include actor, tenant, object, action, prior state, resulting state, timestamp, correlation ID, IP or network context where appropriate, policy version, and report template version where relevant.
- High-risk audit streams should include hash chaining or periodic digesting to tamper-evident storage.
- Administrative access to audit logs must itself be audited.

## Logging and Redaction

- Logs must redact secrets, tokens, passwords, session IDs, signed URLs, supplier quotation prices where not required, invoice details where not required, and personal data beyond operational necessity.
- Structured logs must include correlation IDs and tenant-safe identifiers.
- Error messages shown to users must be safe and must not reveal object existence across tenant or supplier boundaries.

## Security Testing and Scanning

Required automated checks:

- Tenant-isolation tests across operational records, reports, jobs, and files.
- Authorization allow-and-deny tests for each role and workflow action.
- Supplier boundary tests for RFQs, quotations, negotiations, approvals, and reports.
- Dependency vulnerability scanning.
- Secret scanning.
- Static application security testing.
- Container image scanning where containers are used.
- Infrastructure-as-code scanning when infrastructure definitions are added.

## Backup, Restore, Disaster Recovery, and Incident Response

- Production database and object storage backups must be encrypted and retained according to approved policy.
- Restore procedures must be tested before production launch and on a recurring schedule.
- Recovery time objective and recovery point objective must be approved before launch.
- Incident response must define severity levels, containment, evidence preservation, tenant notification criteria, regulatory notification review, and post-incident remediation.
- Disaster recovery runbooks must cover database restore, object storage restore, identity provider outage, report job backlog, and credential compromise.

## MVP Boundaries

MVP security includes implementation-level controls for tenant isolation, RLS, RBAC, secure sessions, CSRF, security headers, rate limiting, private files, signed URLs, malware scanning, audit tamper resistance, redaction, scanning, backup, restore, disaster recovery, incident response, and automated security tests.
