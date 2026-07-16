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

- `POST/GET/PATCH /v1/purchase-requests`; item create/delete, detail, submit, resubmit, and withdraw actions.
- `GET /v1/approvals/inbox`; approve, reject, and return decisions.
- `GET /v1/procurement-intake`; assign or reassign an active internal tenant buyer.
- `GET/POST /v1/approval-policies`; tenant policy administration.

List and queue endpoints support bounded server pagination; purchase requests support status and search filters, while intake supports queue status and search.

## Future phases

RFQs, supplier quotations, evaluation, negotiation, awards, and purchase orders are not implemented. Role-addressed approval steps are persisted and snapshotted; expanding role steps into an eligible approver pool and administrative policy update/deactivation endpoints are the next genuine workflow limitations.
