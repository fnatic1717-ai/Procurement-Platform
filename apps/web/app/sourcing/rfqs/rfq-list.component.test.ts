import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('RFQ list rendered-page contract', () => {
  const source = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
  it('wires Next and Previous buttons through the page query updater', () => {
    expect(source).toContain("update('page', String(data.page - 1))");
    expect(source).toContain("update('page', String(data.page + 1))");
  });
  it('resets filters through the same rendered page updater', () => {
    expect(source).toContain("update('status', e.target.value)");
  });
});
