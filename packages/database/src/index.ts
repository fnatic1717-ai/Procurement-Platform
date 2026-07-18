import { Prisma, PrismaClient } from '@prisma/client';

export { Prisma };

export const prisma = new PrismaClient();

export type TransactionClient = Prisma.TransactionClient;

export async function setTenantContext(tx: TransactionClient, tenantId: string): Promise<void> {
  await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
}

export async function withTenantContext<T>(
  tenantId: string,
  fn: (tx: TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await setTenantContext(tx, tenantId);
    return fn(tx);
  });
}

export async function clearTenantContext(tx: TransactionClient): Promise<void> {
  await tx.$executeRaw`SELECT set_config('app.current_tenant_id', '', true)`;
}
