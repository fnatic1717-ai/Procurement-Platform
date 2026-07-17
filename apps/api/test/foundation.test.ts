import { describe, expect, it } from 'vitest';
import { PolicyService } from '../src/authorization/policy.js';
import { FileAuthorizationService } from '../src/files/files.js';

const principal = {
  userId: '00000000-0000-0000-0000-000000000001',
  tenantId: '10000000-0000-0000-0000-000000000001',
  actorType: 'internal_user' as const,
  permissions: ['files.read', 'tenant.manage'],
  correlationId: 'c1',
  activeMembership: true,
};
const independentApprover = {
  ...principal,
  userId: '00000000-0000-0000-0000-000000000002',
  permissions: ['approval.override'],
};

describe('authorization foundation', () => {
  const policy = new PolicyService({ append: async () => undefined } as never);

  it('denies by default and allows explicit trusted permission', () => {
    expect(policy.can(null, { tenantId: principal.tenantId, permission: 'tenant.manage' })).toBe(
      false,
    );
    expect(
      policy.can(
        { ...principal, activeMembership: false },
        { tenantId: principal.tenantId, permission: 'tenant.manage' },
      ),
    ).toBe(false);
    expect(
      policy.can(principal, {
        tenantId: '20000000-0000-0000-0000-000000000002',
        permission: 'tenant.manage',
      }),
    ).toBe(false);
    expect(
      policy.can(principal, { tenantId: principal.tenantId, permission: 'tenant.manage' }),
    ).toBe(true);
  });

  it('loads permissions from trusted membership fixtures', async () => {
    policy.registerMembership({
      userId: principal.userId,
      tenantId: principal.tenantId,
      status: 'active',
      permissions: ['roles.manage'],
    });
    const loaded = await policy.loadPrincipal(principal.userId, principal.tenantId, 'correlation');
    expect(loaded.permissions).toEqual(['roles.manage']);
    expect(loaded.activeMembership).toBe(true);
  });

  it('enforces segregation of duties with policy, independent approver, permission, audit, and justification', async () => {
    await expect(
      policy.enforceRequesterCannotApproveOwn(principal, principal.userId),
    ).resolves.toBe(false);
    await expect(
      policy.enforceRequesterCannotApproveOwn(principal, principal.userId, {
        tenantId: principal.tenantId,
        policyEnabled: true,
        justification: 'Documented emergency exception',
        independentApprover,
        requiredPermission: 'approval.override',
        action: 'sod.override.requester_approval',
        objectType: 'policy_probe',
        objectId: '30000000-0000-0000-0000-000000000003',
        correlationId: 'c1',
      }),
    ).resolves.toBe(true);
  });
});

describe('file authorization', () => {
  it('requires tenant permission, clean scan state, object scope, and restricted permission when needed', () => {
    const files = new FileAuthorizationService(new PolicyService());
    const file = {
      id: 'f1',
      tenantId: principal.tenantId,
      uploadState: 'clean' as const,
      scanStatus: 'clean' as const,
      classification: 'internal' as const,
      storageKey: 'k',
      uploaderId: principal.userId,
      linkedObjectType: 'foundation',
      linkedObjectId: '40000000-0000-0000-0000-000000000004',
    };
    expect(files.canRead(principal, file, { type: 'foundation', id: file.linkedObjectId })).toBe(
      true,
    );
    expect(
      files.canRead(
        principal,
        { ...file, tenantId: 'other' },
        { type: 'foundation', id: file.linkedObjectId },
      ),
    ).toBe(false);
    expect(
      files.canRead(
        principal,
        { ...file, scanStatus: 'pending' },
        { type: 'foundation', id: file.linkedObjectId },
      ),
    ).toBe(false);
    expect(
      files.canRead(
        principal,
        { ...file, classification: 'restricted' },
        { type: 'foundation', id: file.linkedObjectId },
      ),
    ).toBe(false);
    expect(
      files.canRead(
        { ...principal, permissions: ['files.restricted.read'] },
        { ...file, classification: 'restricted' },
        { type: 'foundation', id: file.linkedObjectId },
      ),
    ).toBe(true);
  });
});
