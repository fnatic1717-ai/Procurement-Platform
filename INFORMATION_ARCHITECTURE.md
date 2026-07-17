# Information Architecture

## Purpose

Define the core information model and navigation domains for the procurement SaaS foundation without implementing application pages before architecture approval.

## Core Domains

- Tenant and organization setup.
- Identity and access management.
- Supplier management.
- Requisition management.
- Approval management.
- RFQ and quotation management.
- Evaluation, negotiation, and award management.
- Purchase order management.
- Delivery and goods receipt.
- Invoice matching.
- Supplier performance.
- Reporting and export.
- Audit and compliance.

## Primary Objects

### Tenant

Represents a customer organization. Owns configuration, users, suppliers, workflows, records, and audit events.

### Organization Unit

Represents departments, cost centers, locations, and operational structures used for routing and reporting.

### Supplier

Represents a vendor organization with qualification status, contacts, categories, compliance records, and performance history.

### Requisition

Represents an internal purchase request with business justification, line items, requester, approval path, and conversion references.

### RFQ

Represents a sourcing event with supplier invitations, terms, criteria, attachments, clarifications, and deadlines.

### Quotation

Represents a supplier response to an RFQ with pricing, lead time, compliance responses, and validity.

### Evaluation

Represents buyer and evaluator assessment of quotations against defined criteria.

### Negotiation

Represents offer revisions, supplier communications, and commercial negotiation history.

### Award

Represents the decision to select supplier offers for purchase.

### Purchase Order

Represents a buyer commitment to a supplier with commercial, delivery, tax, and payment details.

### Delivery

Represents supplier shipment or delivery events against PO lines.

### Goods Receipt

Represents accepted or rejected goods or services received against PO lines.

### Invoice Match

Represents invoice validation against PO and receipt data.

### Supplier Performance Record

Represents measurable supplier outcomes and exceptions.

## Navigation Domains for Future Application Design

MVP IA may later map to these navigation areas after architecture approval:

- Requests.
- Sourcing.
- Purchase Orders.
- Receiving.
- Invoices.
- Suppliers.
- Administration.
- Reports.
- Audit.

These are conceptual domains, not authorization to implement pages immediately.

## Search and Filtering Foundations

Core records should support tenant-scoped search by:

- Record number.
- Supplier.
- Requester.
- Department.
- Status.
- Date range.
- Amount range.
- Category.
- Assigned approver or buyer.

## Content and Language Rules

- All MVP user-facing product text and documentation must be English-only.
- Field names should be clear, business-readable, and stable for future localization.
- Avoid placeholder content and mock operational data in production flows.

## MVP Boundaries

The information architecture defines object relationships and navigation concepts only. Nonessential dashboards, decorative KPIs, mock data, and application page implementation remain excluded until architecture review approval.
