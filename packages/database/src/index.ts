import { PrismaClient } from '@prisma/client';
export const prisma = new PrismaClient();
export async function withTenantContext<T>(tenantId: string, fn: (tx: Omit<PrismaClient, '$connect'|'$disconnect'|'$on'|'$transaction'|'$use'|'$extends'>) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => { await tx.$executeRawUnsafe('SELECT set_config($1, $2, true)', 'app.current_tenant_id', tenantId); return fn(tx as never); });
}
