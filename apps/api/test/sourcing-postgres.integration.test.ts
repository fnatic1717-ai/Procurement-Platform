import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const { Client } = createRequire(import.meta.url)(
  '../../../packages/database/node_modules/pg/lib/index.js',
) as { Client: new (config: { connectionString: string }) => PgClient };
type PgClient = {
  connect(): Promise<void>;
  end(): Promise<void>;
  query(
    sql: string,
    values?: unknown[],
  ): Promise<{ rows: Record<string, any>[]; rowCount: number | null }>;
};

const databaseUrl = process.env.DATABASE_URL;
if (process.env.CI && !databaseUrl)
  throw new Error('DATABASE_URL is required for sourcing PostgreSQL integration tests in CI');
const runWhenDatabase = databaseUrl ? describe : describe.skip;

runWhenDatabase('sourcing PostgreSQL integration', () => {
  const suffix = randomUUID().replaceAll('-', '');
  const databaseName = `procurement_sourcing_${suffix}`;
  const applicationRole = `procurement_sourcing_rls_${suffix}`;
  const adminUrl = new URL(databaseUrl ?? 'postgresql://unused:unused@localhost/unused');
  const testUrl = new URL(databaseUrl ?? 'postgresql://unused:unused@localhost/unused');
  testUrl.pathname = `/${databaseName}`;
  let client: PgClient;
  let service: import('../src/sourcing/sourcing.js').SourcingService;
  let tenantId = '';
  let buyerId = '';
  let supplierUserId = '';

  const principal = () => ({
    userId: buyerId,
    tenantId,
    actorType: 'internal_user' as const,
    permissions: ['rfqs.publish'],
    correlationId: randomUUID(),
    activeMembership: true,
  });
  const supplierPrincipal = () => ({
    userId: supplierUserId,
    tenantId,
    actorType: 'supplier_user' as const,
    permissions: ['supplier_portal.invitations.respond'],
    correlationId: randomUUID(),
    activeMembership: true,
  });

  beforeAll(async () => {
    adminUrl.pathname = '/postgres';
    const admin = new Client({ connectionString: adminUrl.toString() });
    await admin.connect();
    await admin.query(`CREATE ROLE ${applicationRole} NOLOGIN`);
    await admin.query(`CREATE DATABASE ${databaseName}`);
    await admin.end();

    process.env.DATABASE_URL = testUrl.toString();
    client = new Client({ connectionString: testUrl.toString() });
    await client.connect();
    for (const migration of [
      '../prisma/migrations/0001_platform_foundation/migration.sql',
      '../prisma/migrations/0002_phase_2a_purchase_requests/migration.sql',
      '../prisma/migrations/0003_phase_2b_supplier_rfq/migration.sql',
    ]) {
      await client.query(readFileSync(new URL(migration, import.meta.url), 'utf8'));
    }
    await client.query(`GRANT USAGE ON SCHEMA public TO ${applicationRole}`);
    await client.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${applicationRole}`,
    );
    await client.query(
      `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${applicationRole}`,
    );

    tenantId = (
      await client.query(
        "INSERT INTO tenants(name,slug) VALUES('Sourcing Tenant',$1) RETURNING id",
        [`sourcing-${suffix}`],
      )
    ).rows[0]!.id;
    buyerId = (
      await client.query("INSERT INTO users(email,display_name) VALUES($1,'Buyer') RETURNING id", [
        `buyer-${suffix}@example.com`,
      ])
    ).rows[0]!.id;
    supplierUserId = (
      await client.query(
        "INSERT INTO users(email,display_name) VALUES($1,'Supplier User') RETURNING id",
        [`supplier-${suffix}@example.com`],
      )
    ).rows[0]!.id;
    await client.query(
      "INSERT INTO tenant_memberships(tenant_id,user_id,status,member_type) VALUES($1,$2,'active','internal'),($1,$3,'active','supplier')",
      [tenantId, buyerId, supplierUserId],
    );

    const imported = await import('../src/sourcing/sourcing.js');
    service = new imported.SourcingService(
      new (await import('../src/audit/audit.js')).AuditService(),
    );
  });

  afterAll(async () => {
    await client?.end().catch(() => undefined);
    await service?.['constructor'];
    adminUrl.pathname = '/postgres';
    const admin = new Client({ connectionString: adminUrl.toString() });
    await admin.connect();
    await admin.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1', [
      databaseName,
    ]);
    await admin.query(`DROP DATABASE IF EXISTS ${databaseName}`);
    await admin.query(`DROP ROLE IF EXISTS ${applicationRole}`);
    await admin.end();
  });

  async function seedSupplier(
    status: 'ACTIVE' | 'SUSPENDED' | 'BLOCKED' | 'INACTIVE' | 'REJECTED' = 'ACTIVE',
    qualification: 'APPROVED' | 'PENDING' | 'REJECTED' | 'EXPIRED' = 'APPROVED',
  ) {
    const supplierId = (
      await client.query(
        "INSERT INTO suppliers(tenant_id,supplier_number,legal_name,supplier_type,country,default_currency,status,qualification_status) VALUES($1,$2,'Supplier','company','US','USD',$3,$4) RETURNING id",
        [tenantId, `SUP-${randomUUID().slice(0, 8)}`, status, qualification],
      )
    ).rows[0]!.id;
    await client.query(
      'INSERT INTO supplier_user_memberships(tenant_id,supplier_id,user_id,active) VALUES($1,$2,$3,true)',
      [tenantId, supplierId, supplierUserId],
    );
    return supplierId;
  }

  async function seedRfq(status = 'DRAFT', supplierStatus = 'ACTIVE', inviteStatus = 'DRAFT') {
    const supplierId = await seedSupplier(supplierStatus as 'ACTIVE');
    const rfq = (
      await client.query(
        "INSERT INTO rfqs(tenant_id,rfq_number,title,procurement_category,buyer_id,currency,clarification_deadline,submission_deadline,required_by,delivery_location,status) VALUES($1,$2,'RFQ','category',$3,'USD',now()+interval '1 day',now()+interval '2 days',current_date+7,'Dock',$4) RETURNING *",
        [tenantId, `RFQ-${randomUUID().slice(0, 8)}`, buyerId, status],
      )
    ).rows[0]!;
    const line = (
      await client.query(
        "INSERT INTO rfq_lines(tenant_id,rfq_id,description,item_type,quantity,unit_of_measure,specifications,required_by,delivery_location,category,line_sequence) VALUES($1,$2,'Line','goods',1,'EA','Specs',current_date+7,'Dock','category',1) RETURNING id",
        [tenantId, rfq.id],
      )
    ).rows[0]!;
    const invitation = (
      await client.query(
        "INSERT INTO rfq_supplier_invitations(tenant_id,rfq_id,supplier_id,status,expires_at) VALUES($1,$2,$3,$4,now()+interval '3 days') RETURNING id",
        [tenantId, rfq.id, supplierId, inviteStatus],
      )
    ).rows[0]!;
    return { rfq, lineId: line.id, invitationId: invitation.id, supplierId };
  }

  async function rfqState(id: string) {
    return (await client.query('SELECT status,version FROM rfqs WHERE id=$1', [id])).rows[0]!;
  }

  it('publishes only from READY_FOR_REVIEW with locked eligible DRAFT invitations', async () => {
    const draft = await seedRfq();
    await expect(
      service.publish(principal(), draft.rfq.id, { version: 1, idempotencyKey: randomUUID() }),
    ).rejects.toThrow();

    const ready = await seedRfq();
    await expect(
      service.transitionRfq(principal(), ready.rfq.id, {
        status: 'READY_FOR_REVIEW',
        version: 1,
        idempotencyKey: randomUUID(),
      }),
    ).resolves.toMatchObject({ status: 'READY_FOR_REVIEW' });
    await service.publish(principal(), ready.rfq.id, {
      version: 2,
      idempotencyKey: 'publish-once',
    });
    expect((await rfqState(ready.rfq.id)).status).toBe('PUBLISHED');
    expect(
      (
        await client.query('SELECT status FROM rfq_supplier_invitations WHERE id=$1', [
          ready.invitationId,
        ])
      ).rows[0]!.status,
    ).toBe('SENT');
    await expect(
      service.publish(principal(), ready.rfq.id, { version: 2, idempotencyKey: 'publish-once' }),
    ).resolves.toMatchObject({ status: 'PUBLISHED' });
    await expect(
      service.publish(principal(), ready.rfq.id, { version: 3, idempotencyKey: 'publish-once' }),
    ).rejects.toThrow();
  });

  it('revokes locked ineligible DRAFT invitations and rolls back failed publication unchanged', async () => {
    const mixed = await seedRfq('READY_FOR_REVIEW');
    const badSupplier = await seedSupplier('BLOCKED', 'APPROVED');
    const badInvitation = (
      await client.query(
        "INSERT INTO rfq_supplier_invitations(tenant_id,rfq_id,supplier_id,status,expires_at) VALUES($1,$2,$3,'DRAFT',now()+interval '3 days') RETURNING id",
        [tenantId, mixed.rfq.id, badSupplier],
      )
    ).rows[0]!.id;
    await service.publish(principal(), mixed.rfq.id, { version: 1, idempotencyKey: randomUUID() });
    expect(
      (
        await client.query('SELECT id,status FROM rfq_supplier_invitations WHERE rfq_id=$1', [
          mixed.rfq.id,
        ])
      ).rows,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: mixed.invitationId, status: 'SENT' }),
        expect.objectContaining({ id: badInvitation, status: 'REVOKED' }),
      ]),
    );

    const failed = await seedRfq('READY_FOR_REVIEW', 'BLOCKED');
    await expect(
      service.publish(principal(), failed.rfq.id, { version: 1, idempotencyKey: randomUUID() }),
    ).rejects.toThrow();
    expect(await rfqState(failed.rfq.id)).toMatchObject({ status: 'READY_FOR_REVIEW', version: 1 });
    expect(
      (
        await client.query('SELECT status FROM rfq_supplier_invitations WHERE id=$1', [
          failed.invitationId,
        ])
      ).rows[0]!.status,
    ).toBe('DRAFT');
  });

  it('does not publish when concurrent ineligibility leaves zero eligible SENT invitations', async () => {
    const seeded = await seedRfq('READY_FOR_REVIEW');
    await client.query("UPDATE suppliers SET status='SUSPENDED' WHERE id=$1", [seeded.supplierId]);
    await expect(
      service.publish(principal(), seeded.rfq.id, { version: 1, idempotencyKey: randomUUID() }),
    ).rejects.toThrow();
    expect(await rfqState(seeded.rfq.id)).toMatchObject({ status: 'READY_FOR_REVIEW' });
    expect(
      (
        await client.query(
          "SELECT count(*)::int count FROM rfq_supplier_invitations WHERE rfq_id=$1 AND status='SENT'",
          [seeded.rfq.id],
        )
      ).rows[0]!.count,
    ).toBe(0);
  });

  it('closes with correct versions and persists two-step audit evidence', async () => {
    const closed = await seedRfq('QUOTATION_CLOSED');
    await expect(
      service.terminal(
        principal(),
        closed.rfq.id,
        {
          version: 1,
          idempotencyKey: 'close-once',
          reason: 'Complete',
        },
        'CLOSED',
      ),
    ).resolves.toMatchObject({ status: 'CLOSED' });
    await expect(
      service.terminal(
        principal(),
        closed.rfq.id,
        {
          version: 1,
          idempotencyKey: 'close-once',
          reason: 'Complete',
        },
        'CLOSED',
      ),
    ).resolves.toMatchObject({ status: 'CLOSED' });

    const open = await seedRfq('QUOTATION_OPEN');
    await client.query(
      "UPDATE rfqs SET submission_deadline=now()-interval '1 minute' WHERE id=$1",
      [open.rfq.id],
    );
    await service.terminal(
      principal(),
      open.rfq.id,
      {
        version: 1,
        idempotencyKey: randomUUID(),
        reason: 'Deadline passed',
      },
      'CLOSED',
    );
    expect(await rfqState(open.rfq.id)).toMatchObject({ status: 'CLOSED', version: 3 });
    expect(
      (
        await client.query(
          'SELECT action FROM audit_events WHERE object_id=$1 ORDER BY created_at',
          [open.rfq.id],
        )
      ).rows.map((row) => String(row.action)),
    ).toEqual(['rfq.transition.quotation_closed', 'rfq.closed']);

    const early = await seedRfq('QUOTATION_OPEN');
    await expect(
      service.terminal(
        principal(),
        early.rfq.id,
        { version: 1, idempotencyKey: randomUUID(), reason: 'x' },
        'CLOSED',
      ),
    ).rejects.toThrow();
    await expect(
      service.terminal(
        principal(),
        open.rfq.id,
        { version: 1, idempotencyKey: randomUUID(), reason: 'x' },
        'CLOSED',
      ),
    ).rejects.toThrow();
  });

  it('enforces supplier eligibility from persisted membership and RLS cross-supplier isolation', async () => {
    const active = await seedRfq('QUOTATION_OPEN');
    await client.query("UPDATE rfq_supplier_invitations SET status='ACCEPTED' WHERE id=$1", [
      active.invitationId,
    ]);
    await expect(service.inbox(supplierPrincipal())).resolves.toBeDefined();
    for (const status of ['SUSPENDED', 'BLOCKED', 'INACTIVE', 'REJECTED'] as const) {
      await client.query('UPDATE suppliers SET status=$1 WHERE id=$2', [status, active.supplierId]);
      await expect(service.inbox(supplierPrincipal())).rejects.toThrow();
    }
    await client.query(
      "UPDATE suppliers SET status='ACTIVE', qualification_status='EXPIRED' WHERE id=$1",
      [active.supplierId],
    );
    await expect(service.inbox(supplierPrincipal())).rejects.toThrow();

    await client.query('BEGIN');
    await client.query(`SET LOCAL ROLE ${applicationRole}`);
    await client.query("SELECT set_config('app.current_tenant_id',$1,true)", [tenantId]);
    await client.query("SELECT set_config('app.actor_type','supplier_user',true)");
    await client.query("SELECT set_config('app.current_supplier_id',$1,true)", [active.supplierId]);
    const visible = await client.query(
      'SELECT id FROM rfq_supplier_invitations WHERE supplier_id<>$1',
      [active.supplierId],
    );
    await client.query('ROLLBACK');
    expect(visible.rowCount).toBe(0);
  });
});
