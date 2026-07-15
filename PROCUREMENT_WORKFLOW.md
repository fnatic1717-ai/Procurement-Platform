# Procurement Workflow

## Workflow Principles
- Every procurement object must have an explicit state machine.
- State transitions must be authorized, validated, auditable, and tenant-scoped.
- Human decisions must preserve actor, timestamp, comments, prior state, resulting state, and policy context.
- System automation may recommend routing but must not silently bypass required approvals.

## End-to-End Lifecycle
1. Purchase need is identified by a requester.
2. Purchase requisition is drafted and submitted.
3. Approval workflow validates need, budget, authority, and policy compliance.
4. Approved requisition follows either direct PO creation or sourcing through RFQ.
5. Buyer creates RFQ and invites qualified suppliers.
6. Suppliers submit quotations.
7. Buyer and evaluators review quotations against criteria.
8. Negotiation rounds occur if required.
9. Award recommendation is prepared and approved.
10. Purchase order is generated and approved.
11. Supplier acknowledges the purchase order.
12. Delivery is tracked against PO schedules.
13. Goods receipt records accepted and rejected quantities.
14. Supplier invoice is matched to PO and receipt data.
15. Exceptions are resolved and invoice is marked ready for payment.
16. Supplier performance events are updated.

## Requisition State Model
- Draft: editable by requester.
- Submitted: locked from requester edits except withdrawal where permitted.
- Under Review: active approval routing exists.
- Changes Requested: requester must revise and resubmit.
- Approved: eligible for sourcing or PO creation.
- Rejected: closed unless copied into a new requisition.
- Cancelled: intentionally terminated before conversion.
- Converted: linked to RFQ or PO.

## RFQ State Model
- Draft: buyer prepares sourcing event.
- Published: suppliers are invited and can access the RFQ.
- Clarification Open: questions and responses are managed.
- Quotation Open: quotations can be submitted.
- Quotation Closed: submissions are locked.
- Evaluation: buyer and evaluators review quotations.
- Negotiation: revised offers may be requested.
- Award Pending Approval: award recommendation requires approval.
- Awarded: one or more suppliers are selected.
- Cancelled: sourcing event is terminated.

## Purchase Order State Model
- Draft: generated but not issued.
- Pending Approval: PO awaits authorization.
- Approved: PO can be issued.
- Issued: supplier receives PO.
- Acknowledged: supplier confirms receipt and intent.
- Partially Delivered: at least one delivery or receipt exists.
- Fully Delivered: ordered quantities are received within tolerance.
- Closed: procurement obligation is complete.
- Cancelled: PO is void according to policy.
- Amended: current PO version supersedes prior version.

## Invoice Matching State Model
- Received: invoice data is captured.
- Matching: invoice is compared with PO and goods receipt.
- Matched: invoice passes configured checks.
- Exception: discrepancy requires resolution.
- Approved for Payment: finance approval is complete.
- Rejected: invoice is not payable.

## Approval Routing Rules
MVP routing inputs include:

- Tenant.
- Department.
- Cost center.
- Procurement category.
- Amount threshold.
- Currency.
- Supplier risk status.
- Budget owner.
- Emergency purchase flag.

Routing outputs include:

- Ordered approval steps.
- Required role or named approver.
- Delegation allowance.
- Escalation timeout.
- Minimum approval level.
- Whether finance review is required.

## Exception Handling
- Budget exception: route to finance and budget owner.
- Supplier compliance exception: route to procurement manager.
- RFQ deadline exception: require buyer justification and audit record.
- Receipt discrepancy: route to receiving user and buyer.
- Invoice price exception: route to buyer and finance.
- Invoice quantity exception: route to receiving user, buyer, and finance.

## MVP Boundaries
The workflow documentation defines states and transitions for procurement execution and supports practical analytics from real operational data. It does not approve building decorative, fake, vanity, or unsupported KPIs, mock data flows, or application pages before architecture approval.
