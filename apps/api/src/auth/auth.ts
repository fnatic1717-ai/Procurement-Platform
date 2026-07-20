import { Inject, Injectable, Provider, UnauthorizedException } from '@nestjs/common';
import { loadConfig, type AppConfig } from '@procurement/config';
import type { AuthenticatedPrincipal } from '@procurement/shared';
import { createHmac } from 'node:crypto';
import { PolicyService } from '../authorization/policy.js';

export const AUTH_PROVIDER = Symbol('AUTH_PROVIDER');
export const PUBLIC_ROUTE = Symbol('PUBLIC_ROUTE');
export const REQUIRED_PERMISSIONS = Symbol('REQUIRED_PERMISSIONS');

export interface AuthProvider {
  authenticate(authorizationHeader?: string): Promise<{ userId: string; subject: string } | null>;
  authorizationUrl?(state: string): string;
  callback?(query: Record<string, unknown>): Promise<{ userId: string; subject: string }>;
}

@Injectable()
export class DevelopmentAuthProvider implements AuthProvider {
  async authenticate(
    authorizationHeader?: string,
  ): Promise<{ userId: string; subject: string } | null> {
    if (!authorizationHeader?.startsWith('Bearer dev:')) return null;
    const userId = authorizationHeader.slice('Bearer dev:'.length).trim();
    if (!/^[0-9a-fA-F-]{36}$/.test(userId)) return null;
    return { userId, subject: `development|${userId}` };
  }
}

@Injectable()
export class TestIdentityProvider implements AuthProvider {
  constructor(private readonly config: AppConfig) {}
  async authenticate(): Promise<{ userId: string; subject: string } | null> {
    return null;
  }
  authorizationUrl(state: string) {
    const userId = process.env.TEST_IDP_USER_ID;
    if (!userId) throw new UnauthorizedException('Test identity provider user is not configured');
    const code = createHmac('sha256', this.secret()).update(`${state}:${userId}`).digest('hex');
    return `/api/v1/auth/sso/callback?state=${encodeURIComponent(state)}&code=${code}&userId=${userId}`;
  }
  async callback(query: Record<string, unknown>) {
    const state = String(query.state ?? '');
    const userId = String(query.userId ?? '');
    const code = String(query.code ?? '');
    if (!/^[0-9a-fA-F-]{36}$/.test(userId))
      throw new UnauthorizedException('Invalid identity callback');
    const expected = createHmac('sha256', this.secret()).update(`${state}:${userId}`).digest('hex');
    if (code !== expected) throw new UnauthorizedException('Invalid identity callback');
    return { userId, subject: `test-idp|${userId}` };
  }
  private secret(): string {
    const value =
      process.env.TEST_IDP_SECRET ||
      process.env.PROCUREMENT_SESSION_SECRET ||
      this.config.AUTH0_AUDIENCE;
    if (!value) throw new UnauthorizedException('Test identity provider secret is not configured');
    return value;
  }
}

@Injectable()
export class Auth0AuthProvider implements AuthProvider {
  constructor(private readonly config: AppConfig) {}
  authorizationUrl(state: string) {
    if (!this.config.AUTH0_DOMAIN || !this.config.AUTH0_AUDIENCE)
      throw new UnauthorizedException('Production SSO is not configured');
    const url = new URL(`https://${this.config.AUTH0_DOMAIN}/authorize`);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', process.env.AUTH0_CLIENT_ID ?? '');
    url.searchParams.set('audience', this.config.AUTH0_AUDIENCE);
    url.searchParams.set(
      'redirect_uri',
      process.env.AUTH_CALLBACK_URL ?? '/api/v1/auth/sso/callback',
    );
    url.searchParams.set('state', state);
    if (!process.env.AUTH0_CLIENT_ID)
      throw new UnauthorizedException('Production SSO client is not configured');
    return url.toString();
  }
  async callback(): Promise<{ userId: string; subject: string }> {
    throw new UnauthorizedException('Auth0 callback exchange is not configured');
  }
  async authenticate(
    authorizationHeader?: string,
  ): Promise<{ userId: string; subject: string } | null> {
    if (!authorizationHeader?.startsWith('Bearer ')) return null;
    throw new UnauthorizedException(
      'Auth0 token validation is configured but not yet connected to a JWKS verifier',
    );
  }
}

export function createAuthProvider(config: AppConfig): AuthProvider {
  if (config.AUTH_ADAPTER === 'development') return new DevelopmentAuthProvider();
  if (config.AUTH_ADAPTER === 'test-idp') return new TestIdentityProvider(config);
  return new Auth0AuthProvider(config);
}

export const authProviderFactory: Provider = {
  provide: AUTH_PROVIDER,
  useFactory: () => createAuthProvider(loadConfig()),
};

@Injectable()
export class PrincipalLoader {
  constructor(private readonly policies: PolicyService) {}
  async load(
    authenticated: { userId: string; subject: string },
    tenantId: string,
    correlationId: string,
  ): Promise<AuthenticatedPrincipal> {
    return this.policies.loadPrincipal(authenticated.userId, tenantId, correlationId);
  }
}

export function InjectAuthProvider() {
  return Inject(AUTH_PROVIDER);
}
