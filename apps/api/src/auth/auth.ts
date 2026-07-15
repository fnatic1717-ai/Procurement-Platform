import { Injectable } from '@nestjs/common';
import type { AuthenticatedPrincipal } from '@procurement/shared';
export interface AuthProvider { authenticate(token?: string): Promise<AuthenticatedPrincipal | null>; }
@Injectable()
export class DevelopmentAuthProvider implements AuthProvider { async authenticate(token?: string) { if (!token?.startsWith('dev ')) return null; const [, userId, tenantId, permissions=''] = token.split(' '); if (!userId || !tenantId) return null; return { userId, tenantId, actorType: 'internal_user', permissions: permissions.split(',').filter(Boolean), correlationId: 'dev' }; } }
