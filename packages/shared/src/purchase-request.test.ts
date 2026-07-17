import { describe, expect, it } from 'vitest';
import { assertPurchaseRequestTransition, isPurchaseRequestEditable } from './index.js';
describe('purchase request state machine', () => {
  it('allows submit, return, resubmit and final intake progression', () => {
    expect(() => assertPurchaseRequestTransition('DRAFT', 'SUBMITTED')).not.toThrow();
    expect(() =>
      assertPurchaseRequestTransition('PENDING_APPROVAL', 'RETURNED_TO_REQUESTER'),
    ).not.toThrow();
    expect(() =>
      assertPurchaseRequestTransition('RETURNED_TO_REQUESTER', 'SUBMITTED'),
    ).not.toThrow();
    expect(() =>
      assertPurchaseRequestTransition('APPROVED', 'IN_PROCUREMENT_REVIEW'),
    ).not.toThrow();
  });
  it('locks submitted and terminal records', () => {
    expect(isPurchaseRequestEditable('DRAFT')).toBe(true);
    expect(isPurchaseRequestEditable('RETURNED_TO_REQUESTER')).toBe(true);
    expect(isPurchaseRequestEditable('APPROVED')).toBe(false);
    expect(() => assertPurchaseRequestTransition('APPROVED', 'DRAFT')).toThrow(/Illegal/);
  });
  it('allows authorized lifecycle cancellation only from eligible states', () => {
    expect(() => assertPurchaseRequestTransition('DRAFT', 'CANCELLED')).not.toThrow();
    expect(() => assertPurchaseRequestTransition('PENDING_APPROVAL', 'CANCELLED')).not.toThrow();
    expect(() => assertPurchaseRequestTransition('APPROVED', 'CANCELLED')).not.toThrow();
    expect(() => assertPurchaseRequestTransition('REJECTED', 'CANCELLED')).toThrow(/Illegal/);
  });
});
