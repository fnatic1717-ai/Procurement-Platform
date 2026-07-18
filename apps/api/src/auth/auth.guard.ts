import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AUTH_PROVIDER, PUBLIC_ROUTE, type AuthProvider, PrincipalLoader } from './auth.js';
import { Inject } from '@nestjs/common';

interface SignedSessionCookie {
  userId: string;
  tenantId: string;
  signature: string;
}
function readCookie(header: string | undefined, name: string): string | undefined {
  return header
    ?.split(';')
    .map((v) => v.trim())
    .find((v) => v.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}
function verifySignedSession(
  value: string | undefined,
): { userId: string; tenantId: string } | null {
  if (!value) return null;
  const secret = process.env.PROCUREMENT_SESSION_SECRET;
  if (!secret) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(decodeURIComponent(value), 'base64url').toString('utf8'),
    ) as SignedSessionCookie;
    if (!/^[0-9a-fA-F-]{36}$/.test(parsed.userId) || !/^[0-9a-fA-F-]{36}$/.test(parsed.tenantId))
      return null;
    const payload = `${parsed.userId}:${parsed.tenantId}`;
    const expected = createHmac('sha256', secret).update(payload).digest('hex');
    const actualBuffer = Buffer.from(parsed.signature);
    const expectedBuffer = Buffer.from(expected);
    if (
      actualBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(actualBuffer, expectedBuffer)
    )
      return null;
    return { userId: parsed.userId, tenantId: parsed.tenantId };
  } catch {
    return null;
  }
}

@Injectable()
export class AuthenticationGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(AUTH_PROVIDER) private readonly provider: AuthProvider,
    private readonly principalLoader: PrincipalLoader,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    const request = context.switchToHttp().getRequest<Request>();
    const signed = verifySignedSession(readCookie(request.header('cookie'), 'procurement_session'));
    const authenticated = signed
      ? { userId: signed.userId, subject: `session|${signed.userId}` }
      : await this.provider.authenticate(request.header('authorization'));
    const tenantId = signed?.tenantId ?? request.header('x-tenant-id');
    if (!authenticated) throw new UnauthorizedException('Authentication is required');
    if (!tenantId) throw new UnauthorizedException('Tenant context is required');
    request.principal = await this.principalLoader.load(
      authenticated,
      tenantId,
      request.correlationId ?? 'missing-correlation',
    );
    return true;
  }
}
