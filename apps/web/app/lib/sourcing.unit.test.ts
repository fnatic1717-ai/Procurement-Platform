import { describe, expect, it, vi } from 'vitest';
import { canonicalize, IdempotencyStore } from './idempotency';
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
  it('canonicalizes nested payloads independent of object key order', () => {
    expect(canonicalize({ z: [{ b: 2, a: 1 }], a: 'x' })).toBe(
      canonicalize({ a: 'x', z: [{ a: 1, b: 2 }] }),
    );
  });
  it('atomically prepares, starts and reuses an idempotency key for unchanged failed payloads', () => {
    vi.stubGlobal('crypto', {
      randomUUID: vi.fn().mockReturnValueOnce('k1').mockReturnValueOnce('k2'),
    });
    const store = new IdempotencyStore();
    const first = store.prepare('transition', { version: 1, status: 'PUBLISHED' });
    expect(first?.key).toBe('k1');
    expect(store.prepare('transition', { status: 'PUBLISHED', version: 1 })).toBeNull();
    store.finish('transition', false);
    expect(store.prepare('transition', { status: 'PUBLISHED', version: 1 })?.key).toBe('k1');
    store.finish('transition', true);
    expect(store.prepare('transition', { version: 1, status: 'PUBLISHED' })?.key).toBe('k2');
    vi.unstubAllGlobals();
  });
  it('normalizes session expiry, forbidden and stale-version conflicts', () => {
    expect(normalizeError(401, {}).kind).toBe('unauthorized');
    expect(normalizeError(403, {}).kind).toBe('forbidden');
    expect(normalizeError(409, { message: 'Version or state conflict' }).kind).toBe('conflict');
  });
});
