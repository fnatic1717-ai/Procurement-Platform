import { describe, expect, it, vi } from 'vitest';
import { IdempotencyStore } from './idempotency';
import { normalizeError } from './api';
import { validateRfqDraft } from './validation';

describe('Phase 2C-1 frontend safeguards', () => {
  it('validates RFQ draft fields and date ordering', () => {
    const errors = validateRfqDraft({
      title: '',
      currency: 'US',
      procurementCategory: '',
      clarificationDeadline: '2026-08-02T10:00',
      submissionDeadline: '2026-08-01T10:00',
      requiredBy: '',
      deliveryLocation: '',
    });
    expect(errors.title).toBeDefined();
    expect(errors.currency).toBeDefined();
    expect(errors.submissionDeadline).toContain('after');
  });
  it('reuses an idempotency key for unchanged payload until success', () => {
    vi.stubGlobal('crypto', {
      randomUUID: vi.fn().mockReturnValueOnce('k1').mockReturnValueOnce('k2'),
    });
    const store = new IdempotencyStore();
    expect(store.keyFor('transition', { version: 1, status: 'PUBLISHED' })).toBe('k1');
    expect(store.keyFor('transition', { status: 'PUBLISHED', version: 1 })).toBe('k1');
    store.finish('transition', true);
    expect(store.keyFor('transition', { version: 1, status: 'PUBLISHED' })).toBe('k2');
    vi.unstubAllGlobals();
  });
  it('prevents repeated button clicks while a mutation is processing', () => {
    const store = new IdempotencyStore();
    store.keyFor('cancel', { version: 1, reason: 'duplicate' });
    expect(store.start('cancel')).toBe(true);
    expect(store.start('cancel')).toBe(false);
  });
  it('normalizes session expiry, forbidden and stale-version conflicts', () => {
    expect(normalizeError(401, {}).kind).toBe('unauthorized');
    expect(normalizeError(403, {}).kind).toBe('forbidden');
    expect(normalizeError(409, { message: 'Version or state conflict' }).kind).toBe('conflict');
  });
});
