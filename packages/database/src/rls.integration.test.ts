import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
describe('RLS migration',()=>{ const sql=readFileSync(new URL('../prisma/migrations/0001_platform_foundation/migration.sql', import.meta.url),'utf8'); it('enables forced RLS and denies absent tenant by equality policy',()=>{ expect(sql).toContain('FORCE ROW LEVEL SECURITY'); expect(sql).toContain('tenant_id = current_tenant_id()'); }); it('makes audit events append-only',()=>{ expect(sql).toContain('audit_events_no_update'); expect(sql).toContain('audit_events are append-only'); }); });
