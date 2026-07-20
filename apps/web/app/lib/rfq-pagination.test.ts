import { describe, expect, it } from 'vitest';
import { updateRfqListQuery } from './api';

describe('RFQ list query updates', () => {
  it('preserves requested pagination for Next and Previous', () => {
    const base = new URLSearchParams('page=1&limit=10&status=PUBLISHED&search=steel');
    const next = updateRfqListQuery(base, 'page', '2');
    expect(next.get('page')).toBe('2');
    expect(next.get('status')).toBe('PUBLISHED');
    expect(next.get('search')).toBe('steel');
    const previous = updateRfqListQuery(next, 'page', '1');
    expect(previous.get('page')).toBe('1');
  });

  it('resets to page 1 when a filter changes', () => {
    const base = new URLSearchParams('page=3&limit=25&direction=desc&sort=created_at');
    const filtered = updateRfqListQuery(base, 'status', 'DRAFT');
    expect(filtered.get('page')).toBe('1');
    expect(filtered.get('limit')).toBe('25');
    expect(filtered.get('direction')).toBe('desc');
    expect(filtered.get('sort')).toBe('created_at');
  });
});
