import { Injectable } from '@nestjs/common';
import { redactSensitive } from '@procurement/shared';
export interface AuditEventInput { tenantId?: string; actorId?: string; action: string; objectType: string; objectId?: string; correlationId: string; metadata?: unknown; priorState?: unknown; resultingState?: unknown; }
@Injectable()
export class AuditService { readonly events: AuditEventInput[] = []; append(event: AuditEventInput) { this.events.push({ ...event, metadata: redactSensitive(event.metadata), priorState: redactSensitive(event.priorState), resultingState: redactSensitive(event.resultingState) }); } update(): never { throw new Error('Audit events are append-only'); } delete(): never { throw new Error('Audit events are append-only'); } }
