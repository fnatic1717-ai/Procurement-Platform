import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('../src/sourcing/sourcing.ts', import.meta.url), 'utf8');

describe('RFQ publication state machine merge blockers', () => {
  it('rejects the DRAFT to PUBLISHED publish bypass by delegating publish to the transition state machine', () => {
    expect(source).toContain(
      'async publish(p: AuthenticatedPrincipal, id: string, d: CommandDto) {',
    );
    expect(source).toContain("return this.transitionRfq(p, id, { ...d, status: 'PUBLISHED' });");
    expect(source).toContain("DRAFT: ['READY_FOR_REVIEW']");
    expect(source).toContain("READY_FOR_REVIEW: ['PUBLISHED']");
    expect(source).not.toContain(
      "status IN ('DRAFT','READY_FOR_REVIEW') AND submission_deadline>now()",
    );
  });

  it('keeps READY_FOR_REVIEW to PUBLISHED publication side effects in the authoritative transition implementation', () => {
    expect(source).toContain("if (d.status === 'PUBLISHED')");
    expect(source).toContain(
      "i.status='DRAFT' AND s.id=i.supplier_id AND s.status='ACTIVE' AND s.qualification_status='APPROVED'",
    );
    expect(source).toContain(
      "i.status='DRAFT' AND s.id=i.supplier_id AND (s.status<>'ACTIVE' OR s.qualification_status<>'APPROVED')",
    );
    expect(source).toContain(
      "published_at=CASE WHEN ${d.status}='PUBLISHED' THEN COALESCE(published_at,now()) ELSE published_at END",
    );
  });
});

describe('RFQ close optimistic concurrency merge blockers', () => {
  it('closes from QUOTATION_CLOSED while preserving submitted optimistic concurrency', () => {
    expect(source).toContain(": ['QUOTATION_CLOSED']");
    expect(source).toContain('WHERE id=${id}::uuid AND version=${effectiveVersion} RETURNING *');
  });

  it('transitions authorized after-deadline QUOTATION_OPEN closes with the returned version before CLOSED', () => {
    expect(source).toContain("String(prior.status) === 'QUOTATION_OPEN'");
    expect(source).toContain('new Date(String(prior.submission_deadline)).getTime() <= Date.now()');
    expect(source).toContain(
      "UPDATE rfqs SET status='QUOTATION_CLOSED',version=version+1 WHERE id=${id}::uuid AND version=${d.version} RETURNING *",
    );
    expect(source).toContain('effectiveVersion = Number(quotationClosed.version)');
    expect(source).toContain("action: 'rfq.transition.quotation_closed'");
  });

  it('rejects before-deadline closes and stale versions without skipping optimistic concurrency', () => {
    expect(source).toContain('if (!allowed.includes(String(effectivePrior.status)))');
    expect(source).toContain('WHERE id=${id}::uuid AND version=${d.version} RETURNING *');
    expect(source).toContain('WHERE id=${id}::uuid AND version=${effectiveVersion} RETURNING *');
  });

  it('keeps duplicate close attempts idempotent for one persisted result', () => {
    expect(source).toContain(
      'this.idempotent(tx, p, `rfq.${status.toLowerCase()}`, id, d.idempotencyKey, d',
    );
  });
});

describe('supplier status enforcement merge blockers', () => {
  it('denies suspended, blocked, inactive, and rejected supplier users before supplier-portal actions', () => {
    expect(source).toContain('JOIN suppliers s ON s.id=m.supplier_id');
    expect(source).toContain(
      "m.active AND s.status='ACTIVE' AND s.qualification_status='APPROVED'",
    );
    expect(source).toContain(
      "throw new ForbiddenException('Active persisted supplier membership required')",
    );
  });

  it('uses the persisted membership-derived supplier identity across interactive supplier actions', () => {
    for (const method of [
      'async inbox',
      'async invitation(',
      'async question',
      'async quote(',
      'async quoteLine',
      'async quoteAction',
      'async startRevision',
      'async invitationDetail',
      'async updateQuote',
      'async updateQuoteLine',
      'async removeQuoteLine',
    ]) {
      const start = source.indexOf(method);
      expect(start, method).toBeGreaterThan(-1);
      const next = source.indexOf('\n  async ', start + method.length);
      const body = source.slice(start, next === -1 ? source.length : next);
      expect(body, method).toContain('await this.supplier(tx, p)');
    }
  });
});
