# Database Architecture

## Goals
- Provide durable, auditable, tenant-isolated persistence for procurement lifecycle records.
- Support workflow state transitions, approval history, document references, and reporting exports.
- Enable future integrations without compromising data ownership or traceability.

## Multi-Tenant Strategy
MVP should use shared application infrastructure with strict tenant isolation. Each tenant-owned table must include `tenant_id`, and all queries must enforce tenant scope through application authorization and database constraints where supported.

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

## Data Integrity Rules
- Lifecycle records must use immutable identifiers and tenant-scoped human-readable numbers.
- Monetary values must store amount, currency, precision, tax treatment, and exchange-rate reference where applicable.
- Workflow transitions must be transactional with audit event creation.
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
The MVP should use normalized operational tables with export-friendly read models. A separate warehouse, cube, or dashboard layer is not part of MVP scope.

## Retention and Audit
- Audit events should be append-only.
- File metadata should be retained according to tenant policy.
- Deletion of business records should be logical where legal retention applies.
- Personally identifiable information handling must support future retention and deletion workflows.

## MVP Boundaries
The database architecture defines production schema direction and persistence rules. It does not include mock datasets, decorative analytics models, or dashboard-only aggregate tables.
