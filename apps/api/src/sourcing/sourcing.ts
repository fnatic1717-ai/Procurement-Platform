import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
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
class QuoteDto {
  @Matches(currency) currency!: string;
  @IsDateString() validityDate!: string;
  @IsOptional() @IsString() @MaxLength(1000) paymentTerms?: string;
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
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id',${p.tenantId},true)`;
      return fn(tx);
    });
  }
  private async supplier(tx: TransactionClient, p: AuthenticatedPrincipal) {
    if (p.actorType !== 'supplier_user') throw new ForbiddenException();
    const rows = await tx.$queryRaw<
      { supplier_id: string }[]
    >`SELECT supplier_id FROM supplier_user_memberships WHERE user_id=${p.userId}::uuid AND active`;
    if (rows.length !== 1)
      throw new ForbiddenException('Active persisted supplier membership required');
    return rows[0]!.supplier_id;
  }
  private auditOne(
    tx: TransactionClient,
    p: AuthenticatedPrincipal,
    action: string,
    type: string,
    id: string,
    result: unknown,
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
      },
      tx,
    );
  }
  async suppliers(p: AuthenticatedPrincipal, q: PageDto) {
    return this.tx(
      p,
      (tx) =>
        tx.$queryRaw`SELECT id,supplier_number,legal_name,trading_name,status,qualification_status,country,default_currency,version FROM suppliers WHERE (${q.search ?? null}::text IS NULL OR legal_name ILIKE '%'||${q.search ?? ''}||'%') ORDER BY created_at DESC LIMIT ${q.limit} OFFSET ${(q.page - 1) * q.limit}`,
    );
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
      const s = one(
        await tx.$queryRaw<
          Record<string, unknown>[]
        >`UPDATE suppliers SET legal_name=${d.legalName},trading_name=${d.tradingName ?? null},supplier_type=${d.supplierType},country=${d.country},default_currency=${d.defaultCurrency},primary_email=${d.primaryEmail ?? null},primary_phone=${d.primaryPhone ?? null},version=version+1,updated_at=now() WHERE id=${id}::uuid AND version=${d.version} RETURNING *`,
        true,
      );
      await this.auditOne(tx, p, 'supplier.updated', 'supplier', id, s);
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
      const s = one(
        await tx.$queryRaw<
          Record<string, unknown>[]
        >`UPDATE suppliers SET status=${status}::supplier_status,qualification_status=CASE WHEN ${status}='PENDING_QUALIFICATION' THEN 'PENDING'::qualification_status ELSE qualification_status END,suspension_reason=CASE WHEN ${status}='SUSPENDED' THEN ${d.reason} ELSE suspension_reason END,block_reason=CASE WHEN ${status}='BLOCKED' THEN ${d.reason} ELSE block_reason END,version=version+1 WHERE id=${id}::uuid AND version=${d.version} RETURNING *`,
        true,
      );
      await this.auditOne(tx, p, `supplier.${status.toLowerCase()}`, 'supplier', id, s);
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
    return this.tx(
      p,
      (tx) =>
        tx.$queryRaw`SELECT id,rfq_number,title,status,currency,submission_deadline,version FROM rfqs WHERE (${q.search ?? null}::text IS NULL OR title ILIKE '%'||${q.search ?? ''}||'%') ORDER BY created_at DESC LIMIT ${q.limit} OFFSET ${(q.page - 1) * q.limit}`,
    );
  }
  async invite(p: AuthenticatedPrincipal, id: string, d: InvitationDto) {
    return this.tx(p, async (tx) => {
      const i = one(
        await tx.$queryRaw<
          Record<string, unknown>[]
        >`INSERT INTO rfq_supplier_invitations(tenant_id,rfq_id,supplier_id,supplier_contact_id,expires_at) SELECT ${p.tenantId}::uuid,${id}::uuid,s.id,${d.supplierContactId ?? null}::uuid,${d.expiresAt}::timestamptz FROM suppliers s,rfqs r WHERE s.id=${d.supplierId}::uuid AND r.id=${id}::uuid AND s.status='ACTIVE' AND s.qualification_status='APPROVED' AND r.status IN ('DRAFT','READY_FOR_REVIEW') RETURNING *`,
      );
      await this.auditOne(tx, p, 'rfq.invitation_added', 'rfq_invitation', String(i.id), i);
      return i;
    });
  }
  async publish(p: AuthenticatedPrincipal, id: string, d: CommandDto) {
    return this.tx(p, async (tx) => {
      const r = one(
        await tx.$queryRaw<
          Record<string, unknown>[]
        >`UPDATE rfqs SET status='PUBLISHED',published_at=now(),issue_date=current_date,version=version+1 WHERE id=${id}::uuid AND version=${d.version} AND status IN ('DRAFT','READY_FOR_REVIEW') AND submission_deadline>now() AND EXISTS(SELECT 1 FROM rfq_lines WHERE rfq_id=${id}::uuid) AND EXISTS(SELECT 1 FROM rfq_supplier_invitations WHERE rfq_id=${id}::uuid) RETURNING *`,
        true,
      );
      await tx.$executeRaw`UPDATE rfq_supplier_invitations SET status='SENT',sent_at=now(),version=version+1 WHERE rfq_id=${id}::uuid AND status='DRAFT'`;
      await this.auditOne(tx, p, 'rfq.published', 'rfq', id, r);
      return r;
    });
  }
  async inbox(p: AuthenticatedPrincipal) {
    return this.tx(p, async (tx) => {
      const sid = await this.supplier(tx, p);
      return tx.$queryRaw`SELECT i.id,i.status,i.expires_at,i.version,r.rfq_number,r.title,r.submission_deadline FROM rfq_supplier_invitations i JOIN rfqs r ON r.id=i.rfq_id WHERE i.supplier_id=${sid}::uuid AND i.status NOT IN ('REVOKED','EXPIRED')`;
    });
  }
  async invitation(p: AuthenticatedPrincipal, id: string, d: CommandDto, accept: boolean) {
    return this.tx(p, async (tx) => {
      const sid = await this.supplier(tx, p);
      return one(
        await tx.$queryRaw<
          unknown[]
        >`UPDATE rfq_supplier_invitations i SET status=${accept ? 'ACCEPTED' : 'DECLINED'}::invitation_status,accepted_at=CASE WHEN ${accept} THEN now() END,declined_at=CASE WHEN ${!accept} THEN now() END,version=version+1 FROM suppliers s WHERE i.id=${id}::uuid AND i.supplier_id=${sid}::uuid AND s.id=i.supplier_id AND s.status='ACTIVE' AND i.version=${d.version} AND i.status IN ('SENT','VIEWED') AND i.expires_at>now() RETURNING i.*`,
        true,
      );
    });
  }
  async question(p: AuthenticatedPrincipal, rfqId: string, d: ClarificationDto) {
    return this.tx(p, async (tx) => {
      const sid = await this.supplier(tx, p);
      const t = one(
        await tx.$queryRaw<
          Record<string, unknown>[]
        >`INSERT INTO rfq_clarification_threads(tenant_id,rfq_id,requesting_supplier_id,visibility,subject) SELECT ${p.tenantId}::uuid,r.id,${sid}::uuid,'PRIVATE',${d.subject} FROM rfqs r JOIN rfq_supplier_invitations i ON i.rfq_id=r.id WHERE r.id=${rfqId}::uuid AND i.supplier_id=${sid}::uuid AND i.status='ACCEPTED' AND r.clarification_deadline>now() RETURNING *`,
      );
      await tx.$executeRaw`INSERT INTO rfq_clarification_messages(tenant_id,thread_id,author_id,author_supplier_id,body) VALUES(${p.tenantId}::uuid,${String(t.id)}::uuid,${p.userId}::uuid,${sid}::uuid,${d.body})`;
      await this.auditOne(tx, p, 'rfq.clarification_question', 'clarification', String(t.id), {
        visibility: 'PRIVATE',
      });
      return t;
    });
  }
  async answer(p: AuthenticatedPrincipal, id: string, d: AnswerDto) {
    return this.tx(p, async (tx) => {
      await tx.$executeRaw`UPDATE rfq_clarification_threads SET visibility=${d.visibility}::clarification_visibility WHERE id=${id}::uuid`;
      const m = one(
        await tx.$queryRaw<
          Record<string, unknown>[]
        >`INSERT INTO rfq_clarification_messages(tenant_id,thread_id,author_id,body) VALUES(${p.tenantId}::uuid,${id}::uuid,${p.userId}::uuid,${d.body}) RETURNING *`,
      );
      await this.auditOne(tx, p, 'rfq.clarification_response', 'clarification', id, {
        visibility: d.visibility,
      });
      return m;
    });
  }
  async quote(p: AuthenticatedPrincipal, rfqId: string, d: QuoteDto) {
    return this.tx(p, async (tx) => {
      const sid = await this.supplier(tx, p);
      const q = one(
        await tx.$queryRaw<
          Record<string, unknown>[]
        >`INSERT INTO quotations(tenant_id,quotation_number,rfq_id,supplier_id,currency,validity_date,payment_terms) SELECT ${p.tenantId}::uuid,'QUO-'||substr(gen_random_uuid()::text,1,8),r.id,${sid}::uuid,${d.currency},${d.validityDate}::date,${d.paymentTerms ?? null} FROM rfqs r JOIN rfq_supplier_invitations i ON i.rfq_id=r.id WHERE r.id=${rfqId}::uuid AND i.supplier_id=${sid}::uuid AND i.status='ACCEPTED' AND r.submission_deadline>now() RETURNING *`,
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
        >`INSERT INTO quotation_lines(tenant_id,quotation_id,rfq_line_id,offered_description,quantity,unit_price,discount,tax,compliance_response) SELECT ${p.tenantId}::uuid,q.id,${d.rfqLineId}::uuid,${d.offeredDescription},${d.quantity}::numeric,${d.unitPrice}::numeric,${d.discount}::numeric,${d.tax}::numeric,${d.complianceResponse} FROM quotations q JOIN rfqs r ON r.id=q.rfq_id WHERE q.id=${id}::uuid AND q.supplier_id=${sid}::uuid AND q.status='DRAFT' AND r.submission_deadline>now() RETURNING *`,
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
        >`UPDATE quotations q SET status=${action}::quotation_status,submitted_at=now(),current_revision=current_revision+1,total_amount=x.total,tax_amount=x.tax,version=version+1 FROM (SELECT quotation_id,sum(net_line_amount) total,sum(tax) tax,count(*) n FROM quotation_lines GROUP BY quotation_id)x,rfqs r,suppliers s WHERE q.id=${id}::uuid AND q.id=x.quotation_id AND q.rfq_id=r.id AND q.supplier_id=s.id AND q.supplier_id=${sid}::uuid AND q.version=${d.version} AND q.status=${action === 'REVISED' ? 'SUBMITTED' : 'DRAFT'}::quotation_status AND s.status='ACTIVE' AND r.submission_deadline>now() AND x.n=(SELECT count(*) FROM rfq_lines WHERE rfq_id=r.id) RETURNING q.*`,
        true,
      );
      await tx.$executeRaw`INSERT INTO quotation_revisions(tenant_id,quotation_id,revision_number,snapshot,submitted_by) SELECT ${p.tenantId}::uuid,id,current_revision,jsonb_build_object('header',to_jsonb(q),'lines',(SELECT jsonb_agg(to_jsonb(l)) FROM quotation_lines l WHERE l.quotation_id=q.id)),${p.userId}::uuid FROM quotations q WHERE id=${id}::uuid`;
      await this.auditOne(tx, p, `quotation.${action.toLowerCase()}`, 'quotation', id, {
        supplierId: sid,
        revision: q.current_revision,
      });
      return q;
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
  decline(@Req() r: Request, @Param('id', ParseUUIDPipe) id: string, @Body() d: CommandDto) {
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
}
