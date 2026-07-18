import { describe, expect, it } from 'vitest';
import {
  ApiError,
  normalizeError,
  pageParams,
  validTransitionActions,
  validateRfqDraft,
  visibleModules,
} from './sourcing';
const buyer = { permissions: ['rfqs.read', 'rfqs.create', 'rfqs.publish', 'suppliers.read'] };
describe('internal sourcing unit helpers', () => {
  it('derives permission-aware navigation from persisted permissions', () => {
    expect(visibleModules(buyer).map((m) => m.key)).toEqual([
      'overview',
      'rfqs',
      'suppliers',
      'activity',
    ]);
    expect(visibleModules({ permissions: [] })).toEqual([]);
  });
  it('returns state actions only for authorized statuses', () => {
    expect(validTransitionActions('DRAFT', buyer)).toEqual(['READY_FOR_REVIEW']);
    expect(validTransitionActions('CLOSED', buyer)).toEqual([]);
    expect(validTransitionActions('DRAFT', { permissions: ['rfqs.read'] })).toEqual([]);
  });
  it('validates draft dates and required fields before backend submission', () => {
    const errors = validateRfqDraft({
      title: '',
      currency: 'US',
      procurementCategory: '',
      deliveryLocation: '',
      clarificationDeadline: '2026-08-10T10:00',
      submissionDeadline: '2026-08-09T10:00',
      requiredBy: '',
    });
    expect(errors.title).toBeDefined();
    expect(errors.currency).toBeDefined();
    expect(errors.submissionDeadline).toContain('after');
  });
  it('preserves pagination and filter URL parameters', () => {
    expect(pageParams('?page=3&limit=10&search=steel&status=DRAFT').page).toBe(3);
    expect(pageParams('?page=3&limit=10&search=steel&status=DRAFT').status).toBe('DRAFT');
  });
  it('normalizes API errors including stale-version conflicts', () => {
    expect(normalizeError(409, { message: 'Version or state conflict' })).toBeInstanceOf(ApiError);
    expect(normalizeError(409, {}).kind).toBe('conflict');
    expect(normalizeError(403, {}).kind).toBe('forbidden');
  });
});
