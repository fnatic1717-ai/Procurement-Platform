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
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
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
} from 'class-validator';
import { createHash } from 'node:crypto';
import { prisma, type TransactionClient } from '@procurement/database';
import type { AuthenticatedPrincipal } from '@procurement/shared';
import type { Request } from 'express';
import { AuditService } from '../audit/audit.js';
import { RequirePermissions } from '../decorators/permissions.js';
const currency = /^[A-Z]{3}$/;
class PageDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 25;
  @IsOptional() @IsString() @MaxLength(200) search?: string;
}
class VersionDto {
  @IsInt() @Min(1) version!: number;
}
class CommandDto extends VersionDto {
  @IsString() @IsNotEmpty() @MaxLength(128) idempotencyKey!: string;
}
class ReasonDto extends CommandDto {
  @IsString() @IsNotEmpty() @MaxLength(1000) reason!: string;
}
class SupplierDto {
  @IsString() @IsNotEmpty() @MaxLength(250) legalName!: string;
  @IsOptional() @IsString() @MaxLength(250) tradingName?: string;
  @IsString() @MaxLength(50) supplierType!: string;
  @Matches(/^[A-Z]{2}$/) country!: string;
  @Matches(currency) defaultCurrency!: string;
  @IsOptional() @IsEmail() primaryEmail?: string;
  @IsOptional() @IsString() @MaxLength(50) primaryPhone?: string;
}
class UpdateSupplierDto extends SupplierDto {
  @IsInt() @Min(1) version!: number;
}
class ContactDto {
  @IsString() @IsNotEmpty() @MaxLength(200) fullName!: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() @MaxLength(50) phone?: string;
  @IsString() @MaxLength(50) contactType!: string;
  @IsBoolean() isPrimary = false;
}
class AddressDto {
  @IsIn(['REGISTERED', 'BILLING', 'SHIPPING']) addressType!: string;
  @Matches(/^[A-Z]{2}$/) country!: string;
  @IsString() @IsNotEmpty() @MaxLength(120) city!: string;
  @IsString() @IsNotEmpty() @MaxLength(250) addressLine1!: string;
  @IsOptional() @IsString() @MaxLength(250) addressLine2?: string;
}
class MembershipDto {
  @IsUUID() userId!: string;
  @IsBoolean() active = true;
}
class ReviewQualificationDto extends CommandDto {
  @IsUUID() recordId!: string;
  @IsIn(['APPROVED', 'REJECTED', 'EXPIRED']) status!: 'APPROVED' | 'REJECTED' | 'EXPIRED';
  @IsString() @IsNotEmpty() @MaxLength(2000) decisionComment!: string;
  @IsOptional() @IsString() @MaxLength(4000) internalRiskNotes?: string;
  @IsOptional() @IsDateString() expiryDate?: string;
}
class VerifyComplianceDto extends CommandDto {
  @IsIn(['VERIFIED', 'REJECTED']) status!: 'VERIFIED' | 'REJECTED';
  @IsOptional() @IsString() @MaxLength(1000) reason?: string;
}
class CategoryDto {
  @IsString() @IsNotEmpty() @MaxLength(50) code!: string;
  @IsString() @IsNotEmpty() @MaxLength(200) name!: string;
}
class RfqLineDto {
  @IsString() @IsNotEmpty() @MaxLength(1000) description!: string;
  @IsIn(['goods', 'services']) itemType!: 'goods' | 'services';
  @Matches(/^\d{1,14}(\.\d{1,6})?$/) quantity!: string;
  @IsString() @MaxLength(50) unitOfMeasure!: string;
  @IsString() @MaxLength(10000) specifications!: string;
  @IsDateString() requiredBy!: string;
  @IsString() @MaxLength(500) deliveryLocation!: string;
  @IsString() @MaxLength(150) category!: string;
  @IsInt() @Min(1) lineSequence!: number;
}
class UpdateRfqLineDto extends RfqLineDto {
  @IsInt() @Min(1) version!: number;
}
class DeadlineDto extends CommandDto {
  @IsDateString() clarificationDeadline!: string;
  @IsDateString() submissionDeadline!: string;
  @IsString() @IsNotEmpty() @MaxLength(1000) reason!: string;
}
class ComplianceDto {
  @IsString() @MaxLength(100) documentType!: string;
  @IsUUID() fileObjectId!: string;
  @IsOptional() @IsDateString() expiryDate?: string;
}
class RfqDto {
  @IsString() @IsNotEmpty() @MaxLength(250) title!: string;
  @IsString() @MaxLength(150) procurementCategory!: string;
  @Matches(currency) currency!: string;
  @IsDateString() clarificationDeadline!: string;
  @IsDateString() submissionDeadline!: string;
  @IsDateString() requiredBy!: string;
  @IsString() @MaxLength(500) deliveryLocation!: string;
}
class FromRequestDto extends RfqDto {
  @IsUUID() purchaseRequestId!: string;
}
class UpdateRfqDto extends RfqDto {
  @IsInt() @Min(1) version!: number;
}
class InvitationDto {
  @IsUUID() supplierId!: string;
  @IsOptional() @IsUUID() supplierContactId?: string;
  @IsDateString() expiresAt!: string;
}
class ClarificationDto {
  @IsString() @IsNotEmpty() @MaxLength(250) subject!: string;
  @IsString() @IsNotEmpty() @MaxLength(8000) body!: string;
}
class AnswerDto {
  @IsString() @IsNotEmpty() @MaxLength(8000) body!: string;
  @IsIn(['PRIVATE', 'PUBLIC']) visibility!: 'PRIVATE' | 'PUBLIC';
}
class RfqTransitionDto extends CommandDto {
  @IsIn([
    'READY_FOR_REVIEW',
    'PUBLISHED',
    'CLARIFICATION_OPEN',
    'QUOTATION_OPEN',
    'QUOTATION_CLOSED',
  ])
  status!:
    'READY_FOR_REVIEW' | 'PUBLISHED' | 'CLARIFICATION_OPEN' | 'QUOTATION_OPEN' | 'QUOTATION_CLOSED';
}
class QuoteDto {
  @Matches(currency) currency!: string;
  @IsDateString() validityDate!: string;
  @IsOptional() @IsString() @MaxLength(1000) paymentTerms?: string;
}
class UpdateQuoteDto extends QuoteDto {
  @IsInt() @Min(1) version!: number;
}
class QuoteLineDto {
  @IsUUID() rfqLineId!: string;
  @IsString() @MaxLength(1000) offeredDescription!: string;
  @Matches(/^\d{1,14}(\.\d{1,6})?$/) quantity!: string;
  @Matches(/^\d{1,16}(\.\d{1,4})?$/) unitPrice!: string;
  @Matches(/^\d{1,16}(\.\d{1,4})?$/) discount = '0';
  @Matches(/^\d{1,16}(\.\d{1,4})?$/) tax = '0';
  @IsString() @MaxLength(2000) complianceResponse!: string;
}
class UpdateQuoteLineDto extends QuoteLineDto {
  @IsInt() @Min(1) version!: number;
}
function actor(r: Request) {
  if (!r.principal) throw new BadRequestException('Principal missing');
  return r.principal;
}
function one<T>(rows: T[], conflict = false) {
  if (!rows[0]) {
    if (conflict) throw new ConflictException('Version or state conflict');
    throw new NotFoundException();
  }
  return rows[0];
}
@Injectable()
export class SourcingService {
  constructor(private readonly audit: AuditService) {}
  private tx<T>(p: AuthenticatedPrincipal, fn: (tx: TransactionClient) => Promise<T>) {
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id',${p.tenantId},true),set_config('app.actor_type',${p.actorType},true),set_config('app.current_actor_id',${p.userId},true)`;
      return fn(tx);
    });
  }

  private async idempotent<T>(
    tx: TransactionClient,
    p: AuthenticatedPrincipal,
    operation: string,
    objectId: string,
    key: string,
    payload: unknown,
    action: () => Promise<T>,
  ): Promise<T> {
    const hash = createHash('sha256')
      .update(JSON.stringify(payload, Object.keys(payload as object).sort()))
      .digest('hex');
    const inserted =
      await tx.$executeRaw`INSERT INTO sourcing_idempotency(tenant_id,actor_id,operation,object_id,idempotency_key,payload_hash) VALUES(${p.tenantId}::uuid,${p.userId}::uuid,${operation},${objectId}::uuid,${key},${hash}) ON CONFLICT DO NOTHING`;
    if (!inserted) {
      const existing = one(
        await tx.$queryRaw<
          { payload_hash: string; response: unknown; completed: boolean }[]
        >`SELECT payload_hash,response,completed FROM sourcing_idempotency WHERE actor_id=${p.userId}::uuid AND operation=${operation} AND object_id=${objectId}::uuid AND idempotency_key=${key} FOR UPDATE`,
      );
      if (existing.payload_hash !== hash)
        throw new ConflictException('Idempotency key was already used with a different payload');
      if (!existing.completed)
        throw new ConflictException('Identical operation is still processing');
      return existing.response as T;
    }
    const result = await action();
    await tx.$executeRaw`UPDATE sourcing_idempotency SET response=${JSON.stringify(result)}::jsonb,completed=true WHERE actor_id=${p.userId}::uuid AND operation=${operation} AND object_id=${objectId}::uuid AND idempotency_key=${key}`;
    return result;
  }
  private async supplier(tx: TransactionClient, p: AuthenticatedPrincipal) {
    if (p.actorType !== 'supplier_user') throw new ForbiddenException();
    const rows = await tx.$queryRaw<
      { supplier_id: string }[]
    >`SELECT m.supplier_id FROM supplier_user_memberships m JOIN suppliers s ON s.id=m.supplier_id WHERE m.user_id=${p.userId}::uuid AND m.active AND s.status='ACTIVE' AND s.qualification_status='APPROVED'`;
    if (rows.length !== 1)
      throw new ForbiddenException('Active persisted supplier membership required');
    await tx.$executeRaw`SELECT set_config('app.current_supplier_id',${rows[0]!.supplier_id},true)`;
    return rows[0]!.supplier_id;
  }
  private auditOne(
    tx: TransactionClient,
    p: AuthenticatedPrincipal,
    action: string,
    type: string,
    id: string,
    result: unknown,
    prior?: unknown,
  ) {
    return this.audit.append(
      {
        tenantId: p.tenantId,
        actorId: p.userId,
        actorType: p.actorType,
        correlationId: p.correlationId,
        action,
        objectType: type,
        objectId: id,
        resultingState: result,
        priorState: prior,
      },
      tx,
    );
  }
  async suppliers(p: AuthenticatedPrincipal, q: PageDto) {
    return this.tx(p, async (tx) => {
      const items =
        await tx.$queryRaw`SELECT id,supplier_number,legal_name,trading_name,status,qualification_status,country,default_currency,version FROM suppliers WHERE (${q.search ?? null}::text IS NULL OR legal_name ILIKE '%'||${q.search ?? ''}||'%') ORDER BY created_at DESC LIMIT ${q.limit} OFFSET ${(q.page - 1) * q.limit}`;
      const total = one(
        await tx.$queryRaw<
          { count: number }[]
        >`SELECT count(*)::int count FROM suppliers WHERE (${q.search ?? null}::text IS NULL OR legal_name ILIKE '%'||${q.search ?? ''}||'%')`,
      ).count;
      return { items, total, page: q.page, limit: q.limit };
    });
  }
  async supplierDetail(p: AuthenticatedPrincipal, id: string) {
    return this.tx(p, async (tx) =>
      one(
        await tx.$queryRaw<
          unknown[]
        >`SELECT s.*,COALESCE((SELECT jsonb_agg(to_jsonb(c)-'tenant_id') FROM supplier_contacts c WHERE c.supplier_id=s.id),'[]') contacts,COALESCE((SELECT jsonb_agg(to_jsonb(a)-'tenant_id') FROM supplier_addresses a WHERE a.supplier_id=s.id),'[]') addresses FROM suppliers s WHERE id=${id}::uuid`,
      ),
    );
  }
  async createSupplier(p: AuthenticatedPrincipal, d: SupplierDto) {
    return this.tx(p, async (tx) => {
      const s = one(
        await tx.$queryRaw<
          Record<string, unknown>[]
        >`INSERT INTO suppliers(tenant_id,supplier_number,legal_name,trading_name,supplier_type,country,default_currency,primary_email,primary_phone) VALUES(${p.tenantId}::uuid,'SUP-'||substr(gen_random_uuid()::text,1,8),${d.legalName},${d.tradingName ?? null},${d.supplierType},${d.country},${d.defaultCurrency},${d.primaryEmail ?? null},${d.primaryPhone ?? null}) RETURNING *`,
      );
      await this.auditOne(tx, p, 'supplier.created', 'supplier', String(s.id), s);
      return s;
    });
  }
  async updateSupplier(p: AuthenticatedPrincipal, id: string, d: UpdateSupplierDto) {
    return this.tx(p, async (tx) => {
      const prior = one(
        await tx.$queryRaw<
          Record<string, unknown>[]
        >`SELECT * FROM suppliers WHERE id=${id}::uuid FOR UPDATE`,
      );
      const s = one(
        await tx.$queryRaw<
          Record<string, unknown>[]
        >`UPDATE suppliers SET legal_name=${d.legalName},trading_name=${d.tradingName ?? null},supplier_type=${d.supplierType},country=${d.country},default_currency=${d.defaultCurrency},primary_email=${d.primaryEmail ?? null},primary_phone=${d.primaryPhone ?? null},version=version+1,updated_at=now() WHERE id=${id}::uuid AND version=${d.version} RETURNING *`,
        true,
      );
      await this.auditOne(tx, p, 'supplier.updated', 'supplier', id, s, prior);
      return s;
    });
  }
  async contact(p: AuthenticatedPrincipal, id: string, d: ContactDto) {
    return this.tx(p, async (tx) => {
      const c = one(
        await tx.$queryRaw<
          Record<string, unknown>[]
        >`INSERT INTO supplier_contacts(tenant_id,supplier_id,full_name,email,phone,contact_type,is_primary) VALUES(${p.tenantId}::uuid,${id}::uuid,${d.fullName},${d.email ?? null},${d.phone ?? null},${d.contactType},${d.isPrimary}) RETURNING *`,
      );
      await this.auditOne(tx, p, 'supplier.contact_added', 'supplier_contact', String(c.id), c);
      return c;
    });
  }
  async address(p: AuthenticatedPrincipal, id: string, d: AddressDto) {
    return this.tx(
      p,
      (tx) =>
        tx.$queryRaw`INSERT INTO supplier_addresses(tenant_id,supplier_id,address_type,country,city,address_line_1,address_line_2) VALUES(${p.tenantId}::uuid,${id}::uuid,${d.addressType},${d.country},${d.city},${d.addressLine1},${d.addressLine2 ?? null}) RETURNING *`,
    );
  }
  async membership(p: AuthenticatedPrincipal, id: string, d: MembershipDto) {
    return this.tx(p, async (tx) => {
      const m = one(
        await tx.$queryRaw<
          Record<string, unknown>[]
        >`INSERT INTO supplier_user_memberships(tenant_id,supplier_id,user_id,active) SELECT ${p.tenantId}::uuid,${id}::uuid,${d.userId}::uuid,${d.active} FROM tenant_memberships WHERE user_id=${d.userId}::uuid AND status='active' AND member_type='supplier' ON CONFLICT(tenant_id,supplier_id,user_id) DO UPDATE SET active=excluded.active RETURNING *`,
      );
      await this.auditOne(
        tx,
        p,
        'supplier.membership_changed',
        'supplier_membership',
        String(m.id),
        { active: d.active },
      );
      return m;
    });
  }
  async compliance(p: AuthenticatedPrincipal, id: string, d: ComplianceDto) {
    return this.tx(p, async (tx) => {
      const c = one(
        await tx.$queryRaw<
          Record<string, unknown>[]
        >`INSERT INTO supplier_compliance_documents(tenant_id,supplier_id,document_type,file_object_id,expiry_date) SELECT ${p.tenantId}::uuid,${id}::uuid,${d.documentType},f.id,${d.expiryDate ?? null}::date FROM file_objects f WHERE f.id=${d.fileObjectId}::uuid AND f.upload_state='clean' AND f.scan_status='clean' RETURNING *`,
      );
      await this.auditOne(
        tx,
        p,
        'supplier.compliance_added',
        'supplier_compliance',
        String(c.id),
        c,
      );
      return c;
    });
  }
  async status(
    p: AuthenticatedPrincipal,
    id: string,
    d: ReasonDto,
    status: 'PENDING_QUALIFICATION' | 'ACTIVE' | 'SUSPENDED' | 'BLOCKED',
  ) {
    return this.tx(p, async (tx) => {
      if (status === 'ACTIVE') {
        const ok = await tx.$queryRaw<
          unknown[]
        >`SELECT 1 FROM suppliers s WHERE s.id=${id}::uuid AND qualification_status='APPROVED' AND EXISTS(SELECT 1 FROM supplier_compliance_documents c WHERE c.supplier_id=s.id AND c.verification_status='VERIFIED' AND (c.expiry_date IS NULL OR c.expiry_date>=current_date))`;
        if (!ok[0])
          throw new ConflictException('Qualification and compliance requirements not met');
      }
      const prior = one(
        await tx.$queryRaw<
          Record<string, unknown>[]
        >`SELECT * FROM suppliers WHERE id=${id}::uuid FOR UPDATE`,
      );
      const s = one(
        await tx.$queryRaw<
          Record<string, unknown>[]
        >`UPDATE suppliers SET status=${status}::supplier_status,qualification_status=CASE WHEN ${status}='PENDING_QUALIFICATION' THEN 'PENDING'::qualification_status ELSE qualification_status END,suspension_reason=CASE WHEN ${status}='SUSPENDED' THEN ${d.reason} ELSE suspension_reason END,block_reason=CASE WHEN ${status}='BLOCKED' THEN ${d.reason} ELSE block_reason END,version=version+1 WHERE id=${id}::uuid AND version=${d.version} RETURNING *`,
        true,
      );
      if (status === 'PENDING_QUALIFICATION')
        await tx.$executeRaw`INSERT INTO supplier_qualification_records(tenant_id,supplier_id,qualification_type,status,submitted_at) VALUES(${p.tenantId}::uuid,${id}::uuid,'STANDARD','PENDING',now())`;
      await this.auditOne(tx, p, `supplier.${status.toLowerCase()}`, 'supplier', id, s, prior);
      return s;
    });
  }
  async createRfq(p: AuthenticatedPrincipal, d: RfqDto, requestId?: string) {
    return this.tx(p, async (tx) => {
      if (new Date(d.clarificationDeadline) > new Date(d.submissionDeadline))
        throw new BadRequestException('Invalid deadlines');
      let source: Record<string, unknown> | null = null;
      if (requestId)
        source = one(
          await tx.$queryRaw<
            Record<string, unknown>[]
          >`SELECT * FROM purchase_requests WHERE id=${requestId}::uuid AND status IN ('APPROVED','IN_PROCUREMENT_REVIEW') AND currency=${d.currency}`,
        );
      const r = one(
        await tx.$queryRaw<
          Record<string, unknown>[]
        >`INSERT INTO rfqs(tenant_id,rfq_number,title,procurement_category,buyer_id,currency,clarification_deadline,submission_deadline,required_by,delivery_location) VALUES(${p.tenantId}::uuid,'RFQ-'||substr(gen_random_uuid()::text,1,8),${d.title},${d.procurementCategory},${p.userId}::uuid,${d.currency},${d.clarificationDeadline}::timestamptz,${d.submissionDeadline}::timestamptz,${d.requiredBy}::date,${d.deliveryLocation}) RETURNING *`,
      );
      if (source) {
        await tx.$executeRaw`INSERT INTO rfq_purchase_request_links(tenant_id,rfq_id,purchase_request_id,source_snapshot,linked_by) VALUES(${p.tenantId}::uuid,${String(r.id)}::uuid,${requestId}::uuid,${JSON.stringify(source)}::jsonb,${p.userId}::uuid)`;
        await tx.$executeRaw`INSERT INTO rfq_lines(tenant_id,rfq_id,source_purchase_request_line_id,description,item_type,quantity,unit_of_measure,specifications,required_by,delivery_location,category,line_sequence,source_snapshot) SELECT tenant_id,${String(r.id)}::uuid,id,description,item_type,quantity,unit_of_measure,specifications,required_by,delivery_location,category,row_number() OVER(ORDER BY created_at),to_jsonb(purchase_request_items) FROM purchase_request_items WHERE purchase_request_id=${requestId}::uuid`;
      }
      await this.auditOne(tx, p, 'rfq.created', 'rfq', String(r.id), r);
      return r;
    });
  }
  async rfqs(p: AuthenticatedPrincipal, q: PageDto) {
    return this.tx(p, async (tx) => {
      const items =
        await tx.$queryRaw`SELECT id,rfq_number,title,status,currency,submission_deadline,version FROM rfqs WHERE (${q.search ?? null}::text IS NULL OR title ILIKE '%'||${q.search ?? ''}||'%') ORDER BY created_at DESC LIMIT ${q.limit} OFFSET ${(q.page - 1) * q.limit}`;
      const total = one(
        await tx.$queryRaw<
          { count: number }[]
        >`SELECT count(*)::int count FROM rfqs WHERE (${q.search ?? null}::text IS NULL OR title ILIKE '%'||${q.search ?? ''}||'%')`,
      ).count;
      return { items, total, page: q.page, limit: q.limit };
    });
  }
  async invite(p: AuthenticatedPrincipal, id: string, d: InvitationDto) {
    return this.tx(p, async (tx) => {
      const i = one(
        await tx.$queryRaw<
          Record<string, unknown>[]
        >`INSERT INTO rfq_supplier_invitations(tenant_id,rfq_id,supplier_id,supplier_contact_id,expires_at) SELECT ${p.tenantId}::uuid,${id}::uuid,s.id,c.id,${d.expiresAt}::timestamptz FROM suppliers s JOIN rfqs r ON r.id=${id}::uuid LEFT JOIN supplier_contacts c ON c.id=${d.supplierContactId ?? null}::uuid AND c.supplier_id=s.id AND c.active WHERE s.id=${d.supplierId}::uuid AND ((${d.supplierContactId ?? null}::uuid IS NULL) OR c.id IS NOT NULL) AND s.status='ACTIVE' AND s.qualification_status='APPROVED' AND r.status IN ('DRAFT','READY_FOR_REVIEW') RETURNING *`,
      );
      await this.auditOne(tx, p, 'rfq.invitation_added', 'rfq_invitation', String(i.id), i);
      return i;
    });
  }
  async publish(p: AuthenticatedPrincipal, id: string, d: CommandDto) {
    return this.transitionRfq(p, id, { ...d, status: 'PUBLISHED' });
  }
  async inbox(p: AuthenticatedPrincipal) {
    return this.tx(p, async (tx) => {
      const sid = await this.supplier(tx, p);
      return tx.$queryRaw`SELECT i.id,i.status,i.expires_at,i.version,r.rfq_number,r.title,r.submission_deadline FROM rfq_supplier_invitations i JOIN rfqs r ON r.id=i.rfq_id WHERE i.supplier_id=${sid}::uuid AND i.status NOT IN ('REVOKED','EXPIRED')`;
    });
  }
  async invitation(
    p: AuthenticatedPrincipal,
    id: string,
    d: CommandDto | ReasonDto,
    accept: boolean,
  ) {
    return this.tx(p, async (tx) => {
      const sid = await this.supplier(tx, p);
      return this.idempotent(
        tx,
        p,
        accept ? 'invitation.accept' : 'invitation.decline',
        id,
        d.idempotencyKey,
        { ...d, accept },
        async () => {
          if (!accept && !('reason' in d))
            throw new BadRequestException('Decline reason is required');
          const prior = one(
            await tx.$queryRaw<
              Record<string, unknown>[]
            >`SELECT i.* FROM rfq_supplier_invitations i JOIN suppliers s ON s.id=i.supplier_id WHERE i.id=${id}::uuid AND i.supplier_id=${sid}::uuid AND s.status='ACTIVE' AND i.version=${d.version} AND i.status IN ('SENT','VIEWED') AND i.expires_at>now() FOR UPDATE`,
            true,
          );
          const result = one(
            await tx.$queryRaw<
              Record<string, unknown>[]
            >`UPDATE rfq_supplier_invitations i SET status=${accept ? 'ACCEPTED' : 'DECLINED'}::invitation_status,accepted_at=CASE WHEN ${accept} THEN now() END,declined_at=CASE WHEN ${!accept} THEN now() END,decline_reason=CASE WHEN ${!accept} THEN ${(d as ReasonDto).reason} ELSE decline_reason END,version=version+1 WHERE i.id=${id}::uuid RETURNING i.*`,
            true,
          );
          await this.auditOne(
            tx,
            p,
            accept ? 'rfq.invitation_accepted' : 'rfq.invitation_declined',
            'rfq_invitation',
            id,
            result,
            prior,
          );
          return result;
        },
      );
    });
  }
  async question(p: AuthenticatedPrincipal, rfqId: string, d: ClarificationDto) {
    return this.tx(p, async (tx) => {
      const sid = await this.supplier(tx, p);
      const t = one(
        await tx.$queryRaw<
          Record<string, unknown>[]
        >`INSERT INTO rfq_clarification_threads(tenant_id,rfq_id,requesting_supplier_id,visibility,subject) SELECT ${p.tenantId}::uuid,r.id,${sid}::uuid,'PRIVATE',${d.subject} FROM rfqs r JOIN rfq_supplier_invitations i ON i.rfq_id=r.id WHERE r.id=${rfqId}::uuid AND i.supplier_id=${sid}::uuid AND i.status='ACCEPTED' AND r.status='CLARIFICATION_OPEN' AND r.clarification_deadline>now() RETURNING *`,
      );
      await tx.$executeRaw`INSERT INTO rfq_clarification_messages(tenant_id,thread_id,author_id,author_supplier_id,visibility,body) VALUES(${p.tenantId}::uuid,${String(t.id)}::uuid,${p.userId}::uuid,${sid}::uuid,'PRIVATE',${d.body})`;
      await this.auditOne(tx, p, 'rfq.clarification_question', 'clarification', String(t.id), {
        visibility: 'PRIVATE',
      });
      return t;
    });
  }
  async answer(p: AuthenticatedPrincipal, id: string, d: AnswerDto) {
    return this.tx(p, async (tx) => {
      const thread = one(
        await tx.$queryRaw<
          Record<string, unknown>[]
        >`SELECT * FROM rfq_clarification_threads WHERE id=${id}::uuid AND status='OPEN' FOR UPDATE`,
      );
      const responseThread =
        d.visibility === 'PUBLIC'
          ? one(
              await tx.$queryRaw<
                Record<string, unknown>[]
              >`INSERT INTO rfq_clarification_threads(tenant_id,rfq_id,visibility,subject) VALUES(${p.tenantId}::uuid,${String(thread.rfq_id)}::uuid,'PUBLIC','Public clarification') RETURNING *`,
            )
          : thread;
      const m = one(
        await tx.$queryRaw<
          Record<string, unknown>[]
        >`INSERT INTO rfq_clarification_messages(tenant_id,thread_id,author_id,visibility,body) VALUES(${p.tenantId}::uuid,${String(responseThread.id)}::uuid,${p.userId}::uuid,${d.visibility}::clarification_visibility,${d.body}) RETURNING *`,
      );
      await this.auditOne(
        tx,
        p,
        'rfq.clarification_response',
        'clarification',
        String(responseThread.id),
        { visibility: d.visibility, messageId: m.id, sourceThreadId: id },
        thread,
      );
      return m;
    });
  }
  async quote(p: AuthenticatedPrincipal, rfqId: string, d: QuoteDto) {
    return this.tx(p, async (tx) => {
      const sid = await this.supplier(tx, p);
      const q = one(
        await tx.$queryRaw<
          Record<string, unknown>[]
        >`INSERT INTO quotations(tenant_id,quotation_number,rfq_id,supplier_id,currency,validity_date,payment_terms) SELECT ${p.tenantId}::uuid,'QUO-'||substr(gen_random_uuid()::text,1,8),r.id,${sid}::uuid,${d.currency},${d.validityDate}::date,${d.paymentTerms ?? null} FROM rfqs r JOIN rfq_supplier_invitations i ON i.rfq_id=r.id WHERE r.id=${rfqId}::uuid AND i.supplier_id=${sid}::uuid AND i.status='ACCEPTED' AND r.status='QUOTATION_OPEN' AND r.submission_deadline>now() RETURNING *`,
      );
      await this.auditOne(tx, p, 'quotation.draft_created', 'quotation', String(q.id), {
        supplierId: sid,
      });
      return q;
    });
  }
  async quoteLine(p: AuthenticatedPrincipal, id: string, d: QuoteLineDto) {
    return this.tx(p, async (tx) => {
      const sid = await this.supplier(tx, p);
      return one(
        await tx.$queryRaw<
          unknown[]
        >`INSERT INTO quotation_lines(tenant_id,quotation_id,rfq_id,rfq_line_id,offered_description,quantity,unit_price,discount,tax,compliance_response) SELECT ${p.tenantId}::uuid,q.id,q.rfq_id,${d.rfqLineId}::uuid,${d.offeredDescription},${d.quantity}::numeric,${d.unitPrice}::numeric,${d.discount}::numeric,${d.tax}::numeric,${d.complianceResponse} FROM quotations q JOIN rfqs r ON r.id=q.rfq_id WHERE q.id=${id}::uuid AND q.supplier_id=${sid}::uuid AND q.status='DRAFT' AND r.status='QUOTATION_OPEN' AND r.submission_deadline>now() RETURNING *`,
      );
    });
  }
  async quoteAction(
    p: AuthenticatedPrincipal,
    id: string,
    d: ReasonDto | CommandDto,
    action: 'SUBMITTED' | 'REVISED' | 'WITHDRAWN',
  ) {
    return this.tx(p, async (tx) => {
      const sid = await this.supplier(tx, p);
      return this.idempotent(
        tx,
        p,
        `quotation.${action.toLowerCase()}`,
        id,
        d.idempotencyKey,
        { ...d, action },
        async () => {
          if (action === 'WITHDRAWN') {
            const q = one(
              await tx.$queryRaw<
                Record<string, unknown>[]
              >`UPDATE quotations SET status='WITHDRAWN',withdrawn_at=now(),withdrawal_reason=${(d as ReasonDto).reason},version=version+1 WHERE id=${id}::uuid AND supplier_id=${sid}::uuid AND version=${d.version} AND status IN ('SUBMITTED','REVISED') RETURNING *`,
              true,
            );
            await this.auditOne(tx, p, 'quotation.withdrawn', 'quotation', id, { supplierId: sid });
            return q;
          }
          const q = one(
            await tx.$queryRaw<
              Record<string, unknown>[]
            >`UPDATE quotations q SET status=(CASE WHEN q.current_revision>0 THEN 'REVISED' ELSE ${action} END)::quotation_status,submitted_at=now(),current_revision=current_revision+1,total_amount=x.total,tax_amount=x.tax,version=version+1 FROM (SELECT quotation_id,sum(net_line_amount) total,sum(tax) tax,count(*) n FROM quotation_lines GROUP BY quotation_id)x,rfqs r,suppliers s WHERE q.id=${id}::uuid AND q.id=x.quotation_id AND q.rfq_id=r.id AND q.supplier_id=s.id AND q.supplier_id=${sid}::uuid AND q.version=${d.version} AND q.status='DRAFT'::quotation_status AND s.status='ACTIVE' AND r.status='QUOTATION_OPEN' AND r.submission_deadline>now() AND x.n=(SELECT count(*) FROM rfq_lines WHERE rfq_id=r.id) RETURNING q.*`,
            true,
          );
          await tx.$executeRaw`INSERT INTO quotation_revisions(tenant_id,quotation_id,revision_number,snapshot,submitted_by) SELECT ${p.tenantId}::uuid,id,current_revision,jsonb_build_object('header',to_jsonb(q),'lines',(SELECT jsonb_agg(to_jsonb(l)) FROM quotation_lines l WHERE l.quotation_id=q.id)),${p.userId}::uuid FROM quotations q WHERE id=${id}::uuid`;
          await this.auditOne(tx, p, `quotation.${action.toLowerCase()}`, 'quotation', id, {
            supplierId: sid,
            revision: q.current_revision,
          });
          return q;
        },
      );
    });
  }
  async qualifications(p: AuthenticatedPrincipal, supplierId: string) {
    return this.tx(
      p,
      (tx) =>
        tx.$queryRaw`SELECT id,qualification_type,status,reviewer_id,submitted_at,reviewed_at,expiry_date,decision_comment,version FROM supplier_qualification_records WHERE supplier_id=${supplierId}::uuid ORDER BY created_at DESC`,
    );
  }
  async reviewQualification(
    p: AuthenticatedPrincipal,
    supplierId: string,
    d: ReviewQualificationDto,
  ) {
    return this.tx(p, (tx) =>
      this.idempotent(
        tx,
        p,
        'supplier.qualification.review',
        d.recordId,
        d.idempotencyKey,
        d,
        async () => {
          const prior = one(
            await tx.$queryRaw<
              Record<string, unknown>[]
            >`SELECT * FROM supplier_qualification_records WHERE id=${d.recordId}::uuid AND supplier_id=${supplierId}::uuid FOR UPDATE`,
          );
          const record = one(
            await tx.$queryRaw<
              Record<string, unknown>[]
            >`UPDATE supplier_qualification_records SET status=${d.status}::qualification_status,reviewer_id=${p.userId}::uuid,reviewed_at=now(),expiry_date=${d.expiryDate ?? null}::date,decision_comment=${d.decisionComment},internal_risk_notes=${d.internalRiskNotes ?? null},version=version+1 WHERE id=${d.recordId}::uuid AND version=${d.version} AND status IN ('PENDING','UNDER_REVIEW') RETURNING *`,
            true,
          );
          await tx.$executeRaw`UPDATE suppliers SET qualification_status=${d.status}::qualification_status,status=CASE WHEN ${d.status}='REJECTED' THEN 'REJECTED'::supplier_status ELSE status END,version=version+1 WHERE id=${supplierId}::uuid`;
          await this.audit.append(
            {
              tenantId: p.tenantId,
              actorId: p.userId,
              actorType: p.actorType,
              correlationId: p.correlationId,
              action: 'supplier.qualification_reviewed',
              objectType: 'supplier_qualification',
              objectId: d.recordId,
              priorState: prior,
              resultingState: record,
              metadata: { supplierId },
            },
            tx,
          );
          return record;
        },
      ),
    );
  }
  async verifyCompliance(
    p: AuthenticatedPrincipal,
    supplierId: string,
    id: string,
    d: VerifyComplianceDto,
  ) {
    return this.tx(p, (tx) =>
      this.idempotent(tx, p, 'supplier.compliance.verify', id, d.idempotencyKey, d, async () => {
        const prior = one(
          await tx.$queryRaw<
            Record<string, unknown>[]
          >`SELECT * FROM supplier_compliance_documents WHERE id=${id}::uuid AND supplier_id=${supplierId}::uuid FOR UPDATE`,
        );
        const result = one(
          await tx.$queryRaw<
            Record<string, unknown>[]
          >`UPDATE supplier_compliance_documents SET verification_status=${d.status},verified_by=${p.userId}::uuid,verified_at=now(),version=version+1 WHERE id=${id}::uuid AND version=${d.version} RETURNING *`,
          true,
        );
        await this.audit.append(
          {
            tenantId: p.tenantId,
            actorId: p.userId,
            actorType: p.actorType,
            correlationId: p.correlationId,
            action: 'supplier.compliance_reviewed',
            objectType: 'supplier_compliance',
            objectId: id,
            priorState: prior,
            resultingState: result,
            metadata: { supplierId, reason: d.reason },
          },
          tx,
        );
        return result;
      }),
    );
  }
  async category(p: AuthenticatedPrincipal, d: CategoryDto) {
    return this.tx(
      p,
      (tx) =>
        tx.$queryRaw`INSERT INTO supplier_categories(tenant_id,code,name) VALUES(${p.tenantId}::uuid,${d.code},${d.name}) RETURNING *`,
    );
  }
  async assignCategory(p: AuthenticatedPrincipal, supplierId: string, categoryId: string) {
    return this.tx(p, async (tx) => {
      const result = one(
        await tx.$queryRaw<
          Record<string, unknown>[]
        >`INSERT INTO supplier_category_assignments(tenant_id,supplier_id,category_id,assigned_by) VALUES(${p.tenantId}::uuid,${supplierId}::uuid,${categoryId}::uuid,${p.userId}::uuid) RETURNING *`,
      );
      await this.auditOne(tx, p, 'supplier.category_assigned', 'supplier', supplierId, {
        categoryId,
      });
      return result;
    });
  }
  async removeCategory(p: AuthenticatedPrincipal, supplierId: string, categoryId: string) {
    return this.tx(p, async (tx) => {
      const result =
        await tx.$executeRaw`DELETE FROM supplier_category_assignments WHERE supplier_id=${supplierId}::uuid AND category_id=${categoryId}::uuid`;
      if (!result) throw new NotFoundException();
      await this.auditOne(tx, p, 'supplier.category_removed', 'supplier', supplierId, {
        categoryId,
      });
      return { deleted: true };
    });
  }
  async rfqDetail(p: AuthenticatedPrincipal, id: string) {
    return this.tx(p, async (tx) =>
      one(
        await tx.$queryRaw<
          unknown[]
        >`SELECT r.*,COALESCE((SELECT jsonb_agg(to_jsonb(l) ORDER BY line_sequence) FROM rfq_lines l WHERE l.rfq_id=r.id),'[]') lines,COALESCE((SELECT jsonb_agg(to_jsonb(i)) FROM rfq_supplier_invitations i WHERE i.rfq_id=r.id),'[]') invitations FROM rfqs r WHERE id=${id}::uuid`,
      ),
    );
  }
  async updateRfq(p: AuthenticatedPrincipal, id: string, d: UpdateRfqDto) {
    return this.tx(p, async (tx) => {
      const prior = one(
        await tx.$queryRaw<
          Record<string, unknown>[]
        >`SELECT * FROM rfqs WHERE id=${id}::uuid FOR UPDATE`,
      );
      const result = one(
        await tx.$queryRaw<
          Record<string, unknown>[]
        >`UPDATE rfqs SET title=${d.title},procurement_category=${d.procurementCategory},currency=${d.currency},clarification_deadline=${d.clarificationDeadline}::timestamptz,submission_deadline=${d.submissionDeadline}::timestamptz,required_by=${d.requiredBy}::date,delivery_location=${d.deliveryLocation},version=version+1 WHERE id=${id}::uuid AND version=${d.version} AND status IN ('DRAFT','READY_FOR_REVIEW') RETURNING *`,
        true,
      );
      await this.audit.append(
        {
          tenantId: p.tenantId,
          actorId: p.userId,
          actorType: p.actorType,
          correlationId: p.correlationId,
          action: 'rfq.updated',
          objectType: 'rfq',
          objectId: id,
          priorState: prior,
          resultingState: result,
        },
        tx,
      );
      return result;
    });
  }
  async addRfqLine(p: AuthenticatedPrincipal, rfqId: string, d: RfqLineDto) {
    return this.tx(p, async (tx) => {
      const line = one(
        await tx.$queryRaw<
          Record<string, unknown>[]
        >`INSERT INTO rfq_lines(tenant_id,rfq_id,description,item_type,quantity,unit_of_measure,specifications,required_by,delivery_location,category,line_sequence) SELECT ${p.tenantId}::uuid,id,${d.description},${d.itemType}::purchase_item_type,${d.quantity}::numeric,${d.unitOfMeasure},${d.specifications},${d.requiredBy}::date,${d.deliveryLocation},${d.category},${d.lineSequence} FROM rfqs WHERE id=${rfqId}::uuid AND status='DRAFT' RETURNING *`,
      );
      await this.auditOne(tx, p, 'rfq.line_added', 'rfq_line', String(line.id), line);
      return line;
    });
  }
  async updateRfqLine(p: AuthenticatedPrincipal, rfqId: string, id: string, d: UpdateRfqLineDto) {
    return this.tx(p, async (tx) => {
      const line = one(
        await tx.$queryRaw<
          Record<string, unknown>[]
        >`UPDATE rfq_lines l SET description=${d.description},item_type=${d.itemType}::purchase_item_type,quantity=${d.quantity}::numeric,unit_of_measure=${d.unitOfMeasure},specifications=${d.specifications},required_by=${d.requiredBy}::date,delivery_location=${d.deliveryLocation},category=${d.category},line_sequence=${d.lineSequence},version=version+1 FROM rfqs r WHERE l.id=${id}::uuid AND l.rfq_id=${rfqId}::uuid AND l.version=${d.version} AND r.id=l.rfq_id AND r.status='DRAFT' RETURNING l.*`,
        true,
      );
      await this.auditOne(tx, p, 'rfq.line_updated', 'rfq_line', id, line);
      return line;
    });
  }
  async removeRfqLine(p: AuthenticatedPrincipal, rfqId: string, id: string, version: number) {
    return this.tx(p, async (tx) => {
      const rows = await tx.$queryRaw<
        Record<string, unknown>[]
      >`DELETE FROM rfq_lines l USING rfqs r WHERE l.id=${id}::uuid AND l.rfq_id=${rfqId}::uuid AND l.version=${version} AND r.id=l.rfq_id AND r.status='DRAFT' RETURNING l.*`;
      const line = one(rows, true);
      await this.auditOne(tx, p, 'rfq.line_removed', 'rfq_line', id, line);
      return { deleted: true };
    });
  }
  async revokeInvitation(p: AuthenticatedPrincipal, rfqId: string, id: string, d: ReasonDto) {
    return this.tx(p, (tx) =>
      this.idempotent(tx, p, 'invitation.revoke', id, d.idempotencyKey, d, async () => {
        const prior = one(
          await tx.$queryRaw<
            Record<string, unknown>[]
          >`SELECT * FROM rfq_supplier_invitations WHERE id=${id}::uuid AND rfq_id=${rfqId}::uuid FOR UPDATE`,
        );
        const result = one(
          await tx.$queryRaw<
            Record<string, unknown>[]
          >`UPDATE rfq_supplier_invitations SET status='REVOKED',version=version+1 WHERE id=${id}::uuid AND rfq_id=${rfqId}::uuid AND version=${d.version} AND status NOT IN ('REVOKED','EXPIRED') RETURNING *`,
          true,
        );
        await this.auditOne(
          tx,
          p,
          'rfq.invitation_revoked',
          'rfq_invitation',
          id,
          { ...result, reason: d.reason },
          prior,
        );
        return result;
      }),
    );
  }
  async deadline(p: AuthenticatedPrincipal, id: string, d: DeadlineDto) {
    return this.tx(p, (tx) =>
      this.idempotent(tx, p, 'rfq.deadline.extend', id, d.idempotencyKey, d, async () => {
        const prior = one(
          await tx.$queryRaw<
            Record<string, unknown>[]
          >`SELECT * FROM rfqs WHERE id=${id}::uuid FOR UPDATE`,
        );
        const result = one(
          await tx.$queryRaw<
            Record<string, unknown>[]
          >`UPDATE rfqs SET clarification_deadline=${d.clarificationDeadline}::timestamptz,submission_deadline=${d.submissionDeadline}::timestamptz,version=version+1 WHERE id=${id}::uuid AND version=${d.version} AND status IN ('PUBLISHED','CLARIFICATION_OPEN','QUOTATION_OPEN') AND ${d.submissionDeadline}::timestamptz>now() AND ${d.clarificationDeadline}::timestamptz<=${d.submissionDeadline}::timestamptz RETURNING *`,
          true,
        );
        await this.audit.append(
          {
            tenantId: p.tenantId,
            actorId: p.userId,
            actorType: p.actorType,
            correlationId: p.correlationId,
            action: 'rfq.deadline_extended',
            objectType: 'rfq',
            objectId: id,
            priorState: prior,
            resultingState: result,
            metadata: { reason: d.reason },
          },
          tx,
        );
        return result;
      }),
    );
  }

  async transitionRfq(p: AuthenticatedPrincipal, id: string, d: RfqTransitionDto) {
    return this.tx(p, (tx) =>
      this.idempotent(
        tx,
        p,
        `rfq.transition.${d.status.toLowerCase()}`,
        id,
        d.idempotencyKey,
        d,
        async () => {
          const prior = one(
            await tx.$queryRaw<
              Record<string, unknown>[]
            >`SELECT * FROM rfqs WHERE id=${id}::uuid FOR UPDATE`,
          );
          const current = String(prior.status);
          const now = Date.now();
          const clarificationDeadline = new Date(String(prior.clarification_deadline)).getTime();
          const submissionDeadline = new Date(String(prior.submission_deadline)).getTime();
          const legal: Record<string, string[]> = {
            DRAFT: ['READY_FOR_REVIEW'],
            READY_FOR_REVIEW: ['PUBLISHED'],
            PUBLISHED: ['CLARIFICATION_OPEN', 'QUOTATION_OPEN'],
            CLARIFICATION_OPEN: ['QUOTATION_OPEN'],
            QUOTATION_OPEN: ['QUOTATION_CLOSED'],
          };
          if (!(legal[current] ?? []).includes(d.status))
            throw new ConflictException('Illegal RFQ transition');
          if (d.status === 'READY_FOR_REVIEW') {
            const ready = one(
              await tx.$queryRaw<
                { ready: boolean }[]
              >`SELECT EXISTS(SELECT 1 FROM rfq_lines WHERE rfq_id=${id}::uuid) AND EXISTS(SELECT 1 FROM rfq_supplier_invitations i JOIN suppliers s ON s.id=i.supplier_id WHERE i.rfq_id=${id}::uuid AND s.status='ACTIVE' AND s.qualification_status='APPROVED') ready`,
            );
            if (!ready.ready)
              throw new ConflictException('RFQ requires at least one line and eligible supplier');
          }
          if (
            (d.status === 'PUBLISHED' || d.status === 'CLARIFICATION_OPEN') &&
            clarificationDeadline <= now
          )
            throw new ConflictException('Clarification deadline has passed');
          if (d.status === 'QUOTATION_OPEN' && submissionDeadline <= now)
            throw new ConflictException('Quotation deadline has passed');
          if (d.status === 'QUOTATION_CLOSED' && submissionDeadline > now)
            throw new ConflictException('Quotation deadline has not passed');
          const result = one(
            await tx.$queryRaw<
              Record<string, unknown>[]
            >`UPDATE rfqs SET status=${d.status}::rfq_status,published_at=CASE WHEN ${d.status}='PUBLISHED' THEN COALESCE(published_at,now()) ELSE published_at END,issue_date=CASE WHEN ${d.status}='PUBLISHED' THEN COALESCE(issue_date,current_date) ELSE issue_date END,version=version+1 WHERE id=${id}::uuid AND version=${d.version} RETURNING *`,
            true,
          );
          if (d.status === 'PUBLISHED') {
            await tx.$executeRaw`UPDATE rfq_supplier_invitations i SET status='SENT',sent_at=COALESCE(sent_at,now()),version=version+1 FROM suppliers s WHERE i.rfq_id=${id}::uuid AND i.status='DRAFT' AND s.id=i.supplier_id AND s.status='ACTIVE' AND s.qualification_status='APPROVED'`;
            await tx.$executeRaw`UPDATE rfq_supplier_invitations i SET status='REVOKED',version=version+1 FROM suppliers s WHERE i.rfq_id=${id}::uuid AND i.status='DRAFT' AND s.id=i.supplier_id AND (s.status<>'ACTIVE' OR s.qualification_status<>'APPROVED')`;
          }
          await this.audit.append(
            {
              tenantId: p.tenantId,
              actorId: p.userId,
              actorType: p.actorType,
              correlationId: p.correlationId,
              action: `rfq.transition.${d.status.toLowerCase()}`,
              objectType: 'rfq',
              objectId: id,
              priorState: prior,
              resultingState: result,
            },
            tx,
          );
          return result;
        },
      ),
    );
  }

  async terminal(
    p: AuthenticatedPrincipal,
    id: string,
    d: ReasonDto,
    status: 'CANCELLED' | 'CLOSED',
  ) {
    return this.tx(p, (tx) =>
      this.idempotent(tx, p, `rfq.${status.toLowerCase()}`, id, d.idempotencyKey, d, async () => {
        const prior = one(
          await tx.$queryRaw<
            Record<string, unknown>[]
          >`SELECT * FROM rfqs WHERE id=${id}::uuid FOR UPDATE`,
        );
        const allowed =
          status === 'CANCELLED'
            ? ['DRAFT', 'READY_FOR_REVIEW', 'PUBLISHED', 'CLARIFICATION_OPEN', 'QUOTATION_OPEN']
            : ['QUOTATION_CLOSED'];
        let effectivePrior = prior;
        let effectiveVersion = d.version;
        if (
          status === 'CLOSED' &&
          String(prior.status) === 'QUOTATION_OPEN' &&
          new Date(String(prior.submission_deadline)).getTime() <= Date.now()
        ) {
          const quotationClosed = one(
            await tx.$queryRaw<
              Record<string, unknown>[]
            >`UPDATE rfqs SET status='QUOTATION_CLOSED',version=version+1 WHERE id=${id}::uuid AND version=${d.version} RETURNING *`,
            true,
          );
          await this.audit.append(
            {
              tenantId: p.tenantId,
              actorId: p.userId,
              actorType: p.actorType,
              correlationId: p.correlationId,
              action: 'rfq.transition.quotation_closed',
              objectType: 'rfq',
              objectId: id,
              priorState: prior,
              resultingState: quotationClosed,
            },
            tx,
          );
          effectivePrior = quotationClosed;
          effectiveVersion = Number(quotationClosed.version);
        }
        if (!allowed.includes(String(effectivePrior.status)))
          throw new ConflictException('Illegal RFQ transition');
        const result = one(
          await tx.$queryRaw<
            Record<string, unknown>[]
          >`UPDATE rfqs SET status=${status}::rfq_status,cancelled_at=CASE WHEN ${status}='CANCELLED' THEN now() END,cancellation_reason=CASE WHEN ${status}='CANCELLED' THEN ${d.reason} END,closed_at=CASE WHEN ${status}='CLOSED' THEN now() END,version=version+1 WHERE id=${id}::uuid AND version=${effectiveVersion} RETURNING *`,
          true,
        );
        if (status === 'CANCELLED')
          await tx.$executeRaw`UPDATE rfq_supplier_invitations SET status='REVOKED',version=version+1 WHERE rfq_id=${id}::uuid AND status IN ('DRAFT','SENT','VIEWED','ACCEPTED')`;
        await this.audit.append(
          {
            tenantId: p.tenantId,
            actorId: p.userId,
            actorType: p.actorType,
            correlationId: p.correlationId,
            action: `rfq.${status.toLowerCase()}`,
            objectType: 'rfq',
            objectId: id,
            priorState: effectivePrior,
            resultingState: result,
            metadata: { reason: d.reason },
          },
          tx,
        );
        return result;
      }),
    );
  }
  async startRevision(p: AuthenticatedPrincipal, id: string, d: CommandDto) {
    return this.tx(p, async (tx) => {
      const sid = await this.supplier(tx, p);
      return this.idempotent(
        tx,
        p,
        'quotation.revision.start',
        id,
        d.idempotencyKey,
        d,
        async () => {
          const result = one(
            await tx.$queryRaw<
              Record<string, unknown>[]
            >`UPDATE quotations q SET status='DRAFT',version=version+1 FROM rfqs r,suppliers s WHERE q.id=${id}::uuid AND q.supplier_id=${sid}::uuid AND q.version=${d.version} AND q.status IN ('SUBMITTED','REVISED') AND q.rfq_id=r.id AND r.status='QUOTATION_OPEN' AND r.submission_deadline>now() AND q.supplier_id=s.id AND s.status='ACTIVE' RETURNING q.*`,
            true,
          );
          await this.auditOne(tx, p, 'quotation.revision_started', 'quotation', id, {
            supplierId: sid,
            nextRevision: Number(result.current_revision) + 1,
          });
          return result;
        },
      );
    });
  }
  async quotationDetail(p: AuthenticatedPrincipal, id: string) {
    return this.tx(p, async (tx) => {
      const sid = await this.supplier(tx, p);
      return one(
        await tx.$queryRaw<
          unknown[]
        >`SELECT q.*,COALESCE((SELECT jsonb_agg(to_jsonb(l)) FROM quotation_lines l WHERE l.quotation_id=q.id),'[]') lines,COALESCE((SELECT jsonb_agg(jsonb_build_object('revisionNumber',r.revision_number,'submittedAt',r.submitted_at)) FROM quotation_revisions r WHERE r.quotation_id=q.id),'[]') history FROM quotations q WHERE q.id=${id}::uuid AND q.supplier_id=${sid}::uuid`,
      );
    });
  }
  async quotationHistory(p: AuthenticatedPrincipal, id: string) {
    return this.tx(p, async (tx) => {
      const sid = await this.supplier(tx, p);
      return tx.$queryRaw`SELECT r.id,r.revision_number,r.submitted_at,r.snapshot FROM quotation_revisions r JOIN quotations q ON q.id=r.quotation_id WHERE q.id=${id}::uuid AND q.supplier_id=${sid}::uuid ORDER BY r.revision_number`;
    });
  }
  async buyerQuotations(p: AuthenticatedPrincipal, rfqId: string, q: PageDto) {
    return this.tx(p, async (tx) => {
      const commercial = p.permissions.includes('quotations.read_commercial');
      const items = commercial
        ? await tx.$queryRaw`SELECT id,quotation_number,supplier_id,status,currency,total_amount,tax_amount,submitted_at,current_revision FROM quotations WHERE rfq_id=${rfqId}::uuid AND status<>'DRAFT' ORDER BY submitted_at LIMIT ${q.limit} OFFSET ${(q.page - 1) * q.limit}`
        : await tx.$queryRaw`SELECT id,quotation_number,supplier_id,status,submitted_at,current_revision FROM quotations WHERE rfq_id=${rfqId}::uuid AND status<>'DRAFT' ORDER BY submitted_at LIMIT ${q.limit} OFFSET ${(q.page - 1) * q.limit}`;
      const total = one(
        await tx.$queryRaw<
          { count: number }[]
        >`SELECT count(*)::int count FROM quotations WHERE rfq_id=${rfqId}::uuid AND status<>'DRAFT'`,
      ).count;
      return { items, total, page: q.page, limit: q.limit };
    });
  }
  async invitationDetail(p: AuthenticatedPrincipal, id: string) {
    return this.tx(p, async (tx) => {
      const sid = await this.supplier(tx, p);
      const prior = one(
        await tx.$queryRaw<
          Record<string, unknown>[]
        >`SELECT i.* FROM rfq_supplier_invitations i JOIN suppliers s ON s.id=i.supplier_id WHERE i.id=${id}::uuid AND i.supplier_id=${sid}::uuid AND i.status NOT IN ('REVOKED','EXPIRED') AND s.status='ACTIVE' FOR UPDATE`,
      );
      const viewed = one(
        await tx.$queryRaw<
          unknown[]
        >`UPDATE rfq_supplier_invitations SET status=CASE WHEN status='SENT' THEN 'VIEWED'::invitation_status ELSE status END,viewed_at=COALESCE(viewed_at,now()),version=CASE WHEN viewed_at IS NULL THEN version+1 ELSE version END WHERE id=${id}::uuid RETURNING *`,
      );
      await this.auditOne(tx, p, 'rfq.invitation_viewed', 'rfq_invitation', id, viewed, prior);
      return one(
        await tx.$queryRaw<
          unknown[]
        >`SELECT i.id,i.status,i.expires_at,i.sent_at,i.viewed_at,i.accepted_at,i.declined_at,i.decline_reason,i.version,r.id rfq_id,r.rfq_number,r.title,r.procurement_category,r.currency,r.submission_deadline,r.clarification_deadline,r.required_by,r.delivery_location,r.commercial_terms,r.payment_terms,r.confidentiality_instructions FROM rfq_supplier_invitations i JOIN rfqs r ON r.id=i.rfq_id WHERE i.id=${id}::uuid AND i.supplier_id=${sid}::uuid`,
      );
    });
  }
  async clarificationList(p: AuthenticatedPrincipal, rfqId: string) {
    return this.tx(p, async (tx) => {
      if (p.actorType === 'supplier_user') {
        const sid = await this.supplier(tx, p);
        return tx.$queryRaw`SELECT t.id,t.subject,t.visibility,t.status,t.created_at,COALESCE(jsonb_agg(jsonb_build_object('id',m.id,'body',m.body,'visibility',m.visibility,'publishedAt',m.published_at,'buyerAuthored',m.author_supplier_id IS NULL) ORDER BY m.published_at),'[]') messages FROM rfq_clarification_threads t JOIN rfq_clarification_messages m ON m.thread_id=t.id WHERE t.rfq_id=${rfqId}::uuid AND (t.requesting_supplier_id=${sid}::uuid OR (m.visibility='PUBLIC' AND m.author_supplier_id IS NULL)) AND EXISTS(SELECT 1 FROM rfq_supplier_invitations i WHERE i.rfq_id=t.rfq_id AND i.supplier_id=${sid}::uuid AND i.status IN ('SENT','VIEWED','ACCEPTED')) GROUP BY t.id`;
      }
      return tx.$queryRaw`SELECT t.*,COALESCE(jsonb_agg(to_jsonb(m) ORDER BY m.published_at),'[]') messages FROM rfq_clarification_threads t JOIN rfq_clarification_messages m ON m.thread_id=t.id WHERE t.rfq_id=${rfqId}::uuid GROUP BY t.id`;
    });
  }
  async closeClarification(p: AuthenticatedPrincipal, id: string, d: CommandDto) {
    return this.tx(p, (tx) =>
      this.idempotent(tx, p, 'clarification.close', id, d.idempotencyKey, d, async () => {
        const result = one(
          await tx.$queryRaw<
            Record<string, unknown>[]
          >`UPDATE rfq_clarification_threads SET status='CLOSED',closed_at=now() WHERE id=${id}::uuid AND status='OPEN' RETURNING *`,
          true,
        );
        await this.auditOne(tx, p, 'rfq.clarification_closed', 'clarification', id, result);
        return result;
      }),
    );
  }
  async updateQuote(p: AuthenticatedPrincipal, id: string, d: UpdateQuoteDto) {
    return this.tx(p, async (tx) => {
      const sid = await this.supplier(tx, p);
      const result = one(
        await tx.$queryRaw<
          Record<string, unknown>[]
        >`UPDATE quotations SET currency=${d.currency},validity_date=${d.validityDate}::date,payment_terms=${d.paymentTerms ?? null},version=version+1 WHERE id=${id}::uuid AND supplier_id=${sid}::uuid AND status='DRAFT' AND version=${d.version} AND EXISTS(SELECT 1 FROM rfqs r WHERE r.id=quotations.rfq_id AND r.status='QUOTATION_OPEN' AND r.submission_deadline>now()) RETURNING *`,
        true,
      );
      await this.auditOne(tx, p, 'quotation.draft_updated', 'quotation', id, { supplierId: sid });
      return result;
    });
  }
  async updateQuoteLine(
    p: AuthenticatedPrincipal,
    quotationId: string,
    id: string,
    d: UpdateQuoteLineDto,
  ) {
    return this.tx(p, async (tx) => {
      const sid = await this.supplier(tx, p);
      const result = one(
        await tx.$queryRaw<
          Record<string, unknown>[]
        >`UPDATE quotation_lines l SET offered_description=${d.offeredDescription},quantity=${d.quantity}::numeric,unit_price=${d.unitPrice}::numeric,discount=${d.discount}::numeric,tax=${d.tax}::numeric,compliance_response=${d.complianceResponse},version=version+1 FROM quotations q,rfqs r WHERE l.id=${id}::uuid AND l.quotation_id=${quotationId}::uuid AND l.version=${d.version} AND q.id=l.quotation_id AND q.supplier_id=${sid}::uuid AND q.status='DRAFT' AND q.rfq_id=r.id AND r.status='QUOTATION_OPEN' AND r.submission_deadline>now() RETURNING l.*`,
        true,
      );
      await this.auditOne(tx, p, 'quotation.line_updated', 'quotation_line', id, {
        supplierId: sid,
      });
      return result;
    });
  }
  async removeQuoteLine(
    p: AuthenticatedPrincipal,
    quotationId: string,
    id: string,
    version: number,
  ) {
    return this.tx(p, async (tx) => {
      const sid = await this.supplier(tx, p);
      const result = one(
        await tx.$queryRaw<
          Record<string, unknown>[]
        >`DELETE FROM quotation_lines l USING quotations q WHERE l.id=${id}::uuid AND l.quotation_id=${quotationId}::uuid AND l.version=${version} AND q.id=l.quotation_id AND q.supplier_id=${sid}::uuid AND q.status='DRAFT' AND EXISTS(SELECT 1 FROM rfqs r WHERE r.id=q.rfq_id AND r.status='QUOTATION_OPEN' AND r.submission_deadline>now()) RETURNING l.*`,
        true,
      );
      await this.auditOne(tx, p, 'quotation.line_removed', 'quotation_line', id, {
        supplierId: sid,
      });
      return result;
    });
  }
}
@Controller()
export class SourcingController {
  constructor(private readonly s: SourcingService) {}
  @Get('suppliers') @RequirePermissions('suppliers.read') suppliers(
    @Req() r: Request,
    @Query() q: PageDto,
  ) {
    return this.s.suppliers(actor(r), q);
  }
  @Post('suppliers') @RequirePermissions('suppliers.create') create(
    @Req() r: Request,
    @Body() d: SupplierDto,
  ) {
    return this.s.createSupplier(actor(r), d);
  }
  @Get('suppliers/:id') @RequirePermissions('suppliers.read') detail(
    @Req() r: Request,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.s.supplierDetail(actor(r), id);
  }
  @Patch('suppliers/:id') @RequirePermissions('suppliers.update') update(
    @Req() r: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: UpdateSupplierDto,
  ) {
    return this.s.updateSupplier(actor(r), id, d);
  }
  @Post('suppliers/:id/contacts') @RequirePermissions('suppliers.update') contact(
    @Req() r: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: ContactDto,
  ) {
    return this.s.contact(actor(r), id, d);
  }
  @Post('suppliers/:id/addresses') @RequirePermissions('suppliers.update') address(
    @Req() r: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: AddressDto,
  ) {
    return this.s.address(actor(r), id, d);
  }
  @Post('suppliers/:id/memberships') @RequirePermissions('supplier_users.manage') membership(
    @Req() r: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: MembershipDto,
  ) {
    return this.s.membership(actor(r), id, d);
  }
  @Post('suppliers/:id/compliance') @RequirePermissions('supplier_compliance.manage') compliance(
    @Req() r: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: ComplianceDto,
  ) {
    return this.s.compliance(actor(r), id, d);
  }
  @Post('suppliers/:id/qualification/submit') @RequirePermissions('suppliers.qualify') qualify(
    @Req() r: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: ReasonDto,
  ) {
    return this.s.status(actor(r), id, d, 'PENDING_QUALIFICATION');
  }
  @Post('suppliers/:id/activate') @RequirePermissions('suppliers.activate') activate(
    @Req() r: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: ReasonDto,
  ) {
    return this.s.status(actor(r), id, d, 'ACTIVE');
  }
  @Post('suppliers/:id/suspend') @RequirePermissions('suppliers.suspend') suspend(
    @Req() r: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: ReasonDto,
  ) {
    return this.s.status(actor(r), id, d, 'SUSPENDED');
  }
  @Post('suppliers/:id/block') @RequirePermissions('suppliers.block') block(
    @Req() r: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: ReasonDto,
  ) {
    return this.s.status(actor(r), id, d, 'BLOCKED');
  }
  @Get('rfqs') @RequirePermissions('rfqs.read') rfqs(@Req() r: Request, @Query() q: PageDto) {
    return this.s.rfqs(actor(r), q);
  }
  @Post('rfqs') @RequirePermissions('rfqs.create') rfq(@Req() r: Request, @Body() d: RfqDto) {
    return this.s.createRfq(actor(r), d);
  }
  @Post('rfqs/from-purchase-request') @RequirePermissions('rfqs.create') from(
    @Req() r: Request,
    @Body() d: FromRequestDto,
  ) {
    return this.s.createRfq(actor(r), d, d.purchaseRequestId);
  }
  @Post('rfqs/:id/invitations') @RequirePermissions('rfq_invitations.manage') invite(
    @Req() r: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: InvitationDto,
  ) {
    return this.s.invite(actor(r), id, d);
  }
  @Post('rfqs/:id/transition') @RequirePermissions('rfqs.publish') transition(
    @Req() r: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: RfqTransitionDto,
  ) {
    return this.s.transitionRfq(actor(r), id, d);
  }
  @Post('rfqs/:id/publish') @RequirePermissions('rfqs.publish') publish(
    @Req() r: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: CommandDto,
  ) {
    return this.s.publish(actor(r), id, d);
  }
  @Get('supplier-portal/invitations')
  @RequirePermissions('supplier_portal.rfqs.read_invited')
  inbox(@Req() r: Request) {
    return this.s.inbox(actor(r));
  }
  @Post('supplier-portal/invitations/:id/accept')
  @RequirePermissions('supplier_portal.invitations.respond')
  accept(@Req() r: Request, @Param('id', ParseUUIDPipe) id: string, @Body() d: CommandDto) {
    return this.s.invitation(actor(r), id, d, true);
  }
  @Post('supplier-portal/invitations/:id/decline')
  @RequirePermissions('supplier_portal.invitations.respond')
  decline(@Req() r: Request, @Param('id', ParseUUIDPipe) id: string, @Body() d: ReasonDto) {
    return this.s.invitation(actor(r), id, d, false);
  }
  @Post('supplier-portal/rfqs/:id/clarifications')
  @RequirePermissions('supplier_portal.clarifications.create')
  question(@Req() r: Request, @Param('id', ParseUUIDPipe) id: string, @Body() d: ClarificationDto) {
    return this.s.question(actor(r), id, d);
  }
  @Post('rfq-clarifications/:id/responses') @RequirePermissions('rfq_clarifications.manage') answer(
    @Req() r: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: AnswerDto,
  ) {
    return this.s.answer(actor(r), id, d);
  }
  @Post('supplier-portal/rfqs/:id/quotations')
  @RequirePermissions('supplier_portal.quotations.create')
  quote(@Req() r: Request, @Param('id', ParseUUIDPipe) id: string, @Body() d: QuoteDto) {
    return this.s.quote(actor(r), id, d);
  }
  @Post('supplier-portal/quotations/:id/lines')
  @RequirePermissions('supplier_portal.quotations.create')
  line(@Req() r: Request, @Param('id', ParseUUIDPipe) id: string, @Body() d: QuoteLineDto) {
    return this.s.quoteLine(actor(r), id, d);
  }
  @Post('supplier-portal/quotations/:id/submit')
  @RequirePermissions('supplier_portal.quotations.submit')
  submit(@Req() r: Request, @Param('id', ParseUUIDPipe) id: string, @Body() d: CommandDto) {
    return this.s.quoteAction(actor(r), id, d, 'SUBMITTED');
  }
  @Post('supplier-portal/quotations/:id/revise')
  @RequirePermissions('supplier_portal.quotations.revise')
  revise(@Req() r: Request, @Param('id', ParseUUIDPipe) id: string, @Body() d: CommandDto) {
    return this.s.quoteAction(actor(r), id, d, 'REVISED');
  }
  @Post('supplier-portal/quotations/:id/withdraw')
  @RequirePermissions('supplier_portal.quotations.withdraw')
  withdraw(@Req() r: Request, @Param('id', ParseUUIDPipe) id: string, @Body() d: ReasonDto) {
    return this.s.quoteAction(actor(r), id, d, 'WITHDRAWN');
  }
  @Get('suppliers/:id/qualifications') @RequirePermissions('suppliers.read') qualifications(
    @Req() r: Request,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.s.qualifications(actor(r), id);
  }
  @Post('suppliers/:id/qualifications/review')
  @RequirePermissions('suppliers.qualify')
  reviewQualification(
    @Req() r: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: ReviewQualificationDto,
  ) {
    return this.s.reviewQualification(actor(r), id, d);
  }
  @Post('suppliers/:supplierId/compliance/:id/verify')
  @RequirePermissions('supplier_compliance.manage')
  verifyCompliance(
    @Req() r: Request,
    @Param('supplierId', ParseUUIDPipe) supplierId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: VerifyComplianceDto,
  ) {
    return this.s.verifyCompliance(actor(r), supplierId, id, d);
  }
  @Post('supplier-categories') @RequirePermissions('suppliers.update') category(
    @Req() r: Request,
    @Body() d: CategoryDto,
  ) {
    return this.s.category(actor(r), d);
  }
  @Post('suppliers/:id/categories/:categoryId')
  @RequirePermissions('suppliers.update')
  assignCategory(
    @Req() r: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
  ) {
    return this.s.assignCategory(actor(r), id, categoryId);
  }
  @Delete('suppliers/:id/categories/:categoryId')
  @RequirePermissions('suppliers.update')
  removeCategory(
    @Req() r: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
  ) {
    return this.s.removeCategory(actor(r), id, categoryId);
  }
  @Get('rfqs/:id') @RequirePermissions('rfqs.read') rfqDetail(
    @Req() r: Request,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.s.rfqDetail(actor(r), id);
  }
  @Patch('rfqs/:id') @RequirePermissions('rfqs.update_draft') updateRfq(
    @Req() r: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: UpdateRfqDto,
  ) {
    return this.s.updateRfq(actor(r), id, d);
  }
  @Post('rfqs/:id/lines') @RequirePermissions('rfqs.update_draft') addRfqLine(
    @Req() r: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: RfqLineDto,
  ) {
    return this.s.addRfqLine(actor(r), id, d);
  }
  @Patch('rfqs/:rfqId/lines/:id') @RequirePermissions('rfqs.update_draft') updateRfqLine(
    @Req() r: Request,
    @Param('rfqId', ParseUUIDPipe) rfqId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: UpdateRfqLineDto,
  ) {
    return this.s.updateRfqLine(actor(r), rfqId, id, d);
  }
  @Delete('rfqs/:rfqId/lines/:id') @RequirePermissions('rfqs.update_draft') removeRfqLine(
    @Req() r: Request,
    @Param('rfqId', ParseUUIDPipe) rfqId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('version', ParseIntPipe) version: number,
  ) {
    return this.s.removeRfqLine(actor(r), rfqId, id, Number(version));
  }
  @Post('rfqs/:rfqId/invitations/:id/revoke')
  @RequirePermissions('rfq_invitations.manage')
  revokeInvitation(
    @Req() r: Request,
    @Param('rfqId', ParseUUIDPipe) rfqId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: ReasonDto,
  ) {
    return this.s.revokeInvitation(actor(r), rfqId, id, d);
  }
  @Post('rfqs/:id/deadline-extension') @RequirePermissions('rfqs.extend_deadline') deadline(
    @Req() r: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: DeadlineDto,
  ) {
    return this.s.deadline(actor(r), id, d);
  }
  @Post('rfqs/:id/cancel') @RequirePermissions('rfqs.cancel') cancel(
    @Req() r: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: ReasonDto,
  ) {
    return this.s.terminal(actor(r), id, d, 'CANCELLED');
  }
  @Post('rfqs/:id/close') @RequirePermissions('rfqs.close') close(
    @Req() r: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: ReasonDto,
  ) {
    return this.s.terminal(actor(r), id, d, 'CLOSED');
  }
  @Post('supplier-portal/quotations/:id/revisions/start')
  @RequirePermissions('supplier_portal.quotations.revise')
  startRevision(@Req() r: Request, @Param('id', ParseUUIDPipe) id: string, @Body() d: CommandDto) {
    return this.s.startRevision(actor(r), id, d);
  }
  @Get('supplier-portal/quotations/:id')
  @RequirePermissions('supplier_portal.rfqs.read_invited')
  quotationDetail(@Req() r: Request, @Param('id', ParseUUIDPipe) id: string) {
    return this.s.quotationDetail(actor(r), id);
  }
  @Get('supplier-portal/quotations/:id/history')
  @RequirePermissions('supplier_portal.rfqs.read_invited')
  quotationHistory(@Req() r: Request, @Param('id', ParseUUIDPipe) id: string) {
    return this.s.quotationHistory(actor(r), id);
  }
  @Get('rfqs/:id/quotations') @RequirePermissions('quotations.read') buyerQuotations(
    @Req() r: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() q: PageDto,
  ) {
    return this.s.buyerQuotations(actor(r), id, q);
  }
  @Get('supplier-portal/invitations/:id')
  @RequirePermissions('supplier_portal.rfqs.read_invited')
  invitationDetail(@Req() r: Request, @Param('id', ParseUUIDPipe) id: string) {
    return this.s.invitationDetail(actor(r), id);
  }
  @Get('rfqs/:id/clarifications')
  @RequirePermissions('rfq_clarifications.manage')
  clarificationList(@Req() r: Request, @Param('id', ParseUUIDPipe) id: string) {
    return this.s.clarificationList(actor(r), id);
  }
  @Post('rfq-clarifications/:id/close')
  @RequirePermissions('rfq_clarifications.manage')
  closeClarification(
    @Req() r: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: CommandDto,
  ) {
    return this.s.closeClarification(actor(r), id, d);
  }
  @Patch('supplier-portal/quotations/:id')
  @RequirePermissions('supplier_portal.quotations.create')
  updateQuote(
    @Req() r: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: UpdateQuoteDto,
  ) {
    return this.s.updateQuote(actor(r), id, d);
  }
  @Patch('supplier-portal/quotations/:quotationId/lines/:id')
  @RequirePermissions('supplier_portal.quotations.create')
  updateQuoteLine(
    @Req() r: Request,
    @Param('quotationId', ParseUUIDPipe) quotationId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: UpdateQuoteLineDto,
  ) {
    return this.s.updateQuoteLine(actor(r), quotationId, id, d);
  }
  @Delete('supplier-portal/quotations/:quotationId/lines/:id')
  @RequirePermissions('supplier_portal.quotations.create')
  removeQuoteLine(
    @Req() r: Request,
    @Param('quotationId', ParseUUIDPipe) quotationId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('version', ParseIntPipe) version: number,
  ) {
    return this.s.removeQuoteLine(actor(r), quotationId, id, version);
  }
  @Get('supplier-portal/rfqs/:id/clarifications')
  @RequirePermissions('supplier_portal.rfqs.read_invited')
  supplierClarificationList(@Req() r: Request, @Param('id', ParseUUIDPipe) id: string) {
    return this.s.clarificationList(actor(r), id);
  }
}
