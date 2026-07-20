import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { correlationIdMiddleware } from '../src/common/correlation.js';
import { SafeExceptionFilter } from '../src/security/exception.filter.js';

const { Client } = createRequire(import.meta.url)(
  '../../../packages/database/node_modules/pg/lib/index.js',
) as { Client: new (config: { connectionString: string }) => PgClient };
type PgClient = {
  connect(): Promise<void>;
  end(): Promise<void>;
  query(sql: string, values?: unknown[]): Promise<{ rows: Record<string, any>[] }>;
};

const databaseUrl = process.env.DATABASE_URL;
if (process.env.CI && !databaseUrl)
  throw new Error('DATABASE_URL is required for Auth SSO PostgreSQL integration tests in CI');
const runWhenDatabase = databaseUrl ? describe : describe.skip;

const userId = '11111111-1111-4111-8111-111111111111';
const subject = 'test-idp|persisted-user';

runWhenDatabase('SSO API integration', () => {
  const suffix = randomUUID().replaceAll('-', '');
  const databaseName = `procurement_auth_sso_${suffix}`;
  const adminUrl = new URL(databaseUrl ?? 'postgresql://unused:unused@localhost/unused');
  const testUrl = new URL(databaseUrl ?? 'postgresql://unused:unused@localhost/unused');
  testUrl.pathname = `/${databaseName}`;
  let client: PgClient;

  beforeAll(async () => {
    adminUrl.pathname = '/postgres';
    const admin = new Client({ connectionString: adminUrl.toString() });
    await admin.connect();
    await admin.query(`CREATE DATABASE ${databaseName}`);
    await admin.end();

    process.env.DATABASE_URL = testUrl.toString();
    client = new Client({ connectionString: testUrl.toString() });
    await client.connect();
    for (const migration of [
      '../../../packages/database/prisma/migrations/0001_platform_foundation/migration.sql',
      '../../../packages/database/prisma/migrations/0002_phase_2a_purchase_requests/migration.sql',
      '../../../packages/database/prisma/migrations/0003_phase_2b_supplier_rfq/migration.sql',
    ]) {
      await client.query(readFileSync(new URL(migration, import.meta.url), 'utf8'));
    }
  });

  afterAll(async () => {
    await client?.end().catch(() => undefined);
    adminUrl.pathname = '/postgres';
    const admin = new Client({ connectionString: adminUrl.toString() });
    await admin.connect();
    await admin.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1', [
      databaseName,
    ]);
    await admin.query(`DROP DATABASE IF EXISTS ${databaseName}`);
    await admin.end();
  });

  beforeEach(async () => {
    vi.unstubAllEnvs();
    process.env.DATABASE_URL = testUrl.toString();
    await client.query('DELETE FROM tenant_memberships WHERE user_id=$1', [userId]);
    await client.query('DELETE FROM users WHERE id=$1 OR subject=$2', [userId, subject]);
    await client.query('INSERT INTO users(id,email,display_name,subject) VALUES($1,$2,$3,$4)', [
      userId,
      'sso-user@example.test',
      'SSO User',
      subject,
    ]);
  });

  async function createApp(env: Record<string, string | undefined>): Promise<INestApplication> {
    vi.stubEnv('NODE_ENV', env.NODE_ENV ?? 'test');
    vi.stubEnv('DATABASE_URL', testUrl.toString());
    vi.stubEnv('REDIS_URL', process.env.REDIS_URL ?? 'redis://localhost:6379');
    vi.stubEnv('AUTH_ADAPTER', env.AUTH_ADAPTER ?? 'test-idp');
    vi.stubEnv('AUTH0_DOMAIN', env.AUTH0_DOMAIN);
    vi.stubEnv('AUTH0_AUDIENCE', env.AUTH0_AUDIENCE);
    vi.stubEnv('AUTH0_CLIENT_ID', env.AUTH0_CLIENT_ID);
    vi.stubEnv('AUTH0_CLIENT_SECRET', env.AUTH0_CLIENT_SECRET);
    vi.stubEnv('AUTH_CALLBACK_URL', env.AUTH_CALLBACK_URL);
    vi.stubEnv('PROCUREMENT_SESSION_SECRET', 's'.repeat(40));
    vi.stubEnv('TEST_IDP_SUBJECT', subject);
    vi.stubEnv('TEST_IDP_SECRET', 't'.repeat(40));

    const app = await NestFactory.create(AppModule, { logger: false });
    app.use(correlationIdMiddleware);
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.useGlobalFilters(new SafeExceptionFilter());
    await app.init();
    return app;
  }

  function setCookies(response: request.Response): string[] {
    const value = response.headers['set-cookie'];
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
  }

  function cookieNamed(response: request.Response, name: string): string | undefined {
    return setCookies(response)
      .map((cookie) => cookie.split(';')[0])
      .find((cookie): cookie is string => Boolean(cookie?.startsWith(`${name}=`)));
  }

  it('returns a 302 identity-provider redirect and secure state cookie from GET /auth/sso/start', async () => {
    const app = await createApp({ AUTH_ADAPTER: 'test-idp' });
    try {
      const response = await request(app.getHttpServer()).get('/api/v1/auth/sso/start').expect(302);

      expect(response.headers.location).toMatch(/^\/api\/v1\/auth\/sso\/callback\?/);
      expect(cookieNamed(response, 'procurement_sso_state')).toBeDefined();
      expect(response.headers.location).toContain('state=');
      expect(response.headers.location).toContain('code=');
      expect(response.body).toEqual({});
    } finally {
      await app.close();
    }
  });

  it('rejects a callback with invalid state before completing provider authentication', async () => {
    const app = await createApp({ AUTH_ADAPTER: 'test-idp' });
    try {
      const start = await request(app.getHttpServer()).get('/api/v1/auth/sso/start').expect(302);
      const location = start.headers.location;
      expect(location).toBeDefined();
      const callback = new URL(`http://localhost${location}`);
      callback.searchParams.set('state', 'tampered-state');

      await request(app.getHttpServer())
        .get(`${callback.pathname}${callback.search}`)
        .set('Cookie', cookieNamed(start, 'procurement_sso_state') ?? '')
        .expect(401);
    } finally {
      await app.close();
    }
  });

  it('completes a persisted test-provider callback, clears temporary SSO cookie, and returns the actual login redirect', async () => {
    const app = await createApp({ AUTH_ADAPTER: 'test-idp' });
    try {
      const start = await request(app.getHttpServer()).get('/api/v1/auth/sso/start').expect(302);
      const callbackCookie = cookieNamed(start, 'procurement_sso_state') ?? '';

      const callback = await request(app.getHttpServer())
        .get(start.headers.location ?? '')
        .set('Cookie', callbackCookie)
        .expect(302);

      expect(callback.headers.location).toBe('/login');
      expect(cookieNamed(callback, 'procurement_sso')).toBeDefined();
      expect(setCookies(callback).some((cookie) => /^procurement_sso_state=;/.test(cookie))).toBe(
        true,
      );
      expect(callback.body).toEqual({});
    } finally {
      await app.close();
    }
  });

  it('fails closed when production Auth0 callback configuration is incomplete', async () => {
    const app = await createApp({
      NODE_ENV: 'production',
      AUTH_ADAPTER: 'auth0',
      AUTH0_DOMAIN: 'example.auth0.com',
      AUTH0_AUDIENCE: 'procurement-api',
    });
    try {
      await request(app.getHttpServer()).get('/api/v1/auth/sso/start').expect(401);
    } finally {
      await app.close();
    }
  });
});
