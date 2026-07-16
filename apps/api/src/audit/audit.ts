import { Injectable } from '@nestjs/common';
import { prisma, type TransactionClient } from '@procurement/database';
import { redactSensitive, type ActorType } from '@procurement/shared';

export interface AuditEventInput {
  tenantId?: string;
  actorId?: string;
  actorType?: ActorType;
  action: string;
  objectType: string;
  objectId?: string;
  correlationId: string;
  requestContext?: unknown;
  metadata?: unknown;
  priorState?: unknown;
  resultingState?: unknown;
}

@Injectable()
export class AuditService {
  async append(event: AuditEventInput, tx: TransactionClient = prisma): Promise<void> {
    await tx.$executeRaw`
      INSERT INTO audit_events(tenant_id, actor_id, actor_type, action, object_type, object_id, correlation_id, request_context, metadata, prior_state, resulting_state)
      VALUES (
        ${event.tenantId ?? null}::uuid,
        ${event.actorId ?? null}::uuid,
        ${(event.actorType ?? 'system')}::actor_type,
        ${event.action},
        ${event.objectType},
        ${event.objectId ?? null}::uuid,
        ${event.correlationId},
        ${JSON.stringify(redactSensitive(event.requestContext ?? {}))}::jsonb,
        ${JSON.stringify(redactSensitive(event.metadata ?? {}))}::jsonb,
        ${JSON.stringify(redactSensitive(event.priorState ?? null))}::jsonb,
        ${JSON.stringify(redactSensitive(event.resultingState ?? null))}::jsonb
      )`;
  }

  async withAuditTransaction<T>(
    tenantId: string,
    action: (tx: TransactionClient) => Promise<T>,
  ): Promise<T> {
    return prisma.$transaction(async (tx: TransactionClient) => {
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
      return action(tx);
    });
  }
}
