# Database Architecture

## Goals
- Provide durable, auditable, tenant-isolated persistence for procurement lifecycle records.
- Support workflow state transitions, approval history, document references, and reporting exports.
- Enable future integrations without compromising data ownership or traceability.

## Multi-Tenant Strategy
MVP uses PostgreSQL with shared application infrastructure, strict tenant isolation, and database-enforced row-level security. Each tenant-owned table must include `tenant_id`, all application and job database sessions must set tenant context, and RLS policies must deny access when tenant context is absent. Application authorization remains required, but database policies provide an additional enforcement layer.

Potential future isolation tiers:

- Shared database, shared schema with tenant discriminator.
- Shared database, tenant schema for regulated customers.
- Dedicated database for enterprise customers with strict isolation requirements.

## Core Entity Groups

### Identity and Tenant
- tenants.
- tenant_settings.
- users.
- tenant_users.
- roles.
- permissions.
- role_assignments.
- organization_units.
- cost_centers.
- locations.

### Supplier
- suppliers.
- supplier_contacts.
- supplier_categories.
- supplier_qualification_records.
- supplier_compliance_documents.
- supplier_performance_events.

### Requisition and Approval
- requisitions.
- requisition_lines.
- approval_policies.
- approval_policy_versions.
- approval_workflows.
- approval_steps.
- approval_decisions.

### Sourcing
- rfqs.
- rfq_lines.
- rfq_supplier_invitations.
- rfq_criteria.
- rfq_clarifications.
- quotations.
- quotation_lines.
- quotation_attachments.
- evaluations.
- evaluation_scores.
- negotiation_rounds.
- negotiation_messages.
- awards.
- award_lines.

### Purchasing and Receiving
- purchase_orders.
- purchase_order_versions.
- purchase_order_lines.
- purchase_order_acknowledgements.
- delivery_schedules.
- deliveries.
- goods_receipts.
- goods_receipt_lines.

### Invoice Matching
- invoices.
- invoice_lines.
- invoice_matches.
- invoice_match_exceptions.
- exception_resolutions.

### Audit and Documents
- audit_events.
- file_objects.
- file_links.
- comments.
- notifications.
- export_jobs.
- report_templates.
- report_template_versions.
- generated_reports.
- dashboard_metric_snapshots.

## Data Integrity Rules
- Lifecycle records must use immutable identifiers and tenant-scoped human-readable numbers.
- Monetary values must store amount, currency, precision, tax treatment, and exchange-rate reference where applicable.
- Workflow transitions must be transactional with audit event creation.
- Dashboard metrics, Excel workbooks, and PDF reports must be generated from tenant-scoped read models or operational queries that respect RLS and authorization.
- Generated report records must preserve report type, filters, dataset scope, template version, file reference, requesting user, generated timestamp, and source data timestamp.
- Approval policy versions must be preserved after workflow creation.
- Purchase order amendments must create versions rather than destructive updates.
- Supplier quotations must preserve submitted values after closure.

## Indexing Priorities
- `tenant_id` plus status for active work queues.
- `tenant_id` plus record number for lookup.
- `tenant_id` plus supplier for sourcing, PO, invoice, and performance history.
- `tenant_id` plus requester, buyer, approver, and department for operational filtering.
- `tenant_id` plus created date for reporting exports.

## Reporting Data Approach
The MVP uses normalized operational tables, permission-aware read models, cached aggregate tables where needed for dashboard responsiveness, and generated report metadata. A separate enterprise data warehouse is not required for MVP, but the schema must support later warehouse replication without changing source-of-truth records.

Reporting persistence includes:

- Versioned report templates for branded Excel and PDF outputs.
- Generated report metadata linked to private object storage.
- Dashboard metric snapshots for expensive aggregates, refreshed by tenant-scoped background jobs.
- Audit events for report requests, render completion, failed renders, and downloads.

## Retention and Audit
- Audit events should be append-only.
- File metadata should be retained according to tenant policy.
- Deletion of business records should be logical where legal retention applies.
- Personally identifiable information handling must support future retention and deletion workflows.

## MVP Boundaries
The database architecture defines production schema direction and persistence rules. It does not include mock datasets, decorative analytics models, or dashboard-only aggregate tables.
