# Phase 2B API

All endpoints require an authenticated active tenant membership, transaction-local tenant context, correlation ID, and the declared deny-by-default permission. UUID path parameters, bounded pagination, concrete DTO validation, maximum lengths, and unknown-field rejection apply globally. Supplier identity is never accepted from a header: supplier portal operations resolve exactly one active persisted `supplier_user_memberships` record.

## Supplier management

`GET/POST /v1/suppliers`, `GET/PATCH /v1/suppliers/{id}`, contact and address creation, qualification submission, activation, suspension, blocking, compliance document registration, and supplier-user membership management are available. Activation fails closed unless approved qualification and a verified, unexpired compliance document exist. State mutations compare the submitted version and write an audit event in the same tenant transaction.

## RFQs and invitations

`GET/POST /v1/rfqs` and `POST /v1/rfqs/from-purchase-request` create drafts. The latter accepts only same-tenant approved or procurement-review Purchase Requests with matching currency and snapshots both the header and source lines. Eligible active, qualified suppliers can be added through `/v1/rfqs/{id}/invitations`; publication requires a future deadline, at least one line, and at least one invitation.

Supplier users use `/v1/supplier-portal/invitations`. Accept and decline operations require their persisted supplier membership, an active supplier, a current invitation, a future expiry, and optimistic version matching.

## Clarifications and quotations

Supplier clarification questions require an accepted invitation and a future clarification deadline. Questions begin private; buyer responses explicitly select private or public visibility. Message rows are database-immutable.

Supplier quotation drafts and lines require the caller's persisted supplier, accepted invitation, active supplier, and future submission deadline. Submission validates complete RFQ line coverage, calculates totals with PostgreSQL `numeric`, locks submitted values, and writes an immutable JSON revision snapshot. Revision and withdrawal retain the prior submission and are version checked.

Evaluation, negotiation, award, purchase orders, receiving, and invoicing are not exposed in Phase 2B.
