import { describe, expect, it, vi } from 'vitest';
import { issueSessionCookie, verifySessionCookie } from '../src/auth/session.js';

describe('signed procurement session cookies', () => {
  const payload = {
    userId: '11111111-1111-4111-8111-111111111111',
    tenantId: '22222222-2222-4222-8222-222222222222',
    membershipId: '33333333-3333-4333-8333-333333333333',
    iat: 1_700_000_000,
    exp: 1_700_003_600,
  };
  it('issues and verifies a signed cookie with membership and expiry claims', () => {
    vi.stubEnv('PROCUREMENT_SESSION_SECRET', 'x'.repeat(40));
    const cookie = issueSessionCookie(payload);
    expect(verifySessionCookie(cookie, payload.iat + 1)).toMatchObject(payload);
    vi.unstubAllEnvs();
  });
  it('rejects tampered, malformed and expired cookies', () => {
    vi.stubEnv('PROCUREMENT_SESSION_SECRET', 'x'.repeat(40));
    const cookie = issueSessionCookie(payload);
    expect(verifySessionCookie(`${cookie.slice(0, -2)}aa`, payload.iat + 1)).toBeNull();
    expect(verifySessionCookie('not-json', payload.iat + 1)).toBeNull();
    expect(verifySessionCookie(cookie, payload.exp + 1)).toBeNull();
    vi.unstubAllEnvs();
  });
});
