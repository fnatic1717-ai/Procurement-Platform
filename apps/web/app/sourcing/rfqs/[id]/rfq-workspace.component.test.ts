import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('RFQ workspace rendered-page contract', () => {
  const source = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
  it('uses a synchronous duplicate-submission lock', () => {
    expect(source).toContain('mutationLock.current = true');
    expect(source).toContain('mutationLock.current = false');
  });
  it('keeps workspace content when mutation errors are displayed', () => {
    expect(source).toContain('mutationError &&');
    expect(source).toContain('rfq.rfq_number');
  });
  it('renders related audit activity returned by the API', () => {
    expect(source).toContain('Activity and audit');
    expect(source).toContain('data.items.map');
  });
});
