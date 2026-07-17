import { Inject, Injectable, Provider, UnauthorizedException } from '@nestjs/common';
import { loadConfig, type AppConfig } from '@procurement/config';
import type { AuthenticatedPrincipal } from '@procurement/shared';
import { PolicyService } from '../authorization/policy.js';

export const AUTH_PROVIDER = Symbol('AUTH_PROVIDER');
export const PUBLIC_ROUTE = Symbol('PUBLIC_ROUTE');
export const REQUIRED_PERMISSIONS = Symbol('REQUIRED_PERMISSIONS');

export interface AuthProvider {
  authenticate(authorizationHeader?: string): Promise<{ userId: string; subject: string } | null>;
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
export class Auth0AuthProvider implements AuthProvider {
  constructor(private readonly config: AppConfig) {}
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
