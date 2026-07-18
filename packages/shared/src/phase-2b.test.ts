import { describe, expect, it } from 'vitest';
import {
  assertBeforeDeadline,
  assertRfqTransition,
  assertSupplierEligibleForInvitation,
  assertSupplierTransition,
  calculateNetLineAmount,
} from './index.js';
describe('Phase 2B domain invariants', () => {
  it('requires active approved suppliers', () => {
    expect(() => assertSupplierEligibleForInvitation('SUSPENDED', 'APPROVED')).toThrow();
    expect(() => assertSupplierEligibleForInvitation('ACTIVE', 'APPROVED')).not.toThrow();
  });
  it('enforces lifecycle transitions', () => {
    expect(() => assertSupplierTransition('DRAFT', 'ACTIVE')).toThrow();
    expect(() => assertRfqTransition('DRAFT', 'PUBLISHED')).toThrow();
    expect(() => assertRfqTransition('QUOTATION_CLOSED', 'CLOSED')).not.toThrow();
  });
  it('enforces deadlines', () =>
    expect(() => assertBeforeDeadline(new Date('2025-01-01'), new Date('2025-01-02'))).toThrow());
  it('calculates money without floating point', () =>
    expect(calculateNetLineAmount('3.0000', '10.1250', '0.3750', '1.2500')).toBe('31.2500'));
});

describe('sourcing idempotency payload canonicalization', () => {
  it('is independent of object key order and changes with payload', async () => {
    const { sourcingPayloadHash } = await import('./index.js');
    expect(sourcingPayloadHash({ version: 1, reason: 'a' })).toBe(
      sourcingPayloadHash({ reason: 'a', version: 1 }),
    );
    expect(sourcingPayloadHash({ version: 1 })).not.toBe(sourcingPayloadHash({ version: 2 }));
  });
});
