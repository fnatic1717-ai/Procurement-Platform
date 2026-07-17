# User Roles and Permissions

## Access Control Model

The platform uses tenant-scoped role-based access control with policy constraints. Permissions are granted by tenant role, object ownership, workflow assignment, supplier relationship, and administrative scope.

## Tenant Roles

### Requester

Can:

- Create, edit, submit, withdraw, and view own requisitions.
- Respond to change requests.
- View status of requisitions, linked RFQs where permitted, POs, receipts, and invoice exceptions related to own requests.

Cannot:

- Approve own requisition by default; any exception requires explicit tenant policy, written justification, independent additional approval, and immutable audit logging.
- View unrelated supplier commercial quotations.
- Modify approval policies.

### Department Manager

Can:

- Approve or reject requisitions routed to them.
- Request changes with comments.
- View department requisitions and related procurement status.

Cannot:

- Edit submitted requisition details directly.
- Award RFQs unless also assigned a procurement role.

### Procurement Buyer

Can:

- Convert approved requisitions into RFQs or POs.
- Manage RFQs, supplier invitations, clarifications, quotation evaluations, negotiations, award recommendations, and purchase orders.
- Record procurement comments and supplier communication history.

Cannot:

- Override required approval policies or solely approve their own award recommendation or high-value PO.
- Access other tenant data.
- Approve finance-only invoice decisions unless assigned finance permission.

### Procurement Manager

Can:

- Approve sourcing strategies, awards, high-value POs, supplier exceptions, and procurement policy exceptions.
- View procurement records across assigned tenant scope.

Cannot:

- Modify platform-level settings.

### Finance Reviewer

Can:

- Review budget, tax, payment terms, invoice matching, and payment readiness.
- Resolve finance exceptions.

Cannot:

- Change RFQ scoring or supplier awards without procurement assignment.

### Receiving User

Can:

- View assigned PO delivery schedules.
- Record goods receipt, rejection, inspection notes, and receiving attachments.

Cannot:

- Change PO commercial terms.
- Approve invoices except receipt-related exception confirmations.

### Supplier User

Can:

- View invited RFQs and issued POs for their supplier account.
- Submit quotations, clarification questions, order acknowledgements, delivery updates, and invoice-related information where enabled.

Cannot:

- View competing suppliers, competing quotations, internal budgets, buyer evaluations, approvals, negotiation records, or tenant administrative settings.

### Tenant Administrator

Can:

- Manage tenant users, roles, locations, departments, categories, approval policies, suppliers, and configuration.
- View tenant audit events for administrative and compliance purposes.

Cannot:

- Access platform-wide operational data outside their tenant.

### Platform Administrator

Can:

- Operate infrastructure, tenant provisioning, system health, and platform configuration.
- Access tenant data only through audited support mechanisms and explicit authorization.

Cannot:

- Participate in tenant business workflows unless separately invited as a tenant user.

## Permission Domains

- Requisition management.
- Approval decisions.
- RFQ management.
- Supplier quotation access.
- Evaluation and negotiation.
- Award recommendation and approval.
- Purchase order management.
- Delivery and goods receipt.
- Invoice matching and finance approval.
- Supplier management.
- Tenant administration.
- Platform administration.
- Reporting and exports.
- Audit log access.

## Security Constraints

- Deny by default for every API, report, dashboard, file, background job, and workflow action.
- Supplier users are always externally scoped.
- Approval decisions require active assignment or policy authority.
- Users cannot approve records where segregation-of-duties rules prohibit participation.
- A requester must not approve their own requisition by default.
- A buyer must not solely approve their own award recommendation or high-value PO.
- Supplier users must never access competing quotations, internal budgets, evaluations, approvals, or negotiation records.
- Exceptional overrides require explicit policy, justification, independent additional approval, and immutable audit logging.
- Administrative impersonation, if implemented later, must be time-bound, justified, explicitly consented, and fully audited.

## MVP Permission Matrix

The MVP should implement coarse-grained roles with fine-grained policy hooks. Advanced attribute-based access control can be introduced later without weakening tenant isolation.
