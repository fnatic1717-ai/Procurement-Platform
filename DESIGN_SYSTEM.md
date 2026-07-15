# Design System

## Purpose
Define design foundations for a future procurement application without implementing application pages before architecture approval.

## Design Principles
- Clarity over decoration.
- Workflow state visibility over decorative KPIs.
- Accessibility by default.
- Consistency across internal buyer users and external supplier users.
- English-only MVP content.
- Enterprise-grade density with readable hierarchy.

## MVP UI Foundations
The MVP design system should define reusable foundations only:

- Typography scale.
- Color tokens.
- Spacing tokens.
- Layout grid rules.
- Form patterns.
- Table patterns.
- Status badges.
- Workflow step indicators.
- Approval decision controls.
- Empty, loading, success, warning, error, and permission-denied states.
- File attachment patterns.
- Audit timeline pattern.

## Color Semantics
- Neutral: default text, surfaces, borders, and structural UI.
- Primary: main actions and active navigation.
- Success: approved, matched, received, acknowledged, completed.
- Warning: pending, attention required, approaching deadline, partial receipt.
- Danger: rejected, cancelled, failed match, overdue, security issue.
- Info: draft, submitted, clarification, informational guidance.

Colors must meet accessibility contrast requirements.

## Content Style
- Use plain business English.
- Prefer action-oriented labels such as Submit Requisition, Approve, Request Changes, Publish RFQ, Submit Quotation, Issue PO, Record Receipt, and Resolve Exception.
- Avoid ambiguous labels such as Process, Handle, Manage, or Complete without object context.
- Do not use decorative metrics or vanity dashboard language in MVP.

## Component Behavior Requirements

### Forms
- Required fields must be explicit.
- Validation messages must explain what to fix.
- Monetary fields require currency.
- Date fields must show tenant-configured format in future UI.
- Attachments must show file name, type, size, uploader, and timestamp.

### Tables
- Tables must support status, date, owner, supplier, and amount columns where relevant.
- Bulk actions are excluded from MVP unless explicitly approved.
- Exports must respect permissions.

### Workflow Indicators
- Show current state, completed states, pending approver or owner, and blocked exceptions.
- Do not imply approval when a workflow is merely submitted.

### Supplier-Facing Patterns
- Clearly distinguish buyer instructions from supplier response fields.
- Hide internal evaluation, budget, approval, and competing supplier data.

## Accessibility Requirements
- Keyboard navigability.
- Visible focus states.
- Semantic headings and labels.
- Sufficient color contrast.
- Error messages associated with inputs.
- No status communicated by color alone.

## MVP Boundaries
The design system is limited to foundations and patterns. It explicitly excludes building application pages, decorative dashboards, mock data screens, and nonessential KPI widgets before architecture review and approval.
