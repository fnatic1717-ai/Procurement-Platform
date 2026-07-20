import { Inject, Injectable, Provider, UnauthorizedException } from '@nestjs/common';
import { loadConfig, type AppConfig } from '@procurement/config';
import type { AuthenticatedPrincipal } from '@procurement/shared';
import { createHash, createHmac, createPublicKey, verify } from 'node:crypto';
import { prisma } from '@procurement/database';
import { PolicyService } from '../authorization/policy.js';

export const AUTH_PROVIDER = Symbol('AUTH_PROVIDER');
export const PUBLIC_ROUTE = Symbol('PUBLIC_ROUTE');
export const REQUIRED_PERMISSIONS = Symbol('REQUIRED_PERMISSIONS');

export interface AuthProvider {
  authenticate(authorizationHeader?: string): Promise<{ userId: string; subject: string } | null>;
  authorizationUrl?(context: { state: string; nonce: string; codeChallenge: string }): string;
  callback?(context: {
    query: Record<string, unknown>;
    expectedNonce: string;
    pkceVerifier: string;
  }): Promise<{ userId: string; subject: string }>;
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
  authorizationUrl(context: { state: string; nonce: string; codeChallenge: string }) {
    const subject = process.env.TEST_IDP_SUBJECT;
    if (!subject)
      throw new UnauthorizedException('Test identity provider subject is not configured');
    const code = createHmac('sha256', this.secret())
      .update(`${context.state}:${context.nonce}:${context.codeChallenge}:${subject}`)
      .digest('hex');
    const url = new URL('/api/v1/auth/sso/callback', 'http://localhost');
    url.searchParams.set('state', context.state);
    url.searchParams.set('code', code);
    return `${url.pathname}${url.search}`;
  }
  async callback(context: {
    query: Record<string, unknown>;
    expectedNonce: string;
    pkceVerifier: string;
  }) {
    const state = String(context.query.state ?? '');
    const code = String(context.query.code ?? '');
    const subject = process.env.TEST_IDP_SUBJECT ?? '';
    const codeChallenge = pkceChallenge(context.pkceVerifier);
    const expected = createHmac('sha256', this.secret())
      .update(`${state}:${context.expectedNonce}:${codeChallenge}:${subject}`)
      .digest('hex');
    if (!subject || code !== expected) throw new UnauthorizedException('Invalid identity callback');
    return resolvePersistedUser(subject);
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
  authorizationUrl(context: { state: string; nonce: string; codeChallenge: string }) {
    const auth0 = this.auth0Config();
    const url = new URL(`https://${auth0.domain}/authorize`);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', auth0.clientId);
    url.searchParams.set('audience', auth0.audience);
    url.searchParams.set('redirect_uri', auth0.callbackUrl);
    url.searchParams.set('scope', 'openid profile email');
    url.searchParams.set('state', context.state);
    url.searchParams.set('nonce', context.nonce);
    url.searchParams.set('code_challenge', context.codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');
    return url.toString();
  }
  async callback(context: {
    query: Record<string, unknown>;
    expectedNonce: string;
    pkceVerifier: string;
  }): Promise<{ userId: string; subject: string }> {
    const auth0 = this.auth0Config();
    const code = String(context.query.code ?? '');
    if (!code) throw new UnauthorizedException('Invalid identity callback');
    const response = await fetch(`https://${auth0.domain}/oauth/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: auth0.clientId,
        client_secret: auth0.clientSecret,
        code,
        redirect_uri: auth0.callbackUrl,
        code_verifier: context.pkceVerifier,
      }),
    });
    if (!response.ok) throw new UnauthorizedException('Identity token exchange failed');
    const body = (await response.json()) as { id_token?: unknown };
    const idToken = typeof body.id_token === 'string' ? body.id_token : '';
    const claims = await verifyJwt(idToken, auth0);
    if (claims.nonce !== context.expectedNonce || typeof claims.sub !== 'string' || !claims.sub)
      throw new UnauthorizedException('Invalid identity token');
    return resolvePersistedUser(claims.sub);
  }
  private auth0Config() {
    const domain = this.config.AUTH0_DOMAIN;
    const audience = this.config.AUTH0_AUDIENCE;
    const clientId = process.env.AUTH0_CLIENT_ID;
    const clientSecret = process.env.AUTH0_CLIENT_SECRET;
    const callbackUrl = process.env.AUTH_CALLBACK_URL;
    if (!domain || !audience || !clientId || !clientSecret || !callbackUrl)
      throw new UnauthorizedException('Production SSO is not configured');
    return { domain, audience, clientId, clientSecret, callbackUrl };
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

export function pkceChallenge(verifier: string) {
  return createHash('sha256').update(verifier).digest().toString('base64url');
}

async function resolvePersistedUser(subject: string) {
  const user = await prisma.user.findUnique({ where: { subject } });
  if (!user)
    throw new UnauthorizedException('Identity subject is not mapped to an application user');
  return { userId: user.id, subject };
}

async function verifyJwt(
  token: string,
  auth0: { domain: string; audience: string; clientId: string },
): Promise<Record<string, unknown>> {
  const [encodedHeader, encodedPayload, encodedSignature] = token.split('.');
  if (!encodedHeader || !encodedPayload || !encodedSignature)
    throw new UnauthorizedException('Invalid identity token');
  let header: { alg?: string; kid?: string };
  try {
    header = JSON.parse(Buffer.from(encodedHeader, 'base64url').toString('utf8')) as {
      alg?: string;
      kid?: string;
    };
  } catch {
    throw new UnauthorizedException('Invalid identity token');
  }
  if (header.alg !== 'RS256' || !header.kid)
    throw new UnauthorizedException('Invalid identity token');
  const jwksResponse = await fetch(`https://${auth0.domain}/.well-known/jwks.json`);
  if (!jwksResponse.ok) throw new UnauthorizedException('Identity signing keys unavailable');
  const jwks = (await jwksResponse.json()) as { keys?: Array<Record<string, unknown>> };
  const jwk = jwks.keys?.find((key) => key.kid === header.kid);
  if (!jwk) throw new UnauthorizedException('Identity signing key not found');
  const valid = verify(
    'RSA-SHA256',
    Buffer.from(`${encodedHeader}.${encodedPayload}`),
    createPublicKey({ key: jwk, format: 'jwk' }),
    Buffer.from(encodedSignature, 'base64url'),
  );
  if (!valid) throw new UnauthorizedException('Invalid identity token signature');
  let claims: Record<string, unknown>;
  try {
    claims = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as Record<
      string,
      unknown
    >;
  } catch {
    throw new UnauthorizedException('Invalid identity token');
  }
  const issuer = `https://${auth0.domain}/`;
  const audience = claims.aud;
  const audienceMatches = Array.isArray(audience)
    ? audience.includes(auth0.audience)
    : audience === auth0.audience;
  const now = Math.floor(Date.now() / 1000);
  if (
    claims.iss !== issuer ||
    !audienceMatches ||
    claims.azp !== auth0.clientId ||
    typeof claims.exp !== 'number' ||
    claims.exp <= now
  )
    throw new UnauthorizedException('Invalid identity token claims');
  return claims;
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
