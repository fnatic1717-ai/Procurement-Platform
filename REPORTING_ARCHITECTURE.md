# Reporting Architecture

## Purpose

Define production-grade MVP reporting, dashboards, analytics, Excel workbooks, and PDF reporting for a commercially sellable multi-tenant procurement SaaS. Reporting must support real procurement decisions using operational data, while excluding decorative, fake, vanity, or unsupported KPIs.

## Reporting Principles

- Reports, dashboards, analytics, and downloads must be tenant-scoped and permission-aware.
- Operational procurement records are the source of truth.
- Every KPI must have a documented business purpose, formula, source objects, filters, permission rules, refresh behavior, and limitations.
- Supplier commercial data must remain confidential and must never be exposed to competing suppliers.
- Charts are allowed when they support procurement decisions; decorative charts are not allowed.
- Export and PDF generation must be asynchronous for large reports, auditable, template-versioned, and stored securely.

## MVP Procurement Dashboard

The MVP includes a practical dashboard for authorized internal users. It uses real operational data and supports prioritization, exception handling, sourcing decisions, and management review.

Dashboard sections:

- Action queue: requisitions pending approval, RFQs closing soon, awards pending approval, POs pending supplier acknowledgement, receipts pending, and invoice exceptions.
- Spend and savings: committed spend, awarded savings, negotiated savings, and spend by supplier, category, department, and cost center.
- Process health: requisition aging, approval aging, procurement cycle time, RFQ competition, and SLA performance.
- Purchasing and fulfillment: open commitments, PO status, delivery performance, partial receipts, rejected receipts, and overdue deliveries.
- Finance exceptions: invoice match exceptions by type, age, supplier, buyer, and financial impact.
- Supplier performance: responsiveness, delivery timeliness, quality exceptions, PO acknowledgement timeliness, and dispute history.

## MVP KPI Catalog

Each MVP KPI must be implemented from permission-aware datasets and documented before release.

| KPI                     | Formula                                                                                                                                                       | Source Data                                                              | Filters                                                                    | Permissions                                                                                                   | Refresh                                                                                     | Limitations                                                               |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Spend                   | Sum of approved PO line net amounts converted to tenant reporting currency using stored exchange-rate reference.                                              | Purchase orders, PO lines, currencies, exchange-rate references.         | Date range, supplier, category, department, cost center, buyer, PO status. | Internal requester scope, buyer scope, finance scope, procurement manager scope, tenant admin scope.          | Near real-time from operational reads; cached aggregates refresh at least every 15 minutes. | Excludes cancelled PO lines and unapproved drafts.                        |
| Savings                 | Baseline amount minus awarded amount, where baseline is approved budget, previous price, or RFQ best non-awarded comparable price according to tenant policy. | Requisitions, RFQs, quotations, awards, PO lines, savings basis records. | Date range, category, supplier, buyer, department, sourcing event.         | Procurement and finance roles only unless tenant policy broadens access.                                      | Refresh after award approval and PO creation.                                               | Requires explicit savings basis; unsupported estimates are excluded.      |
| Requisition Aging       | Current timestamp minus requisition submitted timestamp for non-final requisitions.                                                                           | Requisitions, approval workflows.                                        | Department, requester, approver, category, status, age bucket.             | Users see own or assigned scope; managers see department; procurement and admins see configured tenant scope. | Near real-time.                                                                             | Paused workflows must show paused duration separately.                    |
| Approval Aging          | Current timestamp minus approval step assigned timestamp for pending approval steps.                                                                          | Approval workflows, approval steps, approval decisions.                  | Approver, department, amount band, category, policy version.               | Assigned approvers, managers, procurement managers, tenant admins.                                            | Near real-time.                                                                             | Delegated approvals show original and delegated assignee.                 |
| Procurement Cycle Time  | PO issued timestamp minus requisition submitted timestamp, grouped by completed procurement path.                                                             | Requisitions, RFQs, awards, purchase orders.                             | Category, supplier, buyer, department, amount band, sourcing path.         | Procurement managers, buyers for their scope, tenant admins.                                                  | Refresh on PO issue and nightly aggregate rebuild.                                          | Excludes cancelled records; emergency purchases reported separately.      |
| RFQ Competition         | Count of valid quotations submitted divided by invited suppliers for closed RFQs.                                                                             | RFQs, supplier invitations, quotations.                                  | Category, buyer, supplier segment, date range.                             | Procurement roles and tenant admins.                                                                          | Refresh after RFQ close.                                                                    | Suppliers cannot see competition metrics for active or historical events. |
| Open Commitments        | Sum of approved and issued PO line remaining value not fully received, cancelled, or closed.                                                                  | Purchase orders, PO lines, receipts, invoices.                           | Supplier, cost center, department, delivery date, category.                | Finance, procurement, requester scope, manager scope.                                                         | Near real-time; cached aggregates refresh at least every 15 minutes.                        | Depends on receipt accuracy and PO closure discipline.                    |
| PO Status               | Count and value of POs by lifecycle status.                                                                                                                   | Purchase orders, PO versions, acknowledgements.                          | Supplier, buyer, department, category, date range.                         | Internal authorized roles; suppliers only see their own POs.                                                  | Near real-time.                                                                             | Amended POs report current version unless historical view is selected.    |
| Delivery Performance    | On-time received PO lines divided by PO lines due in selected period.                                                                                         | Delivery schedules, goods receipts, PO lines.                            | Supplier, category, location, buyer, date range.                           | Procurement, receiving, finance, tenant admins; suppliers see own performance where enabled.                  | Refresh after receipt posting and nightly aggregate rebuild.                                | Requires accurate promised delivery dates.                                |
| Invoice Exceptions      | Count and value of open invoice match exceptions by exception type and age.                                                                                   | Invoices, invoice lines, invoice matches, match exceptions.              | Supplier, buyer, finance owner, exception type, age bucket.                | Finance and procurement roles; requester only when assigned.                                                  | Near real-time.                                                                             | Excludes invoices not yet captured in the system.                         |
| Supplier Responsiveness | Median time from RFQ publication to valid quotation submission, plus quote submission rate.                                                                   | RFQs, invitations, quotations.                                           | Supplier, category, date range, event type.                                | Procurement roles and tenant admins; supplier sees own values where enabled.                                  | Refresh after RFQ close.                                                                    | Events with no quotation are included in submission-rate denominator.     |
| Supplier Quality        | Accepted quantity divided by received quantity, adjusted by quality rejection events.                                                                         | Goods receipt lines, inspection notes, supplier performance events.      | Supplier, category, location, date range.                                  | Procurement, receiving, quality-enabled roles, tenant admins.                                                 | Refresh after receipt or inspection update.                                                 | Service receipts require tenant-defined acceptance criteria.              |
| SLA Performance         | Count of workflow steps completed within configured SLA divided by total completed SLA-tracked steps.                                                         | Workflow steps, decisions, tenant SLA policies.                          | Workflow type, role, department, category, date range.                     | Managers, procurement managers, tenant admins.                                                                | Refresh on workflow decision and nightly aggregate rebuild.                                 | SLA pauses and policy changes must be versioned.                          |

