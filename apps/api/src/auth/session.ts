import { Controller, Get, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';

function roleFromPermissions(permissions: string[]) {
  if (permissions.includes('rfqs.publish')) return 'Sourcing manager';
  if (permissions.includes('rfqs.create')) return 'Buyer';
  if (permissions.includes('suppliers.read')) return 'Supplier manager';
  return 'Internal user';
}

@Controller('auth')
export class SessionController {
  @Get('session')
  session(@Req() request: Request) {
    if (!request.principal?.activeMembership)
      throw new UnauthorizedException('Active session required');
    return {
      userId: request.principal.userId,
      tenantId: request.principal.tenantId,
      actorType: request.principal.actorType,
      role: roleFromPermissions(request.principal.permissions),
      permissions: request.principal.permissions,
      activeMembership: request.principal.activeMembership,
    };
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) response: Response) {
    response.clearCookie('procurement_session', { httpOnly: true, sameSite: 'lax', path: '/' });
    return { loggedOut: true };
  }
}
