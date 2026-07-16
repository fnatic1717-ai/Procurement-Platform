import { Injectable, Optional } from '@nestjs/common';
import { hasPermission, type AuthenticatedPrincipal } from '@procurement/shared';
import { AuditService } from '../audit/audit.js';

export interface AuthorizationRequest {
  permission: string;
  tenantId: string;
  objectOwnerId?: string;
  objectScope?: string;
}

export interface TenantMembershipFixture {
  userId: string;
  tenantId: string;
  status: 'active' | 'inactive';
  permissions: string[];
}

export interface SegregationOverrideRequest {
  tenantId: string;
  policyEnabled: boolean;
  justification: string;
  independentApprover: AuthenticatedPrincipal | null;
  requiredPermission: string;
  action: string;
  objectType: string;
  objectId: string;
  correlationId: string;
}

@Injectable()
export class PolicyService {
  private readonly memberships = new Map<string, TenantMembershipFixture>();

  constructor(@Optional() private readonly audit?: AuditService) {}

  registerMembership(fixture: TenantMembershipFixture): void {
    this.memberships.set(`${fixture.tenantId}:${fixture.userId}`, fixture);
  }

  async loadPrincipal(
    userId: string,
    tenantId: string,
    correlationId: string,
  ): Promise<AuthenticatedPrincipal> {
    const membership = this.memberships.get(`${tenantId}:${userId}`);
    if (!membership || membership.status !== 'active') {
      return {
        userId,
        tenantId,
        actorType: 'internal_user',
        permissions: [],
        correlationId,
        activeMembership: false,
      };
    }
    return {
      userId,
      tenantId,
      actorType: 'internal_user',
      permissions: membership.permissions,
      correlationId,
      activeMembership: true,
    };
  }

  can(principal: AuthenticatedPrincipal | null, req: AuthorizationRequest): boolean {
    if (!principal?.activeMembership) return false;
    if (principal.tenantId !== req.tenantId) return false;
    return hasPermission(principal, req.permission);
  }

  async enforceRequesterCannotApproveOwn(
    principal: AuthenticatedPrincipal,
    requesterId: string,
    override?: SegregationOverrideRequest,
  ): Promise<boolean> {
    if (principal.userId !== requesterId) return true;
    return this.authorizeOverride(principal, override);
  }

  async enforceBuyerCannotSolelyApproveOwnAward(
    principal: AuthenticatedPrincipal,
    buyerId: string,
    override?: SegregationOverrideRequest,
  ): Promise<boolean> {
    if (principal.userId !== buyerId) return true;
    return this.authorizeOverride(principal, override);
  }

  private async authorizeOverride(
    conflictedPrincipal: AuthenticatedPrincipal,
    override?: SegregationOverrideRequest,
  ): Promise<boolean> {
    if (!override?.policyEnabled) return false;
    if (!override.justification.trim()) return false;
    const approver = override.independentApprover;
    if (!approver || approver.userId === conflictedPrincipal.userId) return false;
    if (
      !this.can(approver, { tenantId: override.tenantId, permission: override.requiredPermission })
    )
      return false;
    await this.audit?.append({
      tenantId: override.tenantId,
      actorId: approver.userId,
      actorType: approver.actorType,
      action: override.action,
      objectType: override.objectType,
      objectId: override.objectId,
      correlationId: override.correlationId,
      metadata: {
        justification: override.justification,
        conflictedActorId: conflictedPrincipal.userId,
      },
    });
    return true;
  }
}
