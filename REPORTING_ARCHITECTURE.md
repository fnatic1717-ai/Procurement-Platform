# Reporting Architecture

## Purpose
Define MVP reporting capabilities that support operational transparency, auditability, and export without introducing nonessential dashboards or decorative KPIs.

## Reporting Principles
- Reports must be permission-aware and tenant-scoped.
- Operational records are the source of truth.
- Exportable datasets are preferred over dashboard-first design in MVP.
- Metrics must be traceable to records and definitions.
- Supplier commercial data must remain protected.

## MVP Report Categories

### Requisition Reports
- Requisition status by requester, department, category, and date range.
- Approval aging by workflow step.
- Rejected and change-requested requisitions with reasons.

### Sourcing Reports
- RFQs by status, buyer, category, supplier invitation count, and deadline.
- Supplier quotation submission history.
- Award decisions with documented justification.

### Purchase Order Reports
- POs by status, supplier, buyer, department, date range, and amount.
- Open commitments by supplier and cost center.
- PO amendments and cancellation history.

### Receiving Reports
- Goods receipts by PO, supplier, location, received date, and discrepancy status.
- Partial receipt and rejection history.

### Invoice Matching Reports
- Invoice match status.
- Match exceptions by type, owner, age, and resolution.
- Invoices approved for payment.

### Supplier Performance Reports
- Delivery timeliness events.
- Quality rejection events.
- Quotation responsiveness.
- PO acknowledgement performance.
- Exception and dispute history.

### Audit Reports
- Approval decisions.
- Role and permission changes.
- Supplier access events.
- Record state transitions.
- Administrative support access.

## Data Access Rules
- Report visibility follows the same authorization model as operational records.
- Supplier users can only access reports about their own submitted quotations, orders, deliveries, invoices, and performance feedback where enabled.
- Exports must record audit events with user, timestamp, report type, filters, and file reference.

## Export Formats
MVP exports should support CSV for structured operational data. PDF exports and formatted management packs are not part of MVP unless required by compliance review.

## Metric Definitions
Any metric introduced must define:

- Name.
- Business definition.
- Source objects.
- Filters.
- Calculation logic.
- Permission rules.
- Known limitations.

## MVP Boundaries
MVP reporting excludes nonessential dashboards, decorative KPIs, mock analytics, predictive insights, and data warehouse implementation. Reports should support review, audit, and operational execution only.
