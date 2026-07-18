import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { prisma } from '@procurement/database';
import type { Request } from 'express';
import { AUTH_PROVIDER, PUBLIC_ROUTE, type AuthProvider, PrincipalLoader } from './auth.js';
import { Inject } from '@nestjs/common';
import { verifySessionCookie } from './session.js';

function readCookie(header: string | undefined, name: string): string | undefined {
  return header
    ?.split(';')
    .map((v) => v.trim())
    .find((v) => v.startsWith(`${name}=`))
    ?.slice(name.length + 1);
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
    const signed = verifySessionCookie(readCookie(request.header('cookie'), 'procurement_session'));
    const authenticated = signed
      ? { userId: signed.userId, subject: `session|${signed.userId}` }
      : await this.provider.authenticate(request.header('authorization'));
    const tenantId = signed?.tenantId ?? request.header('x-tenant-id');
    if (!authenticated) throw new UnauthorizedException('Authentication is required');
    if (!tenantId) throw new UnauthorizedException('Tenant context is required');
    if (signed) {
      const active = await prisma.tenantMembership.findFirst({
        where: { id: signed.membershipId, tenantId, userId: signed.userId, status: 'active' },
      });
      if (!active) throw new UnauthorizedException('Active tenant session is no longer valid');
    }
    request.principal = await this.principalLoader.load(
      authenticated,
      tenantId,
      request.correlationId ?? 'missing-correlation',
    );
    return true;
  }
}