## Professional Excel Reporting

MVP Excel exports must generate production-grade `.xlsx` workbooks, not CSV-only downloads.

Workbook requirements:

- Branded company templates with tenant logo, report title, generated timestamp, generated-by user, tenant name, filters, confidentiality label, and template version.
- Formatted worksheets with frozen headers, autofilters, column widths, number formats, date formats, currency formats, totals, subtotals, and protected formula cells where appropriate.
- Formulas for totals, variances, savings, percentages, exception age, and summary tabs where formulas provide reviewer transparency.
- Conditional formatting for overdue approvals, late deliveries, invoice exceptions, unfavorable variance, high-risk suppliers, and SLA breaches.
- Charts only where they support decisions, such as spend by category, supplier performance trend, approval aging distribution, invoice exception mix, and savings trend.
- Workbook metadata including tenant, report type, source data timestamp, filters, user, template version, application version, and data classification.
- Permission-aware datasets generated server-side; unauthorized columns and rows must be omitted before workbook rendering.

MVP Excel reports:

- Requisition aging workbook.
- Approval aging workbook.
- RFQ competition and quotation comparison workbook.
- Award recommendation support workbook.
- PO status and open commitments workbook.
- Delivery performance workbook.
- Invoice exception workbook.
- Supplier performance workbook.
- Spend and savings workbook.
- Monthly procurement management workbook.

## Branded PDF Reporting

MVP PDF reports must use branded templates suitable for internal approval, supplier communication, and management review.

PDF report types:

- Quotation comparison report.
- Award recommendation report.
- Purchase order document.
- Spend analysis report.
- Supplier performance report.
- Savings report.
- Approval history report.
- Monthly procurement management report.

PDF requirements:

- Tenant branding, document number, version, confidentiality label, page numbers, generated timestamp, and generated-by user.
- Template-versioned headers, footers, typography, tables, signatures or approval blocks where applicable, and controlled disclaimers.
- Permission-aware content assembly before rendering.
- PDF/A readiness for archival copies where required by tenant policy.
- Optional charts only when they explain a procurement decision or management trend.

## Rendering and Delivery Architecture

- Reports are requested through an authorized API that validates tenant, role, object scope, filters, and export permission.
- Small operational summaries may render synchronously; large Excel and PDF outputs must run as background jobs.
- Background jobs execute with explicit tenant context, report type, user identity, filters, template version, and correlation ID.
- Rendered files are stored in private object storage with tenant-scoped object keys, encryption at rest, retention policy, and malware scanning where user-provided content is embedded.
- Downloads use signed temporary URLs after a fresh authorization check.
- Every report request, render completion, failed render, and download must create an audit event.
- Report templates are versioned; historical generated reports retain the template version used at generation time.
- Failed jobs must expose safe error messages and detailed redacted logs for operators.

## Data Access Rules

- Report visibility follows the same authorization model as operational records.
- Supplier users can only access reports about their own quotations, orders, deliveries, invoices, and supplier performance where enabled by tenant policy.
- Supplier users must never access competing quotations, internal budgets, evaluations, approval history, or buyer negotiation records.
- Exports must record audit events with user, timestamp, report type, filters, file reference, template version, and dataset scope.

## MVP Boundaries

MVP reporting includes practical dashboards, analytics, professional Excel, and branded PDF reports. It excludes decorative dashboards, fake data, vanity KPIs, unsupported metrics, predictive data science, and features without a real procurement business purpose.
