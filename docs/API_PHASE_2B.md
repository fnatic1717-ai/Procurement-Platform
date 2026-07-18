# Phase 2B: Secure supplier and RFQ backend foundation API

All endpoints require an authenticated active tenant membership, transaction-local tenant context, correlation ID, and the declared deny-by-default permission. UUID path parameters, bounded pagination, concrete DTO validation, maximum lengths, and unknown-field rejection apply globally. Supplier identity is never accepted from a header: supplier portal operations resolve exactly one active persisted `supplier_user_memberships` record.

## Supplier management

`GET/POST /v1/suppliers`, `GET/PATCH /v1/suppliers/{id}`, contact and address creation, qualification submission, activation, suspension, blocking, compliance document registration, and supplier-user membership management are available. Activation fails closed unless approved qualification and a verified, unexpired compliance document exist. State mutations compare the submitted version and write an audit event in the same tenant transaction.

## RFQs and invitations

`GET/POST /v1/rfqs` and `POST /v1/rfqs/from-purchase-request` create drafts. The latter accepts only same-tenant approved or procurement-review Purchase Requests with matching currency and snapshots both the header and source lines. Eligible active, qualified suppliers can be added through `/v1/rfqs/{id}/invitations`; publication requires a future deadline, at least one line, and at least one active qualified supplier invitation. RFQs then move through authorized idempotent transitions: `READY_FOR_REVIEW`, `PUBLISHED`, `CLARIFICATION_OPEN`, `QUOTATION_OPEN`, `QUOTATION_CLOSED`, `CLOSED`, or `CANCELLED`.

Supplier users use `/v1/supplier-portal/invitations`. Accept and decline operations require their persisted supplier membership, an active supplier, a current invitation, a future expiry, and optimistic version matching.

## Clarifications and quotations

Supplier clarification questions require an accepted invitation and a future clarification deadline. Questions remain private to the requesting supplier and authorized internal users. Buyer public clarification responses are created as separate public buyer-authored messages/threads so public content can be distributed to all active invited suppliers without exposing the requesting supplier identity or private question. Message rows are database-immutable.

Supplier quotation drafts and lines require the caller's persisted supplier, accepted invitation, active supplier, and future submission deadline. Submission validates complete RFQ line coverage, calculates totals with PostgreSQL `numeric`, locks submitted values, and writes an immutable JSON revision snapshot. Revision and withdrawal retain the prior submission and are version checked.

The complete internal sourcing UI, supplier portal UI, and role-aware operational workspaces are deferred to Phase 2C. Evaluation, negotiation, award, purchase orders, receiving, and invoicing are not exposed in Phase 2B.
