# Testing Strategy

## Goals
- Validate the procurement lifecycle from requisition through supplier performance.
- Protect tenant isolation and role-based access control.
- Ensure workflow transitions are correct, auditable, and policy-driven.
- Prevent regressions in financial, supplier, and approval logic.

## Test Levels

### Unit Tests
Cover:
- Workflow state transition validation.
- Approval policy evaluation.
- Permission checks.
- Monetary calculations and currency handling.
- Invoice matching rules.
- Supplier performance event calculations.
- KPI formulas for spend, savings, aging, cycle time, RFQ competition, commitments, delivery, invoice exceptions, supplier responsiveness, supplier quality, and SLA performance.

### Integration Tests
Cover:
- Requisition submission through approval.
- Approved requisition to RFQ conversion.
- RFQ publication and supplier quotation submission.
- Quotation evaluation, negotiation, award, and PO creation.
- PO acknowledgement, delivery, goods receipt, and invoice matching.
- Audit event creation for state transitions.
- File access authorization.
- Dashboard, Excel, and PDF report authorization.

### End-to-End Tests
After application pages are approved and implemented, cover:
- Requester creates and submits requisition.
- Manager approves requisition.
- Buyer runs RFQ and awards supplier.
- Supplier submits quotation and acknowledges PO.
- Receiving user records goods receipt.
- Finance resolves invoice match.

End-to-end UI tests are intentionally deferred until page implementation is approved.

### Security Tests
Cover:
- Cross-tenant access denial.
- Supplier access boundaries.
- Unauthorized approval attempts.
- Segregation-of-duties enforcement.
- File download authorization.
- Administrative role changes.

### Data Tests
Cover:
- Tenant-scoped unique numbering.
- Required `tenant_id` on tenant-owned records.
- PO versioning immutability.
- Approval policy version preservation.
- Audit append-only behavior.

## Test Data Policy
- Use deterministic test fixtures only in test environments.
- Do not ship mock data as production product behavior.
- Avoid decorative demo dashboards, fake KPI datasets, unsupported analytics, and vanity metrics.
- Reporting tests must use deterministic fixtures with known formulas and expected outputs.
- Test supplier and buyer data must be clearly synthetic.

## Acceptance Criteria
A feature is not MVP-ready unless:

- Unit tests cover business rules.
- Integration tests cover tenant and workflow boundaries.
- Authorization tests cover permitted and denied access.
- Audit events are verified.
- Error conditions and exception paths are tested.

## Regression Priorities
Highest regression priority:

- Tenant isolation.
- Approval correctness.
- Supplier quotation confidentiality.
- Purchase order financial accuracy.
- Invoice matching accuracy.
- Audit trail integrity.

## MVP Boundaries
Testing strategy covers architecture and eventual implementation readiness. UI automation for unapproved application pages, mock dashboard data, and decorative KPI verification are excluded.
