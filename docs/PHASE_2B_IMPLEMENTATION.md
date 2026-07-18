# Phase 2B: Secure supplier and RFQ backend foundation

Phase 2B introduces the tenant-owned PostgreSQL sourcing data model for supplier master data, qualification and compliance, RFQs sourced from approved Purchase Requests, supplier invitations, immutable clarifications, and decimal-safe quotations with revision history.

## Security boundaries

Every new table has forced PostgreSQL RLS and requires transaction-local `app.current_tenant_id`. Composite tenant foreign keys prevent cross-tenant links. Supplier-user access must be derived from `supplier_user_memberships`; no supplier identity may be accepted from a header. Internal supplier notes and qualification risk notes are internal-only. Invitation, quotation, clarification, and file authorization must additionally enforce the persisted supplier identity so that an invited supplier cannot discover competitors.

Published clarification messages, quotation revisions, and RFQ activity events are database-immutable. Files remain private objects and are linked by tenant-safe identifiers; download issuance requires fresh object and supplier authorization.

## Lifecycle rules

Suppliers must be both `ACTIVE` and `APPROVED` before invitation. Suspending or blocking a supplier prevents invitations and responses without deleting history. RFQs progress through executable server-side transitions for `DRAFT`, `READY_FOR_REVIEW`, `PUBLISHED`, `CLARIFICATION_OPEN`, `QUOTATION_OPEN`, `QUOTATION_CLOSED`, `CLOSED`, and `CANCELLED`. Publication requires valid lines and eligible suppliers, supplier eligibility is revalidated at publication, clarification questions require `CLARIFICATION_OPEN`, quotations require `QUOTATION_OPEN`, and closure is allowed after the quotation deadline while preserving all history. Source request and line snapshots prevent later request changes from silently changing published sourcing content.

Quotation monetary columns use PostgreSQL `numeric`, never floating point. A tenant-scoped unique constraint permits one current quotation for each RFQ and supplier. Immutable revision snapshots preserve each submitted offer.

## Permissions

Phase 2B permissions distinguish supplier administration, sourcing administration, buyer commercial access, and supplier-portal actions. Supplier-portal permissions do not imply any internal procurement permission.

## Future boundary

PR #5 is intentionally scoped as the secure Phase 2B backend foundation. The complete internal sourcing UI, supplier portal experience, and role-aware operational workspaces will be implemented in Phase 2C. Evaluation, negotiation, award recommendations, purchase orders, receiving, invoicing, and final analytics remain future phases.
