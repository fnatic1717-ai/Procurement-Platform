# Phase 2A Implementation

## Delivered scope

Phase 2A implements a tenant-owned operational Purchase Request workflow: editable draft and line items, policy-routed submission, immutable sequential approval, requester return/resubmission or withdrawal, final approval, procurement intake, and audited buyer assignment history. Money uses PostgreSQL `numeric` and Prisma `Decimal`; API DTOs accept decimal strings.

## Lifecycle and concurrency

The explicit lifecycle is `DRAFT`, `SUBMITTED`, `PENDING_APPROVAL`, `RETURNED_TO_REQUESTER`, `REJECTED`, `APPROVED`, `WITHDRAWN`, `CANCELLED`, and `IN_PROCUREMENT_REVIEW`. Only draft and returned records are editable. Mutations compare a client-supplied version, and submission and approval decisions use tenant-scoped idempotency keys. Final approval and intake creation occur in one tenant-context transaction.

## Approval routing

Active policies are ordered by administrative priority and match value, department, legal entity, category, currency, and request priority. Each active step has exactly one named tenant member or tenant role, a required permission, optional thresholds, and optional escalation metadata. The selected policy version and ordered route are snapshotted at submission. No route means submission fails without changing the request.

## Security and isolation

The new tables use UUID keys, composite `(tenant_id, id)` references, forced RLS, and the same transaction-local tenant context as Phase 1. Requester, approver, and buyer identities come from authenticated principals or validated active tenant memberships. Requesters cannot approve their own requests. Server-side permission guards remain deny-by-default.

## API summary

- `POST/GET/PATCH /v1/purchase-requests`; item create/update/delete, detail, submit, resubmit, withdraw, and cancellation actions.
- `GET /v1/approvals/inbox` and approval detail; approve, reject, and return decisions.
- `GET /v1/procurement-intake` and intake detail; assign or reassign a permission-bearing active internal tenant buyer.
- `GET/POST/PATCH /v1/approval-policies`; policy detail, versioned editing, activation, deactivation, and ordered-step administration.

List and queue endpoints support bounded server pagination; purchase requests support status and search filters, while intake supports queue status and search.

## Future phases

RFQs, supplier quotations, evaluation, negotiation, awards, and purchase orders are not implemented. Role-addressed approval steps and policy update/deactivation are implemented in Phase 2A. Future work remains limited to later sourcing domains and production deployment verification described separately.

## Merge-readiness corrections

Role-addressed approval steps now resolve persisted tenant role assignments and required permissions for active members. Inbox results expose only the current sequential step, terminal decisions close later steps, and approval instances retain immutable routing fields while allowing controlled completion metadata. Operation-and-object-scoped idempotency records bind keys to payload hashes. Version predicates are applied atomically to workflow, item, policy, and buyer-assignment mutations.

The web workspace now provides API-backed request filtering and pagination, request editing and lines, lifecycle actions and history, actionable approval detail, filtered procurement intake and assignment, and approval-policy authoring, step ordering, editing, activation, and deactivation. Empty states reflect real API results and do not contain sample procurement records.
