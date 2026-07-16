# AGENTS.md

## Repository Instructions

This repository defines a production-grade, multi-tenant B2B procurement SaaS foundation. All contributors and automation agents must preserve the MVP scope and architecture-first delivery approach.

## Language

- All documentation and user-facing MVP text must be English-only.
- Use clear business terminology for procurement, sourcing, purchasing, receiving, invoicing, and supplier performance.

## MVP Scope Guardrails

Include:

- Purchase requisition lifecycle.
- Approval workflows.
- RFQ and quotation management.
- Evaluation, negotiation, and award.
- Purchase order lifecycle.
- Delivery and goods receipt.
- Invoice matching.
- Supplier performance records.
- Multi-tenant security, audit, practical dashboards, analytics, professional Excel and PDF reporting, and deployment foundations.

Exclude until architecture review and approval:

- Decorative, fake, vanity, or unsupported dashboards and KPIs.
- Screens, metrics, icons, charts, or features without a real procurement business purpose.
- Mock data as product behavior.
- Application page implementation.
- Advanced analytics, AI recommendations, and marketplace features.

## Engineering Expectations

- Maintain tenant isolation in every design and implementation decision.
- Enforce role-based access control and workflow authorization server-side.
- Preserve immutable audit trails for lifecycle and security-sensitive events.
- Keep supplier quotation and commercial data confidential.
- Add tests for business rules, authorization, tenant isolation, and audit behavior.
- Never put try/catch blocks around imports.

## Documentation Expectations

- Keep documentation aligned with MVP boundaries.
- Prefer explicit workflow states and permission rules over vague descriptions.
- Document assumptions and future enhancements separately from MVP commitments.
- Do not add decorative metrics or dashboard requirements without explicit approval.
- Do not remove practical procurement dashboards, analytics, Excel reporting, or PDF reporting merely because they include charts; require real operational data and a clear business purpose.
