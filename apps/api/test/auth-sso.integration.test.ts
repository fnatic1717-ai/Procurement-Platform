import { describe, expect, it, vi } from 'vitest';
import { createAuthProvider } from '../src/auth/auth.js';

describe('configured SSO provider integration contract', () => {
  it('initiates and completes provider authentication with the test identity provider', async () => {
    vi.stubEnv('TEST_IDP_USER_ID', '11111111-1111-4111-8111-111111111111');
    vi.stubEnv('TEST_IDP_SECRET', 's'.repeat(40));
    const provider = createAuthProvider({
      NODE_ENV: 'test',
      PORT: 3001,
      DATABASE_URL: 'postgresql://procurement:procurement@localhost:5432/procurement',
      REDIS_URL: 'redis://localhost:6379',
      AUTH_ADAPTER: 'test-idp',
      CORS_ORIGIN: 'http://localhost:3000',
      LOG_LEVEL: 'info',
    });
    const redirectTo = provider.authorizationUrl?.('state-1') ?? '';
    const callback = new URL(`http://localhost${redirectTo}`);
    await expect(
      provider.callback?.({
        state: callback.searchParams.get('state'),
        code: callback.searchParams.get('code'),
        userId: callback.searchParams.get('userId'),
      }),
    ).resolves.toEqual({
      userId: '11111111-1111-4111-8111-111111111111',
      subject: 'test-idp|11111111-1111-4111-8111-111111111111',
    });
    vi.unstubAllEnvs();
  });

  it('fails closed when production Auth0 SSO is missing client configuration', () => {
    const provider = createAuthProvider({
      NODE_ENV: 'production',
      PORT: 3001,
      DATABASE_URL: 'postgresql://procurement:procurement@localhost:5432/procurement',
      REDIS_URL: 'redis://localhost:6379',
      AUTH_ADAPTER: 'auth0',
      AUTH0_DOMAIN: 'example.auth0.com',
      AUTH0_AUDIENCE: 'procurement-api',
      CORS_ORIGIN: 'http://localhost:3000',
      LOG_LEVEL: 'info',
    });
    expect(() => provider.authorizationUrl?.('state-1')).toThrow(/client is not configured/);
  });
});
