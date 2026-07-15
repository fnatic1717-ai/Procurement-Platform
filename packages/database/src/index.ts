import { Prisma, PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

export type TransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

export async function setTenantContext(tx: TransactionClient, tenantId: string): Promise<void> {
  await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
}

export async function withTenantContext<T>(
  tenantId: string,
  fn: (tx: TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await setTenantContext(tx as TransactionClient, tenantId);
    return fn(tx as TransactionClient);
  });
}

export async function clearTenantContext(tx: TransactionClient): Promise<void> {
  await tx.$executeRaw(Prisma.sql`SELECT set_config('app.current_tenant_id', '', true)`);
}
