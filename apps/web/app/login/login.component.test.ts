import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('LoginPage production UI contract', () => {
  const source = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
  it('shows signed-out SSO initiation instead of bearer-token or tenant UUID fields', () => {
    expect(source).toContain('Continue with SSO');
    expect(source).not.toContain('Identity-provider bearer token');
    expect(source).not.toContain('Tenant membership ID');
  });
  it('renders active persisted memberships for selection after provider authentication', () => {
    expect(source).toContain('Active tenant membership');
    expect(source).toContain('memberships.map');
  });
});
