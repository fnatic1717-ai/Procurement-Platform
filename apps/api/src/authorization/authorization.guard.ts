import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRED_PERMISSIONS } from '../auth/auth.js';
import { PolicyService } from './policy.js';

@Injectable()
export class AuthorizationGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly policies: PolicyService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(REQUIRED_PERMISSIONS, [context.getHandler(), context.getClass()]) ?? [];
    if (required.length === 0) return true;
    const request = context.switchToHttp().getRequest();
    const principal = request.principal;
    if (!principal) throw new ForbiddenException('Access denied');
    for (const permission of required) {
      if (!this.policies.can(principal, { tenantId: principal.tenantId, permission })) throw new ForbiddenException('Access denied');
    }
    return true;
  }
}
