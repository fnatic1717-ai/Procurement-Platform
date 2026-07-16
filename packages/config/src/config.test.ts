import { describe, expect, it } from 'vitest';
import { loadConfig } from './index.js';

const base = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  REDIS_URL: 'redis://localhost:6379',
};

describe('configuration validation', () => {
  it('rejects development auth in production', () => {
    expect(() =>
      loadConfig({ ...base, NODE_ENV: 'production', AUTH_ADAPTER: 'development' }),
    ).toThrow();
  });

  it('rejects incomplete Auth0 configuration', () => {
    expect(() => loadConfig({ ...base, NODE_ENV: 'production', AUTH_ADAPTER: 'auth0' })).toThrow();
  });

  it('accepts local test config', () => {
    expect(loadConfig({ ...base, NODE_ENV: 'test' }).AUTH_ADAPTER).toBe('development');
  });
});
