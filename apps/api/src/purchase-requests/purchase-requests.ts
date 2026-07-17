import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Injectable,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  IsArray,
  IsDateString,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { createHash } from 'node:crypto';
import { Prisma, type PurchaseRequestStatus } from '@prisma/client';
import { prisma, type TransactionClient } from '@procurement/database';
import {
  assertPurchaseRequestTransition,
  isPurchaseRequestEditable,
  type AuthenticatedPrincipal,
} from '@procurement/shared';
import type { Request } from 'express';
import { RequirePermissions } from '../decorators/permissions.js';
import { AuditService } from '../audit/audit.js';

const money = /^\d{1,16}(\.\d{1,4})?$/;
class ItemDto {
  @IsString() @IsNotEmpty() @MaxLength(500) description!: string;
  @IsIn(['goods', 'services']) itemType!: 'goods' | 'services';
  @Matches(/^\d{1,14}(\.\d{1,6})?$/) quantity!: string;
  @IsString() @IsNotEmpty() @MaxLength(50) unitOfMeasure!: string;
  @Matches(money) estimatedUnitPrice!: string;
  @IsString() @IsNotEmpty() @MaxLength(200) category!: string;
  @IsString() @IsNotEmpty() @MaxLength(10000) specifications!: string;
  @IsDateString() requiredBy!: string;
  @IsString() @IsNotEmpty() @MaxLength(300) deliveryLocation!: string;
  @IsOptional() @IsString() @MaxLength(300) suggestedSupplierName?: string;
  @IsOptional() accountingDimensions?: Record<string, string>;
}
class DraftDto {
  @IsString() @IsNotEmpty() @MaxLength(200) legalEntity!: string;
  @IsString() @IsNotEmpty() @MaxLength(200) department!: string;
  @IsString() @IsNotEmpty() @MaxLength(100) costCenter!: string;
  @IsString() @IsNotEmpty() @MaxLength(300) deliveryLocation!: string;
  @IsString() @IsNotEmpty() @MaxLength(200) procurementCategory!: string;
  @IsString() @IsNotEmpty() @MaxLength(300) title!: string;
  @IsString() @IsNotEmpty() @MaxLength(10000) businessJustification!: string;
  @Matches(/^[A-Z]{3}$/) currency!: string;
  @IsDateString() requiredBy!: string;
  @IsIn(['low', 'normal', 'high', 'urgent']) priority!: 'low' | 'normal' | 'high' | 'urgent';
  @IsOptional() @IsString() @MaxLength(10000) internalNotes?: string;
}
class VersionDto {
  @IsInt() @Min(1) version!: number;
}
class SubmitDto extends VersionDto {
  @IsString() @IsNotEmpty() @MaxLength(128) idempotencyKey!: string;
}
class DecisionDto extends VersionDto {
  @IsString() @IsNotEmpty() @MaxLength(128) idempotencyKey!: string;
  @IsOptional() @IsString() @MaxLength(4000) comment?: string;
}
class AssignmentDto extends VersionDto {
  @IsUUID() buyerId!: string;
  @IsString() @IsNotEmpty() @MaxLength(2000) reason!: string;
  @IsString() @IsNotEmpty() @MaxLength(128) idempotencyKey!: string;
}
class UpdateDraftDto extends DraftDto {
  @IsInt() @Min(1) version!: number;
}
class UpdateItemDto extends ItemDto {
  @IsInt() @Min(1) version!: number;
}
class CreateItemDto extends ItemDto {
  @IsInt() @Min(1) requestVersion!: number;
}
class VersionReasonDto extends VersionDto {
  @IsString() @IsNotEmpty() @MaxLength(2000) reason!: string;
}
class RequestListQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 25;
  @IsOptional()
  @IsIn([
    'DRAFT',
    'PENDING_APPROVAL',
    'RETURNED_TO_REQUESTER',
    'REJECTED',
    'APPROVED',
    'WITHDRAWN',
    'CANCELLED',
    'IN_PROCUREMENT_REVIEW',
  ])
  status?: PurchaseRequestStatus;
  @IsOptional() @IsString() @MaxLength(200) search?: string;
  @IsOptional()
  @IsIn(['createdAt', 'requiredBy', 'estimatedTotal', 'requestNumber', 'priority'])
  sort = 'createdAt';
  @IsOptional() @IsIn(['asc', 'desc']) direction: 'asc' | 'desc' = 'desc';
}
class IntakeQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 25;
  @IsOptional() @IsIn(['unassigned', 'assigned', 'in_review', 'closed']) status?:
    'unassigned' | 'assigned' | 'in_review' | 'closed';
  @IsOptional() @IsString() @MaxLength(200) search?: string;
  @IsOptional() @IsIn(['receivedAt', 'requiredBy', 'estimatedTotal', 'priority']) sort =
    'receivedAt';
  @IsOptional() @IsIn(['asc', 'desc']) direction: 'asc' | 'desc' = 'asc';
  @IsOptional() @IsIn(['low', 'normal', 'high', 'urgent']) priority?:
    'low' | 'normal' | 'high' | 'urgent';
  @IsOptional() @IsDateString() requiredFrom?: string;
  @IsOptional() @IsDateString() requiredTo?: string;
  @IsOptional() @IsString() @MaxLength(200) department?: string;
  @IsOptional() @IsString() @MaxLength(200) category?: string;
  @IsOptional() @IsUUID() requesterId?: string;
  @IsOptional() @IsUUID() buyerId?: string;
}
class PolicyStepDto {
  @IsInt() @Min(1) stepNumber!: number;
  @IsOptional() @IsUUID() approverUserId?: string;
  @IsOptional() @IsUUID() approverRoleId?: string;
  @IsString() @IsNotEmpty() requiredPermission!: string;
  @IsOptional() @Matches(money) minThreshold?: string;
  @IsOptional() @Matches(money) maxThreshold?: string;
  @IsOptional() @IsInt() @Min(1) escalationAfterHours?: number;
}
class PolicyDto {
  @IsString() @IsNotEmpty() @MaxLength(200) name!: string;
  @IsInt() priority!: number;
  @IsOptional() @Matches(money) minAmount?: string;
  @IsOptional() @Matches(money) maxAmount?: string;
  @IsOptional() @IsString() department?: string;
  @IsOptional() @IsString() legalEntity?: string;
  @IsOptional() @IsString() procurementCategory?: string;
  @IsOptional() @Matches(/^[A-Z]{3}$/) currency?: string;
  @IsOptional() @IsIn(['low', 'normal', 'high', 'urgent']) requestPriority?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => PolicyStepDto) steps!: PolicyStepDto[];
}
class UpdatePolicyDto extends PolicyDto {
  @IsInt() @Min(1) version!: number;
}
class PolicyStatusDto extends VersionDto {
  @IsBoolean() active!: boolean;
}

