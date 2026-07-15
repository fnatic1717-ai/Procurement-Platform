# Design System

## Purpose
Define a premium enterprise design foundation for a future English-only procurement application. The design must be modern, comfortable for long working hours, visually balanced, accessible, and focused on real procurement work rather than visual clutter or outdated ERP styling.

## Design Principles
- Clarity over decoration.
- Real procurement purpose for every screen, metric, icon, chart, and interaction.
- Comfortable density for users who spend full working days in the system.
- Accessibility by default with WCAG 2.2 AA contrast targets.
- Consistent internal buyer, finance, receiving, and external supplier experiences with strict information separation.
- English-only MVP content.
- Meaningful icons only; icons must reinforce recognition and never replace clear labels.

## Premium Enterprise Color Tokens
Use a restrained neutral foundation with procurement-focused accents.

| Token | Hex | Usage | Accessibility Guidance |
| --- | --- | --- | --- |
| `color-bg-app` | `#F6F8FB` | Application background. | Pair with dark text. |
| `color-bg-surface` | `#FFFFFF` | Cards, forms, tables, modals. | Default content surface. |
| `color-bg-subtle` | `#EEF3F8` | Subtle panels and filter bars. | Use sparingly. |
| `color-text-primary` | `#172033` | Primary text. | Meets AA on light surfaces. |
| `color-text-secondary` | `#4D5B70` | Supporting text. | Use for metadata. |
| `color-text-muted` | `#6F7D91` | Low-emphasis labels. | Do not use for critical text. |
| `color-border` | `#D8E0EA` | Default borders. | Keep low contrast but visible. |
| `color-primary` | `#1F5EFF` | Primary actions, active navigation. | Use with white text. |
| `color-primary-hover` | `#1749C7` | Primary hover state. | Use with white text. |
| `color-accent` | `#00A6A6` | Secondary accent and selected analytics highlights. | Avoid overuse. |
| `color-success` | `#168A4A` | Approved, matched, received, on-track. | Pair with success background. |
| `color-success-bg` | `#E7F6EE` | Success badge background. | Do not rely on color alone. |
| `color-warning` | `#B7791F` | Pending, aging, near SLA breach. | Pair with warning icon and label. |
| `color-warning-bg` | `#FFF4D6` | Warning badge background. | Use for attention states. |
| `color-danger` | `#C0362C` | Rejected, overdue, exception, security risk. | Pair with clear copy. |
| `color-danger-bg` | `#FCE8E6` | Danger badge background. | Use for critical states. |
| `color-info` | `#2563A8` | Draft, submitted, clarification. | Pair with info background. |
| `color-info-bg` | `#E7F0FB` | Info badge background. | Use for neutral workflow states. |

## Typography
- Font family: Inter for application UI, with system fallback `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, `sans-serif`.
- Numeric tables may use tabular numerals for alignment.
- Base body size: 14 px with 20 px line height.
- Page title: 24 px, 32 px line height, 600 weight.
- Section heading: 18 px, 28 px line height, 600 weight.
- Card heading: 16 px, 24 px line height, 600 weight.
- Table and form labels: 13 px to 14 px, 500 weight.
- Helper text: 12 px to 13 px, 18 px line height.

## Spacing, Radius, and Shadows
- Spacing scale: 4, 8, 12, 16, 20, 24, 32, 40, and 48 px.
- Border radius: 6 px for inputs and compact controls, 10 px for cards, 12 px for modals and drawers.
- Shadows: subtle only. Use `0 1px 2px rgba(16, 24, 40, 0.06)` for cards and `0 16px 40px rgba(16, 24, 40, 0.16)` for modals.
- Avoid heavy gradients, bevels, skeuomorphic panels, and dense ERP-era chrome.

## Layout and Navigation
- Side navigation supports primary domains: Requests, Sourcing, Purchase Orders, Receiving, Invoices, Suppliers, Reports, Administration, and Audit.
- Header includes tenant context, search entry point, notifications, help, and user menu.
- Main content uses a max-width appropriate to data-heavy workflows, with full-width table modes for operational queues.
- Cards group related decisions and should not be used as decorative KPI tiles without decision purpose.
- Filter bars appear above tables and reports with saved views available in future phases.

## Tables and Density
- Default row height: 44 px for operational tables.
- Compact row height: 36 px for power users where accessibility remains acceptable.
- Headers are sticky for long tables.
- Numeric columns align right; text columns align left; status columns use labels and icons.
- Tables support sorting, filtering, pagination, column visibility, and export where authorized.
- Frozen columns may be used for record number and supplier in wide procurement comparison tables.

## Forms
- Use single-column layouts for short forms and two-column responsive grids for procurement records with many fields.
- Required fields must be marked and validated server-side and client-side.
- Monetary inputs must include currency and precision.
- Date inputs must clearly distinguish required date, promised date, due date, and submitted date.
- Long forms should be divided into logical sections such as Header, Lines, Attachments, Approvals, and Audit.

## Status Colors and Workflow Indicators
- Workflow states must show label, color, and icon or shape; color alone is insufficient.
- Approval states distinguish Draft, Submitted, Under Review, Changes Requested, Approved, Rejected, Cancelled, and Converted.
- PO states distinguish Draft, Pending Approval, Approved, Issued, Acknowledged, Partially Delivered, Fully Delivered, Closed, Cancelled, and Amended.
- Invoice states distinguish Received, Matching, Matched, Exception, Approved for Payment, and Rejected.

## Charts and Analytics
- Charts are included when they support decisions such as spend trend, savings trend, approval aging, invoice exception mix, RFQ competition, and supplier performance.
- Default chart palette must be accessible, restrained, and consistent with semantic colors.
- Chart labels must include units, date ranges, and filter context.
- Never use decorative charts, fake KPI tiles, unsupported metrics, or visuals without actionable procurement purpose.

## Modals, Drawers, and Empty States
- Modals are reserved for focused decisions, confirmations, and short forms.
- Drawers support contextual review such as approval history, supplier summary, quotation details, and audit timeline.
- Empty states must explain why no data appears, which filters are active, and what authorized action can be taken.
- Permission-denied states must be safe and must not reveal confidential supplier or tenant data.

## Responsive Behavior
- Desktop-first for procurement power workflows, with responsive support for tablets and smaller screens.
- Complex comparison tables may switch to horizontal scrolling with sticky identifiers.
- Approval actions, supplier quotation responses, and receipt confirmations must remain usable on mobile-sized screens where supported.

## MVP Boundaries
The design system defines foundations and reusable patterns. It does not authorize application page implementation before architecture approval, and it prohibits screens, metrics, icons, charts, or features without a real procurement business purpose.
