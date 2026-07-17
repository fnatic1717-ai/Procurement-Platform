import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AUTH_PROVIDER, PUBLIC_ROUTE, type AuthProvider, PrincipalLoader } from './auth.js';
import { Inject } from '@nestjs/common';

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
    const tenantId = request.header('x-tenant-id');
    if (!tenantId) throw new UnauthorizedException('Tenant context is required');
    const authenticated = await this.provider.authenticate(request.header('authorization'));
    if (!authenticated) throw new UnauthorizedException('Authentication is required');
    request.principal = await this.principalLoader.load(
      authenticated,
      tenantId,
      request.correlationId ?? 'missing-correlation',
    );
    return true;
  }
}
