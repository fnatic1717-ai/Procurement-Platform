import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  Injectable,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
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
  @IsString() @IsNotEmpty() description!: string;
  @IsIn(['goods', 'services']) itemType!: 'goods' | 'services';
  @Matches(/^\d{1,14}(\.\d{1,6})?$/) quantity!: string;
  @IsString() @IsNotEmpty() unitOfMeasure!: string;
  @Matches(money) estimatedUnitPrice!: string;
  @IsString() @IsNotEmpty() category!: string;
  @IsString() @IsNotEmpty() specifications!: string;
  @IsDateString() requiredBy!: string;
  @IsString() @IsNotEmpty() deliveryLocation!: string;
  @IsOptional() @IsString() suggestedSupplierName?: string;
  @IsOptional() accountingDimensions?: Record<string, string>;
}
class DraftDto {
  @IsString() @IsNotEmpty() legalEntity!: string;
  @IsString() @IsNotEmpty() department!: string;
  @IsString() @IsNotEmpty() costCenter!: string;
  @IsString() @IsNotEmpty() deliveryLocation!: string;
  @IsString() @IsNotEmpty() procurementCategory!: string;
  @IsString() @IsNotEmpty() title!: string;
  @IsString() @IsNotEmpty() businessJustification!: string;
  @Matches(/^[A-Z]{3}$/) currency!: string;
  @IsDateString() requiredBy!: string;
  @IsIn(['low', 'normal', 'high', 'urgent']) priority!: 'low' | 'normal' | 'high' | 'urgent';
  @IsOptional() @IsString() internalNotes?: string;
}
class VersionDto {
  @IsInt() @Min(1) version!: number;
}
class SubmitDto extends VersionDto {
  @IsString() @IsNotEmpty() idempotencyKey!: string;
}
class DecisionDto extends VersionDto {
  @IsString() @IsNotEmpty() idempotencyKey!: string;
  @IsOptional() @IsString() comment?: string;
}
class AssignmentDto extends VersionDto {
  @IsUUID() buyerId!: string;
  @IsString() @IsNotEmpty() reason!: string;
}
class PolicyStepDto {
  @IsInt() @Min(1) stepNumber!: number;
  @IsOptional() @IsUUID() approverUserId?: string;
  @IsOptional() @IsUUID() approverRoleId?: string;
  @IsString() @IsNotEmpty() requiredPermission!: string;
  @IsOptional() @IsInt() @Min(1) escalationAfterHours?: number;
}
class PolicyDto {
  @IsString() @IsNotEmpty() name!: string;
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
  async list(
    p: AuthenticatedPrincipal,
    q: { page?: string; limit?: string; status?: PurchaseRequestStatus; search?: string },
  ) {
    const page = Math.max(1, Number(q.page) || 1),
      take = Math.min(100, Math.max(1, Number(q.limit) || 25));
    const all = p.permissions.includes('purchase_requests.read_all');
    return this.transaction(p, (tx) =>
      tx.purchaseRequest.findMany({
        where: {
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
        },
        include: { items: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * take,
        take,
      }),
    );
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
      return row;
    });
  }
  async update(p: AuthenticatedPrincipal, id: string, d: DraftDto & VersionDto) {
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
      await this.audit.append(
        {
          tenantId: p.tenantId,
          actorId: p.userId,
          action: 'purchase_request.draft_changed',
          objectType: 'purchase_request',
          objectId: id,
          correlationId: p.correlationId,
          priorState: { version },
          resultingState: { version: version + 1 },
        },
        tx,
      );
      return tx.purchaseRequest.findUniqueOrThrow({
        where: { tenantId_id: { tenantId: p.tenantId, id } },
      });
    });
  }
  async addItem(p: AuthenticatedPrincipal, id: string, d: ItemDto) {
    return this.transaction(p, async (tx) => {
      const r = await tx.purchaseRequest.findUnique({
        where: { tenantId_id: { tenantId: p.tenantId, id } },
      });
      if (!r || r.requesterId !== p.userId) throw new NotFoundException();
      if (!isPurchaseRequestEditable(r.status))
        throw new ConflictException('Purchase request is locked');
      const item = await tx.purchaseRequestItem.create({
        data: {
          tenantId: p.tenantId,
          purchaseRequestId: id,
          ...d,
          quantity: new Prisma.Decimal(d.quantity),
          estimatedUnitPrice: new Prisma.Decimal(d.estimatedUnitPrice),
          estimatedLineTotal: new Prisma.Decimal(d.quantity).mul(d.estimatedUnitPrice),
          requiredBy: new Date(d.requiredBy),
          accountingDimensions: d.accountingDimensions ?? {},
        },
      });
      await this.retotal(tx, p, id, 'purchase_request.item_added');
      return item;
    });
  }
  async removeItem(p: AuthenticatedPrincipal, id: string, itemId: string) {
    return this.transaction(p, async (tx) => {
      const r = await tx.purchaseRequest.findUnique({
        where: { tenantId_id: { tenantId: p.tenantId, id } },
      });
      if (!r || r.requesterId !== p.userId || !isPurchaseRequestEditable(r.status))
        throw new ConflictException('Purchase request is not editable');
      const deleted = await tx.purchaseRequestItem.deleteMany({
        where: { id: itemId, tenantId: p.tenantId, purchaseRequestId: id },
      });
      if (!deleted.count) throw new NotFoundException();
      await this.retotal(tx, p, id, 'purchase_request.item_removed');
      return { deleted: true };
    });
  }
  private async retotal(
    tx: TransactionClient,
    p: AuthenticatedPrincipal,
    id: string,
    action: string,
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
      },
      tx,
    );
  }
  async submit(p: AuthenticatedPrincipal, id: string, d: SubmitDto) {
    return this.transaction(p, async (tx) => {
      const r = await tx.purchaseRequest.findUnique({
        where: { tenantId_id: { tenantId: p.tenantId, id } },
        include: { items: true },
      });
      if (!r || r.requesterId !== p.userId) throw new NotFoundException();
      if (!isPurchaseRequestEditable(r.status)) {
        const existing = await tx.purchaseRequestApprovalInstance.findFirst({
          where: { tenantId: p.tenantId, purchaseRequestId: id, submissionKey: d.idempotencyKey },
        });
        if (existing) return r;
        throw new ConflictException('Purchase request cannot be submitted');
      }
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
        include: { steps: { where: { active: true }, orderBy: { stepNumber: 'asc' } } },
        orderBy: { priority: 'asc' },
      });
      const policy = policies.find((x) => x.steps.length > 0);
      if (!policy) throw new BadRequestException('No valid active approval route exists');
      if (policy.steps.some((s) => s.approverUserId === p.userId))
        throw new BadRequestException('Approval route violates segregation of duties');
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
      await tx.purchaseRequest.update({
        where: { tenantId_id: { tenantId: p.tenantId, id } },
        data: { status: 'PENDING_APPROVAL', submittedAt: new Date(), version: { increment: 1 } },
      });
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
      return { id, status: 'PENDING_APPROVAL', version: r.version + 1 };
    });
  }
  async withdraw(p: AuthenticatedPrincipal, id: string, d: VersionDto & { reason: string }) {
    return this.transaction(p, async (tx) => {
      const r = await tx.purchaseRequest.findUnique({
        where: { tenantId_id: { tenantId: p.tenantId, id } },
      });
      if (!r || r.requesterId !== p.userId) throw new NotFoundException();
      if (!['SUBMITTED', 'PENDING_APPROVAL', 'RETURNED_TO_REQUESTER'].includes(r.status))
        throw new ConflictException('Request is no longer eligible for withdrawal');
      if (r.version !== d.version) throw new ConflictException('Purchase request was changed');
      await tx.purchaseRequest.update({
        where: { tenantId_id: { tenantId: p.tenantId, id } },
        data: {
          status: 'WITHDRAWN',
          withdrawnAt: new Date(),
          withdrawnBy: p.userId,
          withdrawalReason: d.reason,
          version: { increment: 1 },
        },
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
  async inbox(p: AuthenticatedPrincipal) {
    return this.transaction(p, (tx) =>
      tx.purchaseRequestApprovalStep.findMany({
        where: { tenantId: p.tenantId, decision: 'pending', approverUserId: p.userId },
        orderBy: { createdAt: 'asc' },
      }),
    );
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
      const step = await tx.purchaseRequestApprovalStep.findUnique({
        where: { tenantId_id: { tenantId: p.tenantId, id: stepId } },
      });
      if (!step) throw new NotFoundException();
      if (step.idempotencyKey === d.idempotencyKey) return step;
      if (
        step.decision !== 'pending' ||
        step.version !== d.version ||
        step.approverUserId !== p.userId
      )
        throw new ConflictException('Approval step is not actionable');
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
      await tx.purchaseRequestApprovalStep.update({
        where: { tenantId_id: { tenantId: p.tenantId, id: stepId } },
        data: {
          decision,
          decisionBy: p.userId,
          decisionAt: new Date(),
          comment: d.comment ?? null,
          idempotencyKey: d.idempotencyKey,
          version: { increment: 1 },
        },
      });
      let status: PurchaseRequestStatus = req.status;
      if (decision === 'rejected') status = 'REJECTED';
      else if (decision === 'returned') status = 'RETURNED_TO_REQUESTER';
      else {
        const remaining = await tx.purchaseRequestApprovalStep.count({
          where: {
            tenantId: p.tenantId,
            instanceId: instance.id,
            decision: 'pending',
            id: { not: stepId },
          },
        });
        if (!remaining) {
          status = 'APPROVED';
          await tx.procurementIntakeRecord.create({
            data: { tenantId: p.tenantId, purchaseRequestId: req.id },
          });
        }
      }
      if (status !== req.status)
        await tx.purchaseRequest.update({
          where: { tenantId_id: { tenantId: p.tenantId, id: req.id } },
          data: {
            status,
            ...(status === 'APPROVED' ? { finalApprovedAt: new Date() } : {}),
            version: { increment: 1 },
          },
        });
      await this.audit.append(
        {
          tenantId: p.tenantId,
          actorId: p.userId,
          action: `purchase_request.${decision}`,
          objectType: 'purchase_request',
          objectId: req.id,
          correlationId: p.correlationId,
          priorState: { status: req.status, step: step.stepNumber },
          resultingState: { status, decision },
          metadata: { comment: d.comment },
        },
        tx,
      );
      return { id: req.id, status };
    });
  }
  async queue(
    p: AuthenticatedPrincipal,
    q: { page?: string; limit?: string; status?: 'unassigned' | 'assigned'; search?: string },
  ) {
    const take = Math.min(100, Math.max(1, Number(q.limit) || 25)),
      skip = (Math.max(1, Number(q.page) || 1) - 1) * take;
    return this.transaction(p, (tx) =>
      tx.procurementIntakeRecord.findMany({
        where: {
          tenantId: p.tenantId,
          ...(q.status ? { status: q.status } : {}),
          ...(q.search
            ? {
                purchaseRequest: {
                  OR: [
                    { requestNumber: { contains: q.search, mode: 'insensitive' } },
                    { title: { contains: q.search, mode: 'insensitive' } },
                  ],
                },
              }
            : {}),
        },
        include: { purchaseRequest: true },
        orderBy: { receivedAt: 'asc' },
        skip,
        take,
      }),
    );
  }
  async assign(p: AuthenticatedPrincipal, id: string, d: AssignmentDto) {
    return this.transaction(p, async (tx) => {
      const member = await tx.tenantMembership.findUnique({
        where: { tenantId_userId: { tenantId: p.tenantId, userId: d.buyerId } },
      });
      if (!member || member.status !== 'active' || member.memberType !== 'internal')
        throw new BadRequestException('Buyer must be an active internal tenant member');
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
      await tx.procurementIntakeRecord.update({
        where: { tenantId_id: { tenantId: p.tenantId, id } },
        data: { currentBuyerId: d.buyerId, status: 'assigned', version: { increment: 1 } },
      });
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
      return { id, buyerId: d.buyerId, version: d.version + 1 };
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
  async createPolicy(p: AuthenticatedPrincipal, d: PolicyDto) {
    if (
      !d.steps.length ||
      d.steps.some((s) => Boolean(s.approverUserId) === Boolean(s.approverRoleId))
    )
      throw new BadRequestException('Every step requires exactly one approver user or role');
    return this.transaction(p, async (tx) => {
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
    @Query() q: any,
  ) {
    return this.s.list(principal(r), q);
  }
  @Get(':id') @RequirePermissions('purchase_requests.read_own') detail(
    @Req() r: Request,
    @Param('id') id: string,
  ) {
    return this.s.detail(principal(r), id);
  }
  @Patch(':id') @RequirePermissions('purchase_requests.update_own_draft') update(
    @Req() r: Request,
    @Param('id') id: string,
    @Body() d: DraftDto & VersionDto,
  ) {
    return this.s.update(principal(r), id, d);
  }
  @Post(':id/items') @RequirePermissions('purchase_requests.update_own_draft') item(
    @Req() r: Request,
    @Param('id') id: string,
    @Body() d: ItemDto,
  ) {
    return this.s.addItem(principal(r), id, d);
  }
  @Delete(':id/items/:itemId') @RequirePermissions('purchase_requests.update_own_draft') del(
    @Req() r: Request,
    @Param('id') id: string,
    @Param('itemId') item: string,
  ) {
    return this.s.removeItem(principal(r), id, item);
  }
  @Post(':id/submit') @RequirePermissions('purchase_requests.submit') submit(
    @Req() r: Request,
    @Param('id') id: string,
    @Body() d: SubmitDto,
  ) {
    return this.s.submit(principal(r), id, d);
  }
  @Post(':id/resubmit') @RequirePermissions('purchase_requests.submit') resubmit(
    @Req() r: Request,
    @Param('id') id: string,
    @Body() d: SubmitDto,
  ) {
    return this.s.submit(principal(r), id, d);
  }
  @Post(':id/withdraw') @RequirePermissions('purchase_requests.withdraw') withdraw(
    @Req() r: Request,
    @Param('id') id: string,
    @Body() d: VersionDto & { reason: string },
  ) {
    return this.s.withdraw(principal(r), id, d);
  }
}
@Controller('approvals')
export class ApprovalController {
  constructor(private readonly s: PurchaseRequestService) {}
  @Get('inbox') @RequirePermissions('approvals.read_assigned') inbox(@Req() r: Request) {
    return this.s.inbox(principal(r));
  }
  @Post(':id/approve') @RequirePermissions('approvals.act') approve(
    @Req() r: Request,
    @Param('id') id: string,
    @Body() d: DecisionDto,
  ) {
    return this.s.decide(principal(r), id, 'approved', d);
  }
  @Post(':id/reject') @RequirePermissions('approvals.act') reject(
    @Req() r: Request,
    @Param('id') id: string,
    @Body() d: DecisionDto,
  ) {
    return this.s.decide(principal(r), id, 'rejected', d);
  }
  @Post(':id/return') @RequirePermissions('approvals.act') ret(
    @Req() r: Request,
    @Param('id') id: string,
    @Body() d: DecisionDto,
  ) {
    return this.s.decide(principal(r), id, 'returned', d);
  }
}
@Controller('procurement-intake')
export class IntakeController {
  constructor(private readonly s: PurchaseRequestService) {}
  @Get() @RequirePermissions('procurement_intake.read') queue(@Req() r: Request, @Query() q: any) {
    return this.s.queue(principal(r), q);
  }
  @Post(':id/assign') @RequirePermissions('procurement_intake.assign') assign(
    @Req() r: Request,
    @Param('id') id: string,
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
}