function principal(req: Request): AuthenticatedPrincipal {
  if (!req.principal) throw new BadRequestException('Principal missing');
  return req.principal;
}
@Injectable()
export class PurchaseRequestService {
  constructor(private readonly audit: AuditService) {}
  private async transaction<T>(
    p: AuthenticatedPrincipal,
    work: (tx: TransactionClient) => Promise<T>,
  ): Promise<T> {
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id',${p.tenantId},true)`;
      return work(tx);
    });
  }
  private payloadHash(value: unknown): string {
    return createHash('sha256').update(JSON.stringify(value)).digest('hex');
  }
  private async beginIdempotent(
    tx: TransactionClient,
    p: AuthenticatedPrincipal,
    operation: 'submit' | 'approve' | 'reject' | 'return_request' | 'assign_buyer',
    objectId: string,
    key: string,
    payload: unknown,
  ): Promise<{ id: string; response: unknown } | null> {
    const hash = this.payloadHash(payload);
    const existing = await tx.idempotencyRecord.findUnique({
      where: {
        tenantId_actorId_operation_objectId_key: {
          tenantId: p.tenantId,
          actorId: p.userId,
          operation,
          objectId,
          key,
        },
      },
    });
    if (existing) {
      if (existing.payloadHash !== hash)
        throw new ConflictException('Idempotency key was already used with a different payload');
      if (!existing.completedAt)
        throw new ConflictException('The original operation is in progress');
      return { id: existing.id, response: existing.response };
    }
    const created = await tx.idempotencyRecord.create({
      data: {
        tenantId: p.tenantId,
        actorId: p.userId,
        operation,
        objectId,
        key,
        payloadHash: hash,
      },
    });
    return { id: created.id, response: undefined };
  }
  private async completeIdempotent(tx: TransactionClient, id: string, response: object) {
    await tx.idempotencyRecord.update({
      where: { id },
      data: { response, completedAt: new Date() },
    });
  }
  private async eligibleForStep(
    tx: TransactionClient,
    p: AuthenticatedPrincipal,
    step: {
      approverUserId: string | null;
      approverRoleId: string | null;
      requiredPermission: string;
    },
  ): Promise<boolean> {
    const membership = await tx.tenantMembership.findUnique({
      where: { tenantId_userId: { tenantId: p.tenantId, userId: p.userId } },
    });
    if (!membership || membership.status !== 'active') return false;
    if (step.approverUserId && step.approverUserId !== p.userId) return false;
    const assignments = await tx.userRoleAssignment.findMany({
      where: {
        tenantId: p.tenantId,
        userId: p.userId,
        ...(step.approverRoleId ? { roleId: step.approverRoleId } : {}),
      },
      select: { roleId: true },
    });
    if (step.approverRoleId && assignments.length === 0) return false;
    const permission = await tx.permission.findUnique({ where: { code: step.requiredPermission } });
    if (!permission) return false;
    return (
      (await tx.rolePermission.count({
        where: {
          tenantId: p.tenantId,
          permissionId: permission.id,
          roleId: { in: assignments.map((assignment) => assignment.roleId) },
        },
      })) > 0
    );
  }
  async create(p: AuthenticatedPrincipal, d: DraftDto) {
    return this.transaction(p, async (tx) => {
      const number = await tx.$queryRaw<
        [{ next_tenant_request_number: string }]
      >`SELECT next_tenant_request_number(${p.tenantId}::uuid)`;
      const row = await tx.purchaseRequest.create({
        data: {
          tenantId: p.tenantId,
          requestNumber: number[0].next_tenant_request_number,
          requesterId: p.userId,
          ...d,
          requiredBy: new Date(d.requiredBy),
          estimatedTotal: new Prisma.Decimal(0),
        },
      });
      await this.audit.append(
        {
          tenantId: p.tenantId,
          actorId: p.userId,
          action: 'purchase_request.draft_created',
          objectType: 'purchase_request',
          objectId: row.id,
          correlationId: p.correlationId,
          resultingState: { status: row.status, version: row.version },
        },
        tx,
      );
      return row;
    });
  }
  async list(p: AuthenticatedPrincipal, q: RequestListQueryDto) {
    const page = q.page,
      take = q.limit;
    const all = p.permissions.includes('purchase_requests.read_all');
    return this.transaction(p, async (tx) => {
      const where: Prisma.PurchaseRequestWhereInput = {
        tenantId: p.tenantId,
        ...(!all ? { requesterId: p.userId } : {}),
        ...(q.status ? { status: q.status } : {}),
        ...(q.search
          ? {
              OR: [
                { requestNumber: { contains: q.search, mode: 'insensitive' } },
                { title: { contains: q.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      };
      const [items, total] = await Promise.all([
        tx.purchaseRequest.findMany({
          where,
          include: { items: true },
          orderBy: { [q.sort]: q.direction },
          skip: (page - 1) * take,
          take,
        }),
        tx.purchaseRequest.count({ where }),
      ]);
      return { items, total, page, limit: take };
    });
  }
  async detail(p: AuthenticatedPrincipal, id: string) {
    return this.transaction(p, async (tx) => {
      const row = await tx.purchaseRequest.findUnique({
        where: { tenantId_id: { tenantId: p.tenantId, id } },
        include: { items: true },
      });
      if (
        !row ||
        (row.requesterId !== p.userId && !p.permissions.includes('purchase_requests.read_all'))
      )
        throw new NotFoundException('Purchase request not found');
      const [approvals, activity] = await Promise.all([
        tx.purchaseRequestApprovalInstance.findMany({
          where: { tenantId: p.tenantId, purchaseRequestId: id },
          include: { steps: { orderBy: { stepNumber: 'asc' } } },
          orderBy: { createdAt: 'desc' },
        }),
        tx.auditEvent.findMany({
          where: { tenantId: p.tenantId, objectType: 'purchase_request', objectId: id },
          orderBy: { createdAt: 'asc' },
        }),
      ]);
      return { ...row, approvals, activity };
    });
  }
  async update(p: AuthenticatedPrincipal, id: string, d: UpdateDraftDto) {
    return this.transaction(p, async (tx) => {
      const current = await tx.purchaseRequest.findUnique({
        where: { tenantId_id: { tenantId: p.tenantId, id } },
      });
      if (!current || current.requesterId !== p.userId)
        throw new NotFoundException('Purchase request not found');
      if (!isPurchaseRequestEditable(current.status))
        throw new ConflictException('Purchase request is locked');
      const { version, ...data } = d;
      const changed = await tx.purchaseRequest.updateMany({
        where: { id, tenantId: p.tenantId, version },
        data: { ...data, requiredBy: new Date(data.requiredBy), version: { increment: 1 } },
      });
      if (!changed.count)
        throw new ConflictException('Purchase request was changed by another user');
      const resulting = await tx.purchaseRequest.findUniqueOrThrow({
        where: { tenantId_id: { tenantId: p.tenantId, id } },
      });
      await this.audit.append(
        {
          tenantId: p.tenantId,
          actorId: p.userId,
          action: 'purchase_request.draft_changed',
          objectType: 'purchase_request',
          objectId: id,
          correlationId: p.correlationId,
          priorState: current,
          resultingState: resulting,
        },
        tx,
      );
      return resulting;
    });
  }
  async addItem(p: AuthenticatedPrincipal, id: string, d: CreateItemDto) {
    return this.transaction(p, async (tx) => {
      const r = await tx.purchaseRequest.findUnique({
        where: { tenantId_id: { tenantId: p.tenantId, id } },
      });
      if (!r || r.requesterId !== p.userId) throw new NotFoundException();
      if (!isPurchaseRequestEditable(r.status))
        throw new ConflictException('Purchase request is locked');
      if (r.version !== d.requestVersion)
        throw new ConflictException('Purchase request was changed');
      const { requestVersion: _, ...itemData } = d;
      const item = await tx.purchaseRequestItem.create({
        data: {
          tenantId: p.tenantId,
          purchaseRequestId: id,
          ...itemData,
          quantity: new Prisma.Decimal(d.quantity),
          estimatedUnitPrice: new Prisma.Decimal(d.estimatedUnitPrice),
          requiredBy: new Date(d.requiredBy),
          accountingDimensions: d.accountingDimensions ?? {},
        },
      });
      await this.retotal(tx, p, id, 'purchase_request.item_added', null, item);
      return item;
    });
  }
  async updateItem(p: AuthenticatedPrincipal, id: string, itemId: string, d: UpdateItemDto) {
    return this.transaction(p, async (tx) => {
      const request = await tx.purchaseRequest.findUnique({
        where: { tenantId_id: { tenantId: p.tenantId, id } },
      });
      const prior = await tx.purchaseRequestItem.findUnique({
        where: { tenantId_id: { tenantId: p.tenantId, id: itemId } },
      });
      if (
        !request ||
        request.requesterId !== p.userId ||
        !isPurchaseRequestEditable(request.status) ||
        !prior ||
        prior.purchaseRequestId !== id
      )
        throw new NotFoundException('Editable request item not found');
      const { version, ...data } = d;
      const changed = await tx.purchaseRequestItem.updateMany({
        where: { tenantId: p.tenantId, id: itemId, purchaseRequestId: id, version },
        data: {
          ...data,
          quantity: new Prisma.Decimal(data.quantity),
          estimatedUnitPrice: new Prisma.Decimal(data.estimatedUnitPrice),
          requiredBy: new Date(data.requiredBy),
          accountingDimensions: data.accountingDimensions ?? {},
          version: { increment: 1 },
        },
      });
      if (changed.count !== 1) throw new ConflictException('Request item was changed');
      const resulting = await tx.purchaseRequestItem.findUniqueOrThrow({
        where: { tenantId_id: { tenantId: p.tenantId, id: itemId } },
      });
      await this.retotal(tx, p, id, 'purchase_request.item_updated', prior, resulting);
      return resulting;
    });
  }
  async removeItem(p: AuthenticatedPrincipal, id: string, itemId: string, d: VersionDto) {
    return this.transaction(p, async (tx) => {
      const r = await tx.purchaseRequest.findUnique({
        where: { tenantId_id: { tenantId: p.tenantId, id } },
      });
      if (!r || r.requesterId !== p.userId || !isPurchaseRequestEditable(r.status))
        throw new ConflictException('Purchase request is not editable');
      const prior = await tx.purchaseRequestItem.findUnique({
        where: { tenantId_id: { tenantId: p.tenantId, id: itemId } },
      });
      if (!prior) throw new NotFoundException();
      const deleted = await tx.purchaseRequestItem.deleteMany({
        where: { id: itemId, tenantId: p.tenantId, purchaseRequestId: id, version: d.version },
      });
      if (deleted.count !== 1) throw new ConflictException('Request item was changed');
      await this.retotal(tx, p, id, 'purchase_request.item_removed', prior, null);
      return { deleted: true };
    });
  }
  private async retotal(
    tx: TransactionClient,
    p: AuthenticatedPrincipal,
    id: string,
    action: string,
    priorState: unknown,
    resultingState: unknown,
  ) {
    const total = await tx.purchaseRequestItem.aggregate({
      _sum: { estimatedLineTotal: true },
      where: { tenantId: p.tenantId, purchaseRequestId: id },
    });
    await tx.purchaseRequest.update({
      where: { tenantId_id: { tenantId: p.tenantId, id } },
      data: { estimatedTotal: total._sum.estimatedLineTotal ?? 0, version: { increment: 1 } },
    });
    await this.audit.append(
      {
        tenantId: p.tenantId,
        actorId: p.userId,
        action,
        objectType: 'purchase_request',
        objectId: id,
        correlationId: p.correlationId,
        priorState,
        resultingState,
      },
      tx,
    );
  }
  async submit(p: AuthenticatedPrincipal, id: string, d: SubmitDto) {
    return this.transaction(p, async (tx) => {
      const operation = await this.beginIdempotent(tx, p, 'submit', id, d.idempotencyKey, {
        version: d.version,
      });
      if (operation?.response) return operation.response;
      const r = await tx.purchaseRequest.findUnique({
        where: { tenantId_id: { tenantId: p.tenantId, id } },
        include: { items: true },
      });
      if (!r || r.requesterId !== p.userId) throw new NotFoundException();
      if (!isPurchaseRequestEditable(r.status))
        throw new ConflictException('Purchase request cannot be submitted');
      if (r.version !== d.version)
        throw new ConflictException('Purchase request was changed by another user');
      if (
        !r.title.trim() ||
        !r.businessJustification.trim() ||
        !r.items.length ||
        r.items.some((i) => i.quantity.lte(0) || i.estimatedLineTotal.lt(0))
      )
        throw new BadRequestException(
          'Mandatory request fields and at least one valid line are required',
        );
      const policies = await tx.approvalPolicy.findMany({
        where: {
          tenantId: p.tenantId,
          active: true,
          AND: [
            { OR: [{ minAmount: null }, { minAmount: { lte: r.estimatedTotal } }] },
            { OR: [{ maxAmount: null }, { maxAmount: { gte: r.estimatedTotal } }] },
            { OR: [{ department: null }, { department: r.department }] },
            { OR: [{ legalEntity: null }, { legalEntity: r.legalEntity }] },
            { OR: [{ procurementCategory: null }, { procurementCategory: r.procurementCategory }] },
            { OR: [{ currency: null }, { currency: r.currency }] },
            { OR: [{ requestPriority: null }, { requestPriority: r.priority }] },
          ],
        },
        include: {
          steps: {
            where: {
              active: true,
              AND: [
                { OR: [{ minThreshold: null }, { minThreshold: { lte: r.estimatedTotal } }] },
                { OR: [{ maxThreshold: null }, { maxThreshold: { gte: r.estimatedTotal } }] },
              ],
            },
            orderBy: { stepNumber: 'asc' },
          },
        },
        orderBy: { priority: 'asc' },
      });
      const policy = policies.find((x) => x.steps.length > 0);
      if (!policy) throw new BadRequestException('No valid active approval route exists');
      if (policies.filter((candidate) => candidate.priority === policy.priority).length > 1)
        throw new ConflictException('Approval policy resolution is ambiguous');
      if (policy.steps.some((s) => s.approverUserId === p.userId))
        throw new BadRequestException('Approval route violates segregation of duties');
      for (const step of policy.steps) {
        if (step.approverUserId) {
          const candidate = { ...p, userId: step.approverUserId };
          if (!(await this.eligibleForStep(tx, candidate, step)))
            throw new BadRequestException(
              `Approval step ${step.stepNumber} has no eligible approver`,
            );
        } else {
          const assignments = await tx.userRoleAssignment.findMany({
            where: {
              tenantId: p.tenantId,
              roleId: step.approverRoleId!,
              userId: { not: p.userId },
            },
            select: { userId: true },
          });
          const activeMembers = await tx.tenantMembership.count({
            where: {
              tenantId: p.tenantId,
              status: 'active',
              userId: { in: assignments.map((assignment) => assignment.userId) },
            },
          });
          if (!activeMembers)
            throw new BadRequestException(
              `Approval step ${step.stepNumber} has no independent active role member`,
            );
        }
      }
      assertPurchaseRequestTransition(r.status, 'SUBMITTED');
      const instance = await tx.purchaseRequestApprovalInstance.create({
        data: {
          tenantId: p.tenantId,
          purchaseRequestId: id,
          policyId: policy.id,
          policyVersion: policy.version,
          submissionKey: d.idempotencyKey,
          routeSnapshot: {
            policyId: policy.id,
            policyVersion: policy.version,
            steps: policy.steps.map((s) => ({
              stepNumber: s.stepNumber,
              approverUserId: s.approverUserId,
              approverRoleId: s.approverRoleId,
              requiredPermission: s.requiredPermission,
              escalationAfterHours: s.escalationAfterHours,
            })),
          },
        },
      });
      await tx.purchaseRequestApprovalStep.createMany({
        data: policy.steps.map((s) => ({
          tenantId: p.tenantId,
          instanceId: instance.id,
          stepNumber: s.stepNumber,
          approverUserId: s.approverUserId,
          approverRoleId: s.approverRoleId,
          requiredPermission: s.requiredPermission,
        })),
      });
      const transitioned = await tx.purchaseRequest.updateMany({
        where: { tenantId: p.tenantId, id, version: d.version, status: r.status },
        data: { status: 'PENDING_APPROVAL', submittedAt: new Date(), version: { increment: 1 } },
      });
      if (transitioned.count !== 1) throw new ConflictException('Purchase request was changed');
      await this.audit.append(
        {
          tenantId: p.tenantId,
          actorId: p.userId,
          action:
            r.status === 'RETURNED_TO_REQUESTER'
              ? 'purchase_request.resubmitted'
              : 'purchase_request.submitted',
          objectType: 'purchase_request',
          objectId: id,
          correlationId: p.correlationId,
          priorState: { status: r.status, version: r.version },
          resultingState: { status: 'PENDING_APPROVAL', version: r.version + 1 },
          metadata: { policyId: policy.id, policyVersion: policy.version },
        },
        tx,
      );
      const response = { id, status: 'PENDING_APPROVAL', version: r.version + 1 };
      await this.completeIdempotent(tx, operation!.id, response);
      return response;
    });
  }
  async withdraw(p: AuthenticatedPrincipal, id: string, d: VersionReasonDto) {
    return this.transaction(p, async (tx) => {
      const r = await tx.purchaseRequest.findUnique({
        where: { tenantId_id: { tenantId: p.tenantId, id } },
      });
      if (!r || r.requesterId !== p.userId) throw new NotFoundException();
      if (!['SUBMITTED', 'PENDING_APPROVAL', 'RETURNED_TO_REQUESTER'].includes(r.status))
        throw new ConflictException('Request is no longer eligible for withdrawal');
      if (r.version !== d.version) throw new ConflictException('Purchase request was changed');
      assertPurchaseRequestTransition(r.status, 'WITHDRAWN');
      const transitioned = await tx.purchaseRequest.updateMany({
        where: { tenantId: p.tenantId, id, version: d.version, status: r.status },
        data: {
          status: 'WITHDRAWN',
          withdrawnAt: new Date(),
          withdrawnBy: p.userId,
          withdrawalReason: d.reason,
          version: { increment: 1 },
        },
      });
      if (transitioned.count !== 1) throw new ConflictException('Purchase request was changed');
      await tx.purchaseRequestApprovalInstance.updateMany({
        where: { tenantId: p.tenantId, purchaseRequestId: id, status: 'active' },
        data: { status: 'withdrawn', completedAt: new Date() },
      });
      await tx.purchaseRequestApprovalStep.updateMany({
        where: { tenantId: p.tenantId, decision: 'pending', instance: { purchaseRequestId: id } },
        data: { decision: 'cancelled', decisionAt: new Date(), comment: 'Request withdrawn' },
      });
      await this.audit.append(
        {
          tenantId: p.tenantId,
          actorId: p.userId,
          action: 'purchase_request.withdrawn',
          objectType: 'purchase_request',
          objectId: id,
          correlationId: p.correlationId,
          priorState: { status: r.status },
          resultingState: { status: 'WITHDRAWN' },
        },
        tx,
      );
      return { id, status: 'WITHDRAWN' };
    });
  }
  async cancel(p: AuthenticatedPrincipal, id: string, d: VersionReasonDto) {
    return this.transaction(p, async (tx) => {
      const request = await tx.purchaseRequest.findUnique({
        where: { tenantId_id: { tenantId: p.tenantId, id } },
      });
      if (!request) throw new NotFoundException('Purchase request not found');
      if (['REJECTED', 'WITHDRAWN', 'CANCELLED', 'IN_PROCUREMENT_REVIEW'].includes(request.status))
        throw new ConflictException('Purchase request is not eligible for cancellation');
      assertPurchaseRequestTransition(request.status, 'CANCELLED');
      const changed = await tx.purchaseRequest.updateMany({
        where: { tenantId: p.tenantId, id, version: d.version, status: request.status },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancelledBy: p.userId,
          cancellationReason: d.reason,
          version: { increment: 1 },
        },
      });
      if (changed.count !== 1) throw new ConflictException('Purchase request was changed');
      await tx.purchaseRequestApprovalInstance.updateMany({
        where: { tenantId: p.tenantId, purchaseRequestId: id, status: 'active' },
        data: { status: 'cancelled', completedAt: new Date() },
      });
      await tx.purchaseRequestApprovalStep.updateMany({
        where: { tenantId: p.tenantId, decision: 'pending', instance: { purchaseRequestId: id } },
        data: { decision: 'cancelled', decisionAt: new Date(), comment: 'Request cancelled' },
      });
      await this.audit.append(
        {
          tenantId: p.tenantId,
          actorId: p.userId,
          action: 'purchase_request.cancelled',
          objectType: 'purchase_request',
          objectId: id,
          correlationId: p.correlationId,
          priorState: { status: request.status, version: request.version },
          resultingState: { status: 'CANCELLED', version: request.version + 1 },
          metadata: { reason: d.reason },
        },
        tx,
      );
      return { id, status: 'CANCELLED', version: request.version + 1 };
    });
  }
  async inbox(p: AuthenticatedPrincipal) {
    return this.transaction(p, async (tx) => {
      const candidateSteps = await tx.purchaseRequestApprovalStep.findMany({
        where: {
          tenantId: p.tenantId,
          decision: 'pending',
          instance: { status: 'active' },
          OR: [{ approverUserId: p.userId }, { approverRoleId: { not: null } }],
        },
        include: { instance: { include: { purchaseRequest: true } } },
        orderBy: { createdAt: 'asc' },
      });
      const actionable = [];
      for (const step of candidateSteps) {
        if (!(await this.eligibleForStep(tx, p, step))) continue;
        if (step.instance.purchaseRequest.requesterId === p.userId) continue;
        const earlier = await tx.purchaseRequestApprovalStep.count({
          where: {
            tenantId: p.tenantId,
            instanceId: step.instanceId,
            stepNumber: { lt: step.stepNumber },
            decision: { not: 'approved' },
          },
        });
        if (earlier === 0) actionable.push(step);
      }
      return actionable;
    });
  }
  async approvalDetail(p: AuthenticatedPrincipal, stepId: string) {
    return this.transaction(p, async (tx) => {
      const step = await tx.purchaseRequestApprovalStep.findUnique({
        where: { tenantId_id: { tenantId: p.tenantId, id: stepId } },
        include: {
          instance: {
            include: {
              purchaseRequest: { include: { items: true } },
              steps: { orderBy: { stepNumber: 'asc' } },
            },
          },
        },
      });
      if (!step || !(await this.eligibleForStep(tx, p, step)))
        throw new NotFoundException('Approval not found');
      return step;
    });
  }
  async decide(
    p: AuthenticatedPrincipal,
    stepId: string,
    decision: 'approved' | 'rejected' | 'returned',
    d: DecisionDto,
  ) {
    if (decision !== 'approved' && !d.comment?.trim())
      throw new BadRequestException('A comment is required');
    return this.transaction(p, async (tx) => {
      const operationName =
        decision === 'approved' ? 'approve' : decision === 'rejected' ? 'reject' : 'return_request';
      const operation = await this.beginIdempotent(tx, p, operationName, stepId, d.idempotencyKey, {
        decision,
        version: d.version,
        comment: d.comment ?? null,
      });
      if (operation?.response) return operation.response;
      const step = await tx.purchaseRequestApprovalStep.findUnique({
        where: { tenantId_id: { tenantId: p.tenantId, id: stepId } },
      });
      if (!step) throw new NotFoundException();
      if (step.decision !== 'pending' || step.version !== d.version)
        throw new ConflictException('Approval step is not actionable');
      if (!(await this.eligibleForStep(tx, p, step)))
        throw new ForbiddenException('Approval step is not assigned to this user');
      const instance = await tx.purchaseRequestApprovalInstance.findUniqueOrThrow({
        where: { tenantId_id: { tenantId: p.tenantId, id: step.instanceId } },
      });
      const req = await tx.purchaseRequest.findUniqueOrThrow({
        where: { tenantId_id: { tenantId: p.tenantId, id: instance.purchaseRequestId } },
      });
      if (req.requesterId === p.userId)
        throw new BadRequestException('A requester cannot approve their own request');
      const earlier = await tx.purchaseRequestApprovalStep.count({
        where: {
          tenantId: p.tenantId,
          instanceId: instance.id,
          stepNumber: { lt: step.stepNumber },
          decision: { not: 'approved' },
        },
      });
      if (earlier)
        throw new ConflictException('Only the current pending approval step may be actioned');
      const claimed = await tx.purchaseRequestApprovalStep.updateMany({
        where: {
          tenantId: p.tenantId,
          id: stepId,
          version: d.version,
          decision: 'pending',
          claimedBy: null,
        },
        data: {
          decision,
          claimedBy: p.userId,
          decisionBy: p.userId,
          decisionAt: new Date(),
          comment: d.comment ?? null,
          version: { increment: 1 },
        },
      });
      if (claimed.count !== 1) throw new ConflictException('Approval step was already actioned');
      let status: PurchaseRequestStatus = req.status;
      if (decision === 'rejected') {
        assertPurchaseRequestTransition(req.status, 'REJECTED');
        status = 'REJECTED';
      } else if (decision === 'returned') {
        assertPurchaseRequestTransition(req.status, 'RETURNED_TO_REQUESTER');
        status = 'RETURNED_TO_REQUESTER';
      } else {
        const remaining = await tx.purchaseRequestApprovalStep.count({
          where: {
            tenantId: p.tenantId,
            instanceId: instance.id,
            decision: 'pending',
            id: { not: stepId },
          },
        });
        if (!remaining) {
          assertPurchaseRequestTransition(req.status, 'APPROVED');
          status = 'APPROVED';
          await tx.procurementIntakeRecord.create({
            data: { tenantId: p.tenantId, purchaseRequestId: req.id },
          });
          await this.audit.append(
            {
              tenantId: p.tenantId,
              actorId: p.userId,
              action: 'procurement_intake.created',
              objectType: 'purchase_request',
              objectId: req.id,
              correlationId: p.correlationId,
              resultingState: { status: 'unassigned' },
            },
            tx,
          );
        }
      }
      if (status !== req.status) {
        const requestChanged = await tx.purchaseRequest.updateMany({
          where: {
            tenantId: p.tenantId,
            id: req.id,
            version: req.version,
            status: req.status,
          },
          data: {
            status,
            ...(status === 'APPROVED' ? { finalApprovedAt: new Date() } : {}),
            version: { increment: 1 },
          },
        });
        if (requestChanged.count !== 1)
          throw new ConflictException('Purchase request was changed during approval');
        const instanceCompleted = await tx.purchaseRequestApprovalInstance.updateMany({
          where: { tenantId: p.tenantId, id: instance.id, status: 'active' },
          data: {
            status:
              status === 'APPROVED' ? 'approved' : status === 'REJECTED' ? 'rejected' : 'returned',
            completedAt: new Date(),
          },
        });
        if (instanceCompleted.count !== 1)
          throw new ConflictException('Approval workflow was already completed');
        await tx.purchaseRequestApprovalStep.updateMany({
          where: {
            tenantId: p.tenantId,
            instanceId: instance.id,
            decision: 'pending',
          },
          data: { decision: 'cancelled', decisionAt: new Date(), comment: 'Workflow completed' },
        });
      }
      await this.audit.append(
        {
          tenantId: p.tenantId,
          actorId: p.userId,
          action: `purchase_request.${decision}`,
          objectType: 'purchase_request',
          objectId: req.id,
          correlationId: p.correlationId,
          priorState: { request: req, step },
          resultingState: {
            request: { ...req, status, version: req.version + (status === req.status ? 0 : 1) },
            decision,
            decisionBy: p.userId,
          },
          metadata: { comment: d.comment },
        },
        tx,
      );
      if (status === 'APPROVED')
        await this.audit.append(
          {
            tenantId: p.tenantId,
            actorId: p.userId,
            action: 'purchase_request.final_approved',
            objectType: 'purchase_request',
            objectId: req.id,
            correlationId: p.correlationId,
            priorState: { status: req.status },
            resultingState: { status: 'APPROVED', intakeCreated: true },
          },
          tx,
        );
      const response = { id: req.id, status };
      await this.completeIdempotent(tx, operation!.id, response);
      return response;
    });
  }
  async queue(p: AuthenticatedPrincipal, q: IntakeQueryDto) {
    const take = q.limit,
      skip = (q.page - 1) * take;
    return this.transaction(p, async (tx) => {
      const where: Prisma.ProcurementIntakeRecordWhereInput = {
        tenantId: p.tenantId,
        ...(q.status ? { status: q.status } : {}),
        ...(q.buyerId ? { currentBuyerId: q.buyerId } : {}),
        purchaseRequest: {
          ...(q.priority ? { priority: q.priority } : {}),
          ...(q.department ? { department: q.department } : {}),
          ...(q.category ? { procurementCategory: q.category } : {}),
          ...(q.requesterId ? { requesterId: q.requesterId } : {}),
          ...(q.requiredFrom || q.requiredTo
            ? {
                requiredBy: {
                  ...(q.requiredFrom ? { gte: new Date(q.requiredFrom) } : {}),
                  ...(q.requiredTo ? { lte: new Date(q.requiredTo) } : {}),
                },
              }
            : {}),
          ...(q.search
            ? {
                OR: [
                  { requestNumber: { contains: q.search, mode: 'insensitive' } },
                  { title: { contains: q.search, mode: 'insensitive' } },
                ],
              }
            : {}),
        },
      };
      const orderBy: Prisma.ProcurementIntakeRecordOrderByWithRelationInput =
        q.sort === 'receivedAt'
          ? { receivedAt: q.direction }
          : { purchaseRequest: { [q.sort]: q.direction } };
      const [records, total] = await Promise.all([
        tx.procurementIntakeRecord.findMany({
          where,
          include: { purchaseRequest: true },
          orderBy,
          skip,
          take,
        }),
        tx.procurementIntakeRecord.count({ where }),
      ]);
      return {
        items: records.map((record) => ({
          ...record,
          agingDays: Math.floor((Date.now() - record.receivedAt.getTime()) / 86_400_000),
        })),
        total,
        page: q.page,
        limit: take,
      };
    });
  }
  async assign(p: AuthenticatedPrincipal, id: string, d: AssignmentDto) {
    return this.transaction(p, async (tx) => {
      const operation = await this.beginIdempotent(tx, p, 'assign_buyer', id, d.idempotencyKey, {
        buyerId: d.buyerId,
        reason: d.reason,
        version: d.version,
      });
      if (operation?.response) return operation.response;
      const member = await tx.tenantMembership.findUnique({
        where: { tenantId_userId: { tenantId: p.tenantId, userId: d.buyerId } },
      });
      if (!member || member.status !== 'active' || member.memberType !== 'internal')
        throw new BadRequestException('Buyer must be an active internal tenant member');
      const buyerPrincipal: AuthenticatedPrincipal = { ...p, userId: d.buyerId };
      if (
        !(await this.eligibleForStep(tx, buyerPrincipal, {
          approverUserId: d.buyerId,
          approverRoleId: null,
          requiredPermission: 'procurement_intake.read',
        }))
      )
        throw new BadRequestException('Buyer must hold the procurement intake permission');
      const intake = await tx.procurementIntakeRecord.findUnique({
        where: { tenantId_id: { tenantId: p.tenantId, id } },
      });
      if (!intake) throw new NotFoundException();
      if (intake.version !== d.version) throw new ConflictException('Intake record was changed');
      await tx.buyerAssignment.updateMany({
        where: { tenantId: p.tenantId, intakeRecordId: id, effectiveUntil: null },
        data: { effectiveUntil: new Date() },
      });
      await tx.buyerAssignment.create({
        data: {
          tenantId: p.tenantId,
          intakeRecordId: id,
          buyerId: d.buyerId,
          assignedBy: p.userId,
          reason: d.reason,
        },
      });
      const changed = await tx.procurementIntakeRecord.updateMany({
        where: { tenantId: p.tenantId, id, version: d.version, status: intake.status },
        data: { currentBuyerId: d.buyerId, status: 'assigned', version: { increment: 1 } },
      });
      if (changed.count !== 1) throw new ConflictException('Intake record was changed');
      const request = await tx.purchaseRequest.findUniqueOrThrow({
        where: { tenantId_id: { tenantId: p.tenantId, id: intake.purchaseRequestId } },
      });
      if (request.status === 'APPROVED') {
        assertPurchaseRequestTransition(request.status, 'IN_PROCUREMENT_REVIEW');
        const requestChanged = await tx.purchaseRequest.updateMany({
          where: {
            tenantId: p.tenantId,
            id: request.id,
            version: request.version,
            status: 'APPROVED',
          },
          data: { status: 'IN_PROCUREMENT_REVIEW', version: { increment: 1 } },
        });
        if (requestChanged.count !== 1)
          throw new ConflictException('Purchase request changed during buyer assignment');
      }
      await this.audit.append(
        {
          tenantId: p.tenantId,
          actorId: p.userId,
          action: intake.currentBuyerId
            ? 'procurement_intake.buyer_reassigned'
            : 'procurement_intake.buyer_assigned',
          objectType: 'procurement_intake',
          objectId: id,
          correlationId: p.correlationId,
          priorState: { buyerId: intake.currentBuyerId },
          resultingState: { buyerId: d.buyerId },
          metadata: { reason: d.reason },
        },
        tx,
      );
      const response = { id, buyerId: d.buyerId, version: d.version + 1 };
      await this.completeIdempotent(tx, operation!.id, response);
      return response;
    });
  }
  async intakeDetail(p: AuthenticatedPrincipal, id: string) {
    return this.transaction(p, async (tx) => {
      const record = await tx.procurementIntakeRecord.findUnique({
        where: { tenantId_id: { tenantId: p.tenantId, id } },
        include: {
          purchaseRequest: {
            include: { items: true, approvalInstances: { include: { steps: true } } },
          },
        },
      });
      if (!record) throw new NotFoundException('Intake record not found');
      const assignments = await tx.buyerAssignment.findMany({
        where: { tenantId: p.tenantId, intakeRecordId: id },
        orderBy: { effectiveFrom: 'desc' },
      });
      return {
        ...record,
        assignments,
        agingDays: Math.floor((Date.now() - record.receivedAt.getTime()) / 86_400_000),
      };
    });
  }
  async policies(p: AuthenticatedPrincipal) {
    return this.transaction(p, (tx) =>
      tx.approvalPolicy.findMany({
        where: { tenantId: p.tenantId },
        include: { steps: true },
        orderBy: { priority: 'asc' },
      }),
    );
  }
  async policy(p: AuthenticatedPrincipal, id: string) {
    return this.transaction(p, async (tx) => {
      const policy = await tx.approvalPolicy.findUnique({
        where: { tenantId_id: { tenantId: p.tenantId, id } },
        include: { steps: { orderBy: { stepNumber: 'asc' } } },
      });
      if (!policy) throw new NotFoundException('Approval policy not found');
      return policy;
    });
  }
  private async validatePolicy(
    tx: TransactionClient,
    p: AuthenticatedPrincipal,
    d: PolicyDto,
    excludeId?: string,
  ) {
    if (
      !d.steps.length ||
      d.steps.some((step) => Boolean(step.approverUserId) === Boolean(step.approverRoleId))
    )
      throw new BadRequestException('Every step requires exactly one approver user or role');
    const numbers = [...d.steps].map((step) => step.stepNumber).sort((a, b) => a - b);
    if (numbers.some((number, index) => number !== index + 1))
      throw new BadRequestException('Step numbers must be unique and contiguous');
    if (d.minAmount && d.maxAmount && new Prisma.Decimal(d.minAmount).gt(d.maxAmount))
      throw new BadRequestException('Policy minimum exceeds maximum');
    const samePriority = await tx.approvalPolicy.count({
      where: {
        tenantId: p.tenantId,
        priority: d.priority,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
    if (samePriority)
      throw new ConflictException('Policy priority must be unique for deterministic routing');
    for (const step of d.steps) {
      if (
        step.minThreshold &&
        step.maxThreshold &&
        new Prisma.Decimal(step.minThreshold).gt(step.maxThreshold)
      )
        throw new BadRequestException(`Step ${step.stepNumber} minimum exceeds maximum`);
      const permission = await tx.permission.findUnique({
        where: { code: step.requiredPermission },
      });
      if (!permission)
        throw new BadRequestException(`Unknown permission on step ${step.stepNumber}`);
      if (step.approverUserId) {
        const member = await tx.tenantMembership.findUnique({
          where: { tenantId_userId: { tenantId: p.tenantId, userId: step.approverUserId } },
        });
        if (!member || member.status !== 'active')
          throw new BadRequestException(
            `Step ${step.stepNumber} approver is not an active tenant member`,
          );
        const assignments = await tx.userRoleAssignment.findMany({
          where: { tenantId: p.tenantId, userId: step.approverUserId },
          select: { roleId: true },
        });
        if (
          !(await tx.rolePermission.count({
            where: {
              tenantId: p.tenantId,
              permissionId: permission.id,
              roleId: { in: assignments.map((assignment) => assignment.roleId) },
            },
          }))
        )
          throw new BadRequestException(
            `Step ${step.stepNumber} approver lacks the required permission`,
          );
      } else if (
        !(await tx.role.findUnique({
          where: { tenantId_id: { tenantId: p.tenantId, id: step.approverRoleId! } },
        }))
      )
        throw new BadRequestException(`Step ${step.stepNumber} role is not in this tenant`);
      else if (
        !(await tx.rolePermission.count({
          where: {
            tenantId: p.tenantId,
            roleId: step.approverRoleId!,
            permissionId: permission.id,
          },
        }))
      )
        throw new BadRequestException(`Step ${step.stepNumber} role lacks the required permission`);
    }
  }
  async createPolicy(p: AuthenticatedPrincipal, d: PolicyDto) {
    return this.transaction(p, async (tx) => {
      await this.validatePolicy(tx, p, d);
      const { steps, ...policy } = d;
      const row = await tx.approvalPolicy.create({
        data: {
          tenantId: p.tenantId,
          createdBy: p.userId,
          ...policy,
          ...(policy.minAmount ? { minAmount: new Prisma.Decimal(policy.minAmount) } : {}),
          ...(policy.maxAmount ? { maxAmount: new Prisma.Decimal(policy.maxAmount) } : {}),
          requestPriority: policy.requestPriority as never,
          steps: {
            create: steps.map((s) => ({
              tenantId: p.tenantId,
              stepNumber: s.stepNumber,
              requiredPermission: s.requiredPermission,
              ...(s.minThreshold ? { minThreshold: new Prisma.Decimal(s.minThreshold) } : {}),
              ...(s.maxThreshold ? { maxThreshold: new Prisma.Decimal(s.maxThreshold) } : {}),
              ...(s.approverUserId
                ? { approverUserId: s.approverUserId }
                : { approverRoleId: s.approverRoleId! }),
              ...(s.escalationAfterHours ? { escalationAfterHours: s.escalationAfterHours } : {}),
            })),
          },
        },
        include: { steps: true },
      });
      await this.audit.append(
        {
          tenantId: p.tenantId,
          actorId: p.userId,
          action: 'approval_policy.created',
          objectType: 'approval_policy',
          objectId: row.id,
          correlationId: p.correlationId,
          resultingState: { version: row.version, active: row.active },
        },
        tx,
      );
      return row;
    });
  }
  async updatePolicy(p: AuthenticatedPrincipal, id: string, d: UpdatePolicyDto) {
    return this.transaction(p, async (tx) => {
      const prior = await tx.approvalPolicy.findUnique({
        where: { tenantId_id: { tenantId: p.tenantId, id } },
        include: { steps: true },
      });
      if (!prior) throw new NotFoundException('Approval policy not found');
      await this.validatePolicy(tx, p, d, id);
      const { steps, version, ...policy } = d;
      const changed = await tx.approvalPolicy.updateMany({
        where: { tenantId: p.tenantId, id, version },
        data: {
          ...policy,
          minAmount: policy.minAmount ? new Prisma.Decimal(policy.minAmount) : null,
          maxAmount: policy.maxAmount ? new Prisma.Decimal(policy.maxAmount) : null,
          requestPriority: policy.requestPriority as never,
          version: { increment: 1 },
        },
      });
      if (changed.count !== 1) throw new ConflictException('Approval policy was changed');
      await tx.approvalPolicyStep.deleteMany({ where: { tenantId: p.tenantId, policyId: id } });
      await tx.approvalPolicyStep.createMany({
        data: steps.map((step) => ({
          tenantId: p.tenantId,
          policyId: id,
          stepNumber: step.stepNumber,
          requiredPermission: step.requiredPermission,
          approverUserId: step.approverUserId ?? null,
          approverRoleId: step.approverRoleId ?? null,
          minThreshold: step.minThreshold ? new Prisma.Decimal(step.minThreshold) : null,
          maxThreshold: step.maxThreshold ? new Prisma.Decimal(step.maxThreshold) : null,
          escalationAfterHours: step.escalationAfterHours ?? null,
        })),
      });
      const resulting = await tx.approvalPolicy.findUniqueOrThrow({
        where: { tenantId_id: { tenantId: p.tenantId, id } },
        include: { steps: { orderBy: { stepNumber: 'asc' } } },
      });
      await this.audit.append(
        {
          tenantId: p.tenantId,
          actorId: p.userId,
          action: 'approval_policy.updated',
          objectType: 'approval_policy',
          objectId: id,
          correlationId: p.correlationId,
          priorState: prior,
          resultingState: resulting,
        },
        tx,
      );
      return resulting;
    });
  }
  async setPolicyStatus(p: AuthenticatedPrincipal, id: string, d: PolicyStatusDto) {
    return this.transaction(p, async (tx) => {
      const prior = await tx.approvalPolicy.findUnique({
        where: { tenantId_id: { tenantId: p.tenantId, id } },
      });
      if (!prior) throw new NotFoundException('Approval policy not found');
      const changed = await tx.approvalPolicy.updateMany({
        where: { tenantId: p.tenantId, id, version: d.version, active: prior.active },
        data: { active: d.active, version: { increment: 1 } },
      });
      if (changed.count !== 1) throw new ConflictException('Approval policy was changed');
      const resulting = { ...prior, active: d.active, version: prior.version + 1 };
      await this.audit.append(
        {
          tenantId: p.tenantId,
          actorId: p.userId,
          action: d.active ? 'approval_policy.activated' : 'approval_policy.deactivated',
          objectType: 'approval_policy',
          objectId: id,
          correlationId: p.correlationId,
          priorState: { active: prior.active, version: prior.version },
          resultingState: { active: d.active, version: prior.version + 1 },
        },
        tx,
      );
      return resulting;
    });
  }
}

@Controller('purchase-requests')
export class PurchaseRequestController {
  constructor(private readonly s: PurchaseRequestService) {}
  @Post() @RequirePermissions('purchase_requests.create') create(
    @Req() r: Request,
    @Body() d: DraftDto,
  ) {
    return this.s.create(principal(r), d);
  }
  @Get() @RequirePermissions('purchase_requests.read_own') list(
    @Req() r: Request,
    @Query() q: RequestListQueryDto,
  ) {
    return this.s.list(principal(r), q);
  }
  @Get(':id') @RequirePermissions('purchase_requests.read_own') detail(
    @Req() r: Request,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.s.detail(principal(r), id);
  }
  @Patch(':id') @RequirePermissions('purchase_requests.update_own_draft') update(
    @Req() r: Request,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() d: UpdateDraftDto,
  ) {
    return this.s.update(principal(r), id, d);
  }
  @Post(':id/items') @RequirePermissions('purchase_requests.update_own_draft') item(
    @Req() r: Request,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() d: CreateItemDto,
  ) {
    return this.s.addItem(principal(r), id, d);
  }
  @Patch(':id/items/:itemId') @RequirePermissions('purchase_requests.update_own_draft') updateItem(
    @Req() r: Request,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('itemId', new ParseUUIDPipe()) itemId: string,
    @Body() d: UpdateItemDto,
  ) {
    return this.s.updateItem(principal(r), id, itemId, d);
  }
  @Delete(':id/items/:itemId') @RequirePermissions('purchase_requests.update_own_draft') del(
    @Req() r: Request,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('itemId', new ParseUUIDPipe()) item: string,
    @Body() d: VersionDto,
  ) {
    return this.s.removeItem(principal(r), id, item, d);
  }
  @Post(':id/submit') @RequirePermissions('purchase_requests.submit') submit(
    @Req() r: Request,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() d: SubmitDto,
  ) {
    return this.s.submit(principal(r), id, d);
  }
  @Post(':id/resubmit') @RequirePermissions('purchase_requests.submit') resubmit(
    @Req() r: Request,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() d: SubmitDto,
  ) {
    return this.s.submit(principal(r), id, d);
  }
  @Post(':id/withdraw') @RequirePermissions('purchase_requests.withdraw') withdraw(
    @Req() r: Request,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() d: VersionReasonDto,
  ) {
    return this.s.withdraw(principal(r), id, d);
  }
  @Post(':id/cancel') @RequirePermissions('purchase_requests.cancel') cancel(
    @Req() r: Request,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() d: VersionReasonDto,
  ) {
    return this.s.cancel(principal(r), id, d);
  }
}
@Controller('approvals')
export class ApprovalController {
  constructor(private readonly s: PurchaseRequestService) {}
  @Get('inbox') @RequirePermissions('approvals.read_assigned') inbox(@Req() r: Request) {
    return this.s.inbox(principal(r));
  }
  @Get(':id') @RequirePermissions('approvals.read_assigned') detail(
    @Req() r: Request,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.s.approvalDetail(principal(r), id);
  }
  @Post(':id/approve') @RequirePermissions('approvals.act') approve(
    @Req() r: Request,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() d: DecisionDto,
  ) {
    return this.s.decide(principal(r), id, 'approved', d);
  }
  @Post(':id/reject') @RequirePermissions('approvals.act') reject(
    @Req() r: Request,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() d: DecisionDto,
  ) {
    return this.s.decide(principal(r), id, 'rejected', d);
  }
  @Post(':id/return') @RequirePermissions('approvals.act') ret(
    @Req() r: Request,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() d: DecisionDto,
  ) {
    return this.s.decide(principal(r), id, 'returned', d);
  }
}
@Controller('procurement-intake')
export class IntakeController {
  constructor(private readonly s: PurchaseRequestService) {}
  @Get() @RequirePermissions('procurement_intake.read') queue(
    @Req() r: Request,
    @Query() q: IntakeQueryDto,
  ) {
    return this.s.queue(principal(r), q);
  }
  @Get(':id') @RequirePermissions('procurement_intake.read') detail(
    @Req() r: Request,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.s.intakeDetail(principal(r), id);
  }
  @Post(':id/assign') @RequirePermissions('procurement_intake.assign') assign(
    @Req() r: Request,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() d: AssignmentDto,
  ) {
    return this.s.assign(principal(r), id, d);
  }
}
@Controller('approval-policies')
export class ApprovalPolicyController {
  constructor(private readonly s: PurchaseRequestService) {}
  @Get() @RequirePermissions('approval_policies.manage') list(@Req() r: Request) {
    return this.s.policies(principal(r));
  }
  @Post() @RequirePermissions('approval_policies.manage') create(
    @Req() r: Request,
    @Body() d: PolicyDto,
  ) {
    return this.s.createPolicy(principal(r), d);
  }
  @Get(':id') @RequirePermissions('approval_policies.manage') detail(
    @Req() r: Request,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.s.policy(principal(r), id);
  }
  @Patch(':id') @RequirePermissions('approval_policies.manage') update(
    @Req() r: Request,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() d: UpdatePolicyDto,
  ) {
    return this.s.updatePolicy(principal(r), id, d);
  }
  @Post(':id/status') @RequirePermissions('approval_policies.manage') status(
    @Req() r: Request,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() d: PolicyStatusDto,
  ) {
    return this.s.setPolicyStatus(principal(r), id, d);
  }
}
