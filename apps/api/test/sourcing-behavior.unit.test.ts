import { ConflictException, ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const tenantId = '10000000-0000-0000-0000-000000000001';
const userId = '20000000-0000-0000-0000-000000000001';
const supplierUserId = '20000000-0000-0000-0000-000000000002';
const rfqId = '30000000-0000-0000-0000-000000000001';
const invitationId = '40000000-0000-0000-0000-000000000001';
const quoteId = '50000000-0000-0000-0000-000000000001';
const lineId = '60000000-0000-0000-0000-000000000001';
const rfqLineId = '70000000-0000-0000-0000-000000000001';
const supplierId = '80000000-0000-0000-0000-000000000001';

const principal = {
  userId,
  tenantId,
  actorType: 'internal_user' as const,
  permissions: ['rfqs.publish'],
  correlationId: 'corr',
  activeMembership: true,
};
const supplierPrincipal = {
  userId: supplierUserId,
  tenantId,
  actorType: 'supplier_user' as const,
  permissions: ['supplier_portal.invitations.respond'],
  correlationId: 'corr-supplier',
  activeMembership: true,
};

type SupplierStatus = 'ACTIVE' | 'SUSPENDED' | 'BLOCKED' | 'INACTIVE' | 'REJECTED';
type QualificationStatus = 'APPROVED' | 'PENDING' | 'REJECTED' | 'EXPIRED';

type State = {
  rfq: Record<string, unknown>;
  invitations: Record<string, unknown>[];
  supplier: { id: string; status: SupplierStatus; qualification_status: QualificationStatus };
  hasLine: boolean;
  quote: Record<string, unknown>;
  quoteLine: Record<string, unknown>;
  idempotency: Map<string, { payload_hash: string; response: unknown; completed: boolean }>;
  audits: Record<string, unknown>[];
};

let state: State;

function resetState(overrides: Partial<State> = {}) {
  state = {
    rfq: {
      id: rfqId,
      tenant_id: tenantId,
      status: 'DRAFT',
      version: 1,
      clarification_deadline: new Date(Date.now() + 86_400_000).toISOString(),
      submission_deadline: new Date(Date.now() + 172_800_000).toISOString(),
    },
    invitations: [
      { id: invitationId, rfq_id: rfqId, supplier_id: supplierId, status: 'DRAFT', version: 1 },
    ],
    supplier: { id: supplierId, status: 'ACTIVE', qualification_status: 'APPROVED' },
    hasLine: true,
    quote: {
      id: quoteId,
      supplier_id: supplierId,
      status: 'DRAFT',
      version: 1,
      current_revision: 0,
    },
    quoteLine: { id: lineId, quotation_id: quoteId, version: 1 },
    idempotency: new Map(),
    audits: [],
    ...overrides,
  };
}

function insertKey(args: unknown[]) {
  return `${args[1]}:${args[2]}:${args[3]}:${args[4]}`;
}

function selectKey(args: unknown[]) {
  return `${args[0]}:${args[1]}:${args[2]}:${args[3]}`;
}

function eligibleDraftInvitations() {
  return state.invitations.filter(
    (i) =>
      i.rfq_id === rfqId &&
      i.status === 'DRAFT' &&
      state.supplier.status === 'ACTIVE' &&
      state.supplier.qualification_status === 'APPROVED',
  );
}

const tx = {
  $executeRaw(strings: TemplateStringsArray, ...args: unknown[]) {
    const sql = strings.join(' ');
    if (sql.includes('INSERT INTO sourcing_idempotency')) {
      const k = insertKey(args);
      if (state.idempotency.has(k)) return 0;
      state.idempotency.set(k, { payload_hash: String(args[5]), response: null, completed: false });
      return 1;
    }
    if (sql.includes('UPDATE sourcing_idempotency SET response')) {
      for (const value of state.idempotency.values()) {
        if (!value.completed) {
          value.response = JSON.parse(String(args[0]));
          value.completed = true;
        }
      }
      return 1;
    }
    if (sql.includes("UPDATE rfq_supplier_invitations SET status='SENT'")) {
      const ids = args[0] as string[];
      for (const invitation of state.invitations)
        if (ids.includes(String(invitation.id)) && invitation.status === 'DRAFT')
          invitation.status = 'SENT';
      return 1;
    }
    if (sql.includes("UPDATE rfq_supplier_invitations SET status='REVOKED'")) {
      const ids = args[0] as string[];
      for (const invitation of state.invitations)
        if (ids.includes(String(invitation.id)) && invitation.status === 'DRAFT')
          invitation.status = 'REVOKED';
      return 1;
    }
    return 1;
  },
  $queryRaw(strings: TemplateStringsArray, ...args: unknown[]) {
    const sql = strings.join(' ');
    if (sql.includes('SELECT payload_hash,response,completed FROM sourcing_idempotency')) {
      return [state.idempotency.get(selectKey(args))].filter(Boolean);
    }
    if (sql.includes('SELECT * FROM rfqs WHERE id=')) return [{ ...state.rfq }];
    if (sql.includes('SELECT id FROM rfq_lines WHERE rfq_id=')) {
      return state.hasLine ? [{ id: rfqLineId }] : [];
    }
    if (sql.includes('SELECT i.id,(s.status=')) {
      return state.invitations
        .filter((invitation) => invitation.rfq_id === rfqId && invitation.status === 'DRAFT')
        .map((invitation) => ({
          id: String(invitation.id),
          eligible:
            state.supplier.status === 'ACTIVE' &&
            state.supplier.qualification_status === 'APPROVED',
        }));
    }
    if (sql.includes('SELECT EXISTS(SELECT 1 FROM rfq_lines')) {
      return [{ ready: state.hasLine && eligibleDraftInvitations().length > 0 }];
    }
    if (sql.includes('published_at=CASE WHEN')) {
      if (Number(state.rfq.version) !== Number(args.at(-1))) return [];
      state.rfq = { ...state.rfq, status: args[0], version: Number(state.rfq.version) + 1 };
      return [{ ...state.rfq }];
    }
    if (sql.includes("UPDATE rfqs SET status='QUOTATION_CLOSED'")) {
      if (Number(state.rfq.version) !== Number(args[1])) return [];
      state.rfq = {
        ...state.rfq,
        status: 'QUOTATION_CLOSED',
        version: Number(state.rfq.version) + 1,
      };
      return [{ ...state.rfq }];
    }
    if (sql.includes('cancelled_at=CASE WHEN')) {
      if (Number(state.rfq.version) !== Number(args.at(-1))) return [];
      state.rfq = { ...state.rfq, status: args[0], version: Number(state.rfq.version) + 1 };
      return [{ ...state.rfq }];
    }
    if (sql.includes('SELECT m.supplier_id FROM supplier_user_memberships')) {
      return state.supplier.status === 'ACTIVE' &&
        state.supplier.qualification_status === 'APPROVED'
        ? [{ supplier_id: supplierId }]
        : [];
    }
    if (sql.includes('SELECT i.id,i.status,i.expires_at')) return state.invitations;
    if (sql.includes('SELECT i.* FROM rfq_supplier_invitations'))
      return [{ ...state.invitations[0] }];
    if (sql.includes('UPDATE rfq_supplier_invitations SET status=CASE'))
      return [{ ...state.invitations[0] }];
    if (sql.includes('UPDATE rfq_supplier_invitations i SET status=')) {
      state.invitations[0]!.status = args[0];
      return [{ ...state.invitations[0] }];
    }
    if (sql.includes('INSERT INTO rfq_clarification_threads')) return [{ id: 'thread-1' }];
    if (sql.includes('INSERT INTO quotations')) return [{ ...state.quote }];
    if (sql.includes('INSERT INTO quotation_lines')) return [{ ...state.quoteLine }];
    if (sql.includes('UPDATE quotations q SET status=(CASE'))
      return [{ ...state.quote, status: 'SUBMITTED', version: 2, current_revision: 1 }];
    if (sql.includes("UPDATE quotations q SET status='DRAFT'"))
      return [{ ...state.quote, status: 'DRAFT', version: 2 }];
    if (sql.includes('UPDATE quotations SET currency')) return [{ ...state.quote, version: 2 }];
    if (sql.includes('UPDATE quotation_lines l SET')) return [{ ...state.quoteLine, version: 2 }];
    if (sql.includes('DELETE FROM quotation_lines')) return [{ ...state.quoteLine }];
    return [];
  },
};

vi.mock(
  '@procurement/database',
  () => ({
    prisma: { $transaction: (fn: (client: typeof tx) => Promise<unknown>) => fn(tx) },
  }),
  { virtual: true },
);

const { SourcingService } = await import('../src/sourcing/sourcing.js');

function service() {
  return new SourcingService({
    append: async (event: Record<string, unknown>) => {
      state.audits.push(event);
    },
  } as never);
}

describe('RFQ publication service unit behavior', () => {
  beforeEach(() => resetState());

  it('rejects DRAFT to PUBLISHED and allows DRAFT to READY_FOR_REVIEW only with a line and eligible DRAFT invitation', async () => {
    await expect(
      service().publish(principal, rfqId, { version: 1, idempotencyKey: 'publish-draft' }),
    ).rejects.toBeInstanceOf(ConflictException);
    const ready = await service().transitionRfq(principal, rfqId, {
      status: 'READY_FOR_REVIEW',
      version: 1,
      idempotencyKey: 'ready',
    });
    expect(ready).toMatchObject({ status: 'READY_FOR_REVIEW', version: 2 });
    resetState({ hasLine: false });
    await expect(
      service().transitionRfq(principal, rfqId, {
        status: 'READY_FOR_REVIEW',
        version: 1,
        idempotencyKey: 'missing-line',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('publishes READY_FOR_REVIEW with eligible DRAFT invitations, sends eligible invitations, and is idempotent', async () => {
    resetState({ rfq: { ...state.rfq, status: 'READY_FOR_REVIEW' } });
    const first = await service().publish(principal, rfqId, { version: 1, idempotencyKey: 'pub' });
    const duplicate = await service().publish(principal, rfqId, {
      version: 1,
      idempotencyKey: 'pub',
    });
    expect(first).toEqual(duplicate);
    expect(state.rfq.status).toBe('PUBLISHED');
    expect(state.invitations[0]!.status).toBe('SENT');
    await expect(
      service().publish(principal, rfqId, {
        version: 1,
        idempotencyKey: 'pub',
        extra: true,
      } as never),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects publication with stale versions or only revoked/ineligible invitations and leaves READY_FOR_REVIEW', async () => {
    resetState({ rfq: { ...state.rfq, status: 'READY_FOR_REVIEW', version: 3 } });
    await expect(
      service().publish(principal, rfqId, { version: 1, idempotencyKey: 'stale' }),
    ).rejects.toBeInstanceOf(ConflictException);

    resetState({
      rfq: { ...state.rfq, status: 'READY_FOR_REVIEW' },
      invitations: [
        { id: invitationId, rfq_id: rfqId, supplier_id: supplierId, status: 'REVOKED' },
      ],
    });
    await expect(
      service().publish(principal, rfqId, { version: 1, idempotencyKey: 'revoked-only' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(state.rfq.status).toBe('READY_FOR_REVIEW');

    resetState({
      rfq: { ...state.rfq, status: 'READY_FOR_REVIEW' },
      supplier: { id: supplierId, status: 'BLOCKED', qualification_status: 'APPROVED' },
    });
    await expect(
      service().publish(principal, rfqId, { version: 1, idempotencyKey: 'blocked-only' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(state.rfq.status).toBe('READY_FOR_REVIEW');
  });
});

describe('RFQ close service unit behavior', () => {
  beforeEach(() => resetState());

  it('closes from QUOTATION_CLOSED and rejects stale versions', async () => {
    resetState({ rfq: { ...state.rfq, status: 'QUOTATION_CLOSED', version: 7 } });
    const closed = await service().terminal(
      principal,
      rfqId,
      {
        version: 7,
        idempotencyKey: 'close-closed',
        reason: 'Complete',
      },
      'CLOSED',
    );
    expect(closed).toMatchObject({ status: 'CLOSED', version: 8 });

    resetState({ rfq: { ...state.rfq, status: 'QUOTATION_CLOSED', version: 7 } });
    await expect(
      service().terminal(
        principal,
        rfqId,
        { version: 6, idempotencyKey: 'stale-close', reason: 'x' },
        'CLOSED',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('closes QUOTATION_OPEN after deadline using returned intermediate version and persists both audit records', async () => {
    resetState({
      rfq: {
        ...state.rfq,
        status: 'QUOTATION_OPEN',
        submission_deadline: new Date(Date.now() - 1_000).toISOString(),
      },
    });
    const closed = await service().terminal(
      principal,
      rfqId,
      {
        version: 1,
        idempotencyKey: 'after-deadline',
        reason: 'Deadline passed',
      },
      'CLOSED',
    );
    expect(closed).toMatchObject({ status: 'CLOSED', version: 3 });
    expect(state.audits.map((a) => a.action)).toEqual([
      'rfq.transition.quotation_closed',
      'rfq.closed',
    ]);
  });

  it('rejects closing before deadline and returns one persisted result for duplicate idempotent close', async () => {
    resetState({ rfq: { ...state.rfq, status: 'QUOTATION_OPEN' } });
    await expect(
      service().terminal(
        principal,
        rfqId,
        { version: 1, idempotencyKey: 'too-early', reason: 'x' },
        'CLOSED',
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    resetState({ rfq: { ...state.rfq, status: 'QUOTATION_CLOSED' } });
    const first = await service().terminal(
      principal,
      rfqId,
      { version: 1, idempotencyKey: 'dup-close', reason: 'x' },
      'CLOSED',
    );
    const second = await service().terminal(
      principal,
      rfqId,
      { version: 1, idempotencyKey: 'dup-close', reason: 'x' },
      'CLOSED',
    );
    expect(second).toEqual(first);
    expect(state.rfq.version).toBe(2);
  });
});

describe('supplier eligibility service unit behavior', () => {
  const actions = [
    ['inbox', () => service().inbox(supplierPrincipal)],
    ['detail', () => service().invitationDetail(supplierPrincipal, invitationId)],
    [
      'accept',
      () =>
        service().invitation(
          supplierPrincipal,
          invitationId,
          { version: 1, idempotencyKey: 'a' },
          true,
        ),
    ],
    [
      'decline',
      () =>
        service().invitation(
          supplierPrincipal,
          invitationId,
          { version: 1, idempotencyKey: 'd', reason: 'No bid' },
          false,
        ),
    ],
    [
      'clarification',
      () => service().question(supplierPrincipal, rfqId, { subject: 'Question', body: 'Body' }),
    ],
    [
      'quote draft',
      () =>
        service().quote(supplierPrincipal, rfqId, { currency: 'USD', validityDate: '2030-01-01' }),
    ],
    [
      'quote update',
      () =>
        service().updateQuote(supplierPrincipal, quoteId, {
          version: 1,
          currency: 'USD',
          validityDate: '2030-01-01',
        }),
    ],
    [
      'line create',
      () =>
        service().quoteLine(supplierPrincipal, quoteId, {
          rfqLineId,
          offeredDescription: 'Offer',
          quantity: '1',
          unitPrice: '1',
          discount: '0',
          tax: '0',
          complianceResponse: 'Compliant',
        }),
    ],
    [
      'line update',
      () =>
        service().updateQuoteLine(supplierPrincipal, quoteId, lineId, {
          version: 1,
          rfqLineId,
          offeredDescription: 'Offer',
          quantity: '1',
          unitPrice: '1',
          discount: '0',
          tax: '0',
          complianceResponse: 'Compliant',
        }),
    ],
    ['line delete', () => service().removeQuoteLine(supplierPrincipal, quoteId, lineId, 1)],
    [
      'revision start',
      () =>
        service().startRevision(supplierPrincipal, quoteId, { version: 1, idempotencyKey: 'rev' }),
    ],
    [
      'submit',
      () =>
        service().quoteAction(
          supplierPrincipal,
          quoteId,
          { version: 1, idempotencyKey: 'submit' },
          'SUBMITTED',
        ),
    ],
  ] as const;

  it('allows ACTIVE and APPROVED supplier users with persisted membership to perform allowed portal actions', async () => {
    resetState();
    await expect(service().inbox(supplierPrincipal)).resolves.toBeDefined();
  });

  for (const status of ['SUSPENDED', 'BLOCKED', 'INACTIVE', 'REJECTED'] as SupplierStatus[]) {
    it(`denies ${status} suppliers from interactive portal actions`, async () => {
      for (const [name, action] of actions) {
        resetState({ supplier: { id: supplierId, status, qualification_status: 'APPROVED' } });
        await expect(action(), name).rejects.toBeInstanceOf(ForbiddenException);
      }
    });
  }

  it('denies non-APPROVED suppliers from interactive portal actions', async () => {
    for (const qualification_status of [
      'PENDING',
      'REJECTED',
      'EXPIRED',
    ] as QualificationStatus[]) {
      resetState({ supplier: { id: supplierId, status: 'ACTIVE', qualification_status } });
      await expect(service().inbox(supplierPrincipal), qualification_status).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    }
  });
});
