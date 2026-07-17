import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const databaseUrl = process.env.DATABASE_URL;
if (process.env.CI && !databaseUrl)
  throw new Error('DATABASE_URL is required for PostgreSQL integration tests in CI');
const runWhenDatabase = databaseUrl ? describe : describe.skip;

runWhenDatabase('PostgreSQL tenant isolation', () => {
  const suffix = randomUUID().replaceAll('-', '');
  const databaseName = `procurement_test_${suffix}`;
  const applicationRole = `procurement_rls_${suffix}`;
  const adminUrl = new URL(databaseUrl ?? 'postgresql://unused:unused@localhost/unused');
  const testUrl = new URL(databaseUrl ?? 'postgresql://unused:unused@localhost/unused');
  testUrl.pathname = `/${databaseName}`;
  let client: Client;
  let tenantA = '';
  let tenantB = '';
  let userA = '';
  let userB = '';
  let roleA = '';
  let fileA = '';
  let fileB = '';

  beforeAll(async () => {
    adminUrl.pathname = '/postgres';
    const admin = new Client({ connectionString: adminUrl.toString() });
    await admin.connect();
    await admin.query(`CREATE ROLE ${applicationRole} NOLOGIN`);
    await admin.query(`CREATE DATABASE ${databaseName}`);
    await admin.end();

    client = new Client({ connectionString: testUrl.toString() });
    await client.connect();
    await client.query(
      readFileSync(
        new URL('../prisma/migrations/0001_platform_foundation/migration.sql', import.meta.url),
        'utf8',
      ),
    );
    await client.query(
      readFileSync(
        new URL(
          '../prisma/migrations/0002_phase_2a_purchase_requests/migration.sql',
          import.meta.url,
        ),
        'utf8',
      ),
    );

    const seeded = await client.query(`
      INSERT INTO tenants(name, slug)
      VALUES ('Tenant A', 'tenant-a'), ('Tenant B', 'tenant-b')
      RETURNING id, slug;
    `);
    tenantA = seeded.rows.find((row) => row.slug === 'tenant-a').id;
    tenantB = seeded.rows.find((row) => row.slug === 'tenant-b').id;
    userA = (
      await client.query(
        "INSERT INTO users(email, display_name) VALUES ('a@example.com', 'User A') RETURNING id",
      )
    ).rows[0].id;
    userB = (
      await client.query(
        "INSERT INTO users(email, display_name) VALUES ('b@example.com', 'User B') RETURNING id",
      )
    ).rows[0].id;
    await client.query(
      'INSERT INTO tenant_memberships(tenant_id, user_id) VALUES ($1, $2), ($3, $4)',
      [tenantA, userA, tenantB, userB],
    );
    roleA = (
      await client.query(
        "INSERT INTO roles(tenant_id, code, name) VALUES ($1, 'admin', 'Admin') RETURNING id",
        [tenantA],
      )
    ).rows[0].id;
    fileA = (
      await client.query(
        "INSERT INTO file_objects(tenant_id, storage_key, filename, mime_type, size_bytes, checksum_sha256, uploader_id, classification, upload_state, scan_status) VALUES ($1, 'a/file', 'a.txt', 'text/plain', 1, repeat('a',64), $2, 'internal', 'clean', 'clean') RETURNING id",
        [tenantA, userA],
      )
    ).rows[0].id;
    fileB = (
      await client.query(
        "INSERT INTO file_objects(tenant_id, storage_key, filename, mime_type, size_bytes, checksum_sha256, uploader_id, classification, upload_state, scan_status) VALUES ($1, 'b/file', 'b.txt', 'text/plain', 1, repeat('b',64), $2, 'internal', 'clean', 'clean') RETURNING id",
        [tenantB, userB],
      )
    ).rows[0].id;

    await client.query(`GRANT USAGE ON SCHEMA public TO ${applicationRole}`);
    await client.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${applicationRole}`,
    );
    await client.query(
      `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${applicationRole}`,
    );
    await client.query(`GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO ${applicationRole}`);
    await client.query(`SET ROLE ${applicationRole}`);
  });

  afterAll(async () => {
    if (client) {
      await client.query('RESET ROLE').catch(() => undefined);
      await client.end().catch(() => undefined);
    }

    adminUrl.pathname = '/postgres';
    const admin = new Client({ connectionString: adminUrl.toString() });
    await admin.connect();
    await admin.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1', [
      databaseName,
    ]);
    await admin.query(`DROP DATABASE IF EXISTS ${databaseName}`);
    await admin.query(`DROP ROLE IF EXISTS ${applicationRole}`);
    await admin.end();
  });

  async function asTenant<T>(tenantId: string | null, fn: () => Promise<T>): Promise<T> {
    await client.query('BEGIN');
    if (tenantId !== null) {
      await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
    }
    try {
      const result = await fn();
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }

  it('allows Tenant A to read and write its own records', async () => {
    const rows = await asTenant(tenantA, async () =>
      client.query('SELECT id FROM file_objects WHERE tenant_id = $1', [tenantA]),
    );
    expect(rows.rowCount).toBe(1);
    await expect(
      asTenant(tenantA, async () =>
        client.query(
          "INSERT INTO locations(tenant_id, code, name) VALUES ($1, 'HQ', 'Headquarters')",
          [tenantA],
        ),
      ),
    ).resolves.toBeDefined();
  });

  it('prevents cross-tenant reads, inserts, updates, and deletes', async () => {
    const rows = await asTenant(tenantA, async () =>
      client.query('SELECT id FROM file_objects WHERE id = $1', [fileB]),
    );
    expect(rows.rowCount).toBe(0);
    await expect(
      asTenant(tenantA, async () =>
        client.query("INSERT INTO locations(tenant_id, code, name) VALUES ($1, 'B', 'Tenant B')", [
          tenantB,
        ]),
      ),
    ).rejects.toThrow();
    const updated = await asTenant(tenantA, async () =>
      client.query('UPDATE file_objects SET filename = $1 WHERE id = $2', ['blocked.txt', fileB]),
    );
    expect(updated.rowCount).toBe(0);
    const deleted = await asTenant(tenantA, async () =>
      client.query('DELETE FROM file_objects WHERE id = $1', [fileB]),
    );
    expect(deleted.rowCount).toBe(0);
  });

  it('denies queries without tenant context and with invalid context', async () => {
    const noContext = await asTenant(null, async () => client.query('SELECT id FROM file_objects'));
    expect(noContext.rowCount).toBe(0);
    await expect(
      asTenant('not-a-uuid', async () => client.query('SELECT id FROM file_objects')),
    ).rejects.toThrow();
  });

  it('prevents audit event update and delete', async () => {
    const auditId = (
      await asTenant(tenantA, async () =>
        client.query(
          "INSERT INTO audit_events(tenant_id, action, object_type, correlation_id) VALUES ($1, 'test', 'object', 'c1') RETURNING id",
          [tenantA],
        ),
      )
    ).rows[0].id;
    await expect(
      asTenant(tenantA, async () =>
        client.query('UPDATE audit_events SET action = $1 WHERE id = $2', ['tamper', auditId]),
      ),
    ).rejects.toThrow('append-only');
    await expect(
      asTenant(tenantA, async () =>
        client.query('DELETE FROM audit_events WHERE id = $1', [auditId]),
      ),
    ).rejects.toThrow('append-only');
  });

  it('prevents cross-tenant file links and role assignments', async () => {
    await expect(
      asTenant(tenantA, async () =>
        client.query(
          "INSERT INTO file_links(tenant_id, file_object_id, object_type, object_id) VALUES ($1, $2, 'foundation', gen_random_uuid())",
          [tenantA, fileB],
        ),
      ),
    ).rejects.toThrow();
    await expect(
      asTenant(tenantB, async () =>
        client.query(
          'INSERT INTO user_role_assignments(tenant_id, user_id, role_id) VALUES ($1, $2, $3)',
          [tenantB, userB, roleA],
        ),
      ),
    ).rejects.toThrow();
    await expect(
      asTenant(tenantA, async () =>
        client.query(
          "INSERT INTO file_links(tenant_id, file_object_id, object_type, object_id) VALUES ($1, $2, 'foundation', gen_random_uuid())",
          [tenantA, fileA],
        ),
      ),
    ).resolves.toBeDefined();
  });

  it('isolates Phase 2A purchase requests and tenant numbering', async () => {
    const request = await asTenant(tenantA, async () =>
      client.query(
        `INSERT INTO purchase_requests(tenant_id, request_number, requester_id, legal_entity, department, cost_center, delivery_location, procurement_category, title, business_justification, currency, required_by)
         VALUES ($1, next_tenant_request_number($1), $2, 'LE', 'Operations', 'CC', 'HQ', 'Facilities', 'Tenant A request', 'Operational requirement', 'USD', current_date + 7) RETURNING id, request_number`,
        [tenantA, userA],
      ),
    );
    expect(request.rows[0].request_number).toBe('PR-000001');
    const item = await asTenant(tenantA, async () =>
      client.query(
        `INSERT INTO purchase_request_items(tenant_id,purchase_request_id,description,item_type,quantity,unit_of_measure,estimated_unit_price,category,specifications,required_by,delivery_location)
         VALUES ($1,$2,'Secure laptop','goods',2.5,'EA',100.1250,'IT','Managed endpoint',current_date + 7,'HQ') RETURNING estimated_line_total`,
        [tenantA, request.rows[0].id],
      ),
    );
    expect(item.rows[0].estimated_line_total).toBe('250.3125');
    const hidden = await asTenant(tenantB, async () =>
      client.query('SELECT id FROM purchase_requests WHERE id = $1', [request.rows[0].id]),
    );
    expect(hidden.rowCount).toBe(0);
    await expect(
      asTenant(tenantB, async () =>
        client.query('UPDATE purchase_requests SET title = $1 WHERE id = $2', [
          'Cross tenant change',
          request.rows[0].id,
        ]),
      ),
    ).resolves.toMatchObject({ rowCount: 0 });
    await expect(
      asTenant(tenantA, async () =>
        client.query(
          `INSERT INTO buyer_assignments(tenant_id, intake_record_id, buyer_id, assigned_by, reason)
           VALUES ($1, gen_random_uuid(), $2, $2, 'invalid cross-object assignment')`,
          [tenantA, userB],
        ),
      ),
    ).rejects.toThrow();
  });

  it('forces RLS on every Phase 2A tenant-owned table', async () => {
    const tables = [
      'tenant_number_sequences',
      'purchase_requests',
      'purchase_request_items',
      'approval_policies',
      'approval_policy_steps',
      'purchase_request_approval_instances',
      'purchase_request_approval_steps',
      'procurement_intake_records',
      'buyer_assignments',
      'idempotency_records',
    ];
    const result = await client.query(
      `SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = ANY($1)`,
      [tables],
    );
    expect(result.rowCount).toBe(tables.length);
    expect(result.rows.every((row) => row.relrowsecurity && row.relforcerowsecurity)).toBe(true);
  });
});
