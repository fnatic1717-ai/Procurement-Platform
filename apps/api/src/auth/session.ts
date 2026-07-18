import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { prisma } from '@procurement/database';
import type { Request, Response } from 'express';
import { IsOptional, IsUUID } from 'class-validator';
import { Public } from '../decorators/public.js';
import { AUTH_PROVIDER, type AuthProvider, PrincipalLoader } from './auth.js';
import { Inject } from '@nestjs/common';

const cookieName = 'procurement_session';
const maxAgeSeconds = 8 * 60 * 60;

class LoginDto {
  @IsUUID() tenantId!: string;
  @IsOptional() @IsUUID() userId?: string;
}

interface SignedSessionPayload {
  userId: string;
  tenantId: string;
  membershipId: string;
  iat: number;
  exp: number;
}

interface SignedSessionCookie extends SignedSessionPayload {
  signature: string;
}

function secret() {
  const value = process.env.PROCUREMENT_SESSION_SECRET;
  if (!value || value.length < 32)
    throw new UnauthorizedException('Session signing is not configured');
  return value;
}

function signPayload(payload: SignedSessionPayload) {
  return createHmac('sha256', secret()).update(canonical(payload)).digest('hex');
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((entry) => canonical(entry)).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, nested]) => `${JSON.stringify(key)}:${canonical(nested)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export function issueSessionCookie(payload: SignedSessionPayload) {
  const signed: SignedSessionCookie = { ...payload, signature: signPayload(payload) };
  return Buffer.from(JSON.stringify(signed), 'utf8').toString('base64url');
}

export function verifySessionCookie(
  value: string | undefined,
  now = Math.floor(Date.now() / 1000),
) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(decodeURIComponent(value), 'base64url').toString('utf8'),
    ) as SignedSessionCookie;
    const { signature, ...payload } = parsed;
    if (
      !/^[0-9a-fA-F-]{36}$/.test(payload.userId) ||
      !/^[0-9a-fA-F-]{36}$/.test(payload.tenantId) ||
      !/^[0-9a-fA-F-]{36}$/.test(payload.membershipId)
    )
      return null;
    if (!Number.isInteger(payload.iat) || !Number.isInteger(payload.exp) || payload.exp <= now)
      return null;
    const expected = signPayload(payload);
    const actualBuffer = Buffer.from(signature ?? '');
    const expectedBuffer = Buffer.from(expected);
    if (
      actualBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(actualBuffer, expectedBuffer)
    )
      return null;
    return payload;
  } catch {
    return null;
  }
}

export async function sessionRole(tenantId: string, userId: string) {
  const rows = await prisma.$queryRaw<{ name: string }[]>`
    SELECT r.name FROM user_role_assignments a JOIN roles r ON r.id=a.role_id AND r.tenant_id=a.tenant_id
    WHERE a.tenant_id=${tenantId}::uuid AND a.user_id=${userId}::uuid ORDER BY r.name LIMIT 1`;
  return rows[0]?.name ?? 'Internal user';
}

@Controller('auth')
export class SessionController {
  constructor(
    @Inject(AUTH_PROVIDER) private readonly provider: AuthProvider,
    private readonly principalLoader: PrincipalLoader,
  ) {}

  @Public()
  @Post('login')
  async login(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Body() body: LoginDto,
  ) {
    const devLoginEnabled =
      process.env.ENABLE_DEVELOPMENT_LOGIN === 'true' && process.env.NODE_ENV !== 'production';
    const authorization = request.header('authorization');
    if (!authorization?.startsWith('Bearer ') && !devLoginEnabled)
      throw new UnauthorizedException('Authentication is required');
    const authenticated = authorization?.startsWith('Bearer ')
      ? await this.provider.authenticate(authorization)
      : body.userId
        ? { userId: body.userId, subject: `development-login|${body.userId}` }
        : null;
    if (!authenticated) throw new UnauthorizedException('Authentication failed');
    const membership = await prisma.tenantMembership.findFirst({
      where: { tenantId: body.tenantId, userId: authenticated.userId, status: 'active' },
    });
    if (!membership) throw new ForbiddenException('Active tenant membership is required');
    const now = Math.floor(Date.now() / 1000);
    const cookie = issueSessionCookie({
      userId: authenticated.userId,
      tenantId: body.tenantId,
      membershipId: membership.id,
      iat: now,
      exp: now + maxAgeSeconds,
    });
    response.cookie(cookieName, cookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: maxAgeSeconds * 1000,
      expires: new Date((now + maxAgeSeconds) * 1000),
    });
    const principal = await this.principalLoader.load(
      authenticated,
      body.tenantId,
      request.correlationId ?? 'missing-correlation',
    );
    if (!principal.activeMembership)
      throw new ForbiddenException('Active tenant membership is required');
    return {
      userId: principal.userId,
      tenantId: principal.tenantId,
      actorType: principal.actorType,
      role: await sessionRole(principal.tenantId, principal.userId),
      permissions: principal.permissions,
      activeMembership: principal.activeMembership,
      expiresAt: new Date((now + maxAgeSeconds) * 1000).toISOString(),
    };
  }

  @Get('session')
  async session(@Req() request: Request) {
    if (!request.principal?.activeMembership)
      throw new UnauthorizedException('Active session required');
    return {
      userId: request.principal.userId,
      tenantId: request.principal.tenantId,
      actorType: request.principal.actorType,
      role: await sessionRole(request.principal.tenantId, request.principal.userId),
      permissions: request.principal.permissions,
      activeMembership: request.principal.activeMembership,
    };
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) response: Response) {
    response.clearCookie(cookieName, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });
    return { loggedOut: true };
  }
}
