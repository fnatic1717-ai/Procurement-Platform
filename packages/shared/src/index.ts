export const PLATFORM_PERMISSIONS = [
  'tenant.manage',
  'tenant.members.manage',
  'roles.manage',
  'audit.read',
  'files.read',
  'files.restricted.read',
  'files.write',
  'platform.tenants.manage',
  'purchase_requests.create',
  'purchase_requests.read_own',
  'purchase_requests.read_all',
  'purchase_requests.update_own_draft',
  'purchase_requests.submit',
  'purchase_requests.withdraw',
  'approvals.read_assigned',
  'approvals.act',
  'procurement_intake.read',
  'procurement_intake.assign',
  'approval_policies.manage',
] as const;

export const PURCHASE_REQUEST_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'PENDING_APPROVAL',
  'RETURNED_TO_REQUESTER',
  'REJECTED',
  'APPROVED',
  'WITHDRAWN',
  'CANCELLED',
  'IN_PROCUREMENT_REVIEW',
] as const;
export type PurchaseRequestStatus = (typeof PURCHASE_REQUEST_STATUSES)[number];

const transitions: Readonly<Record<PurchaseRequestStatus, readonly PurchaseRequestStatus[]>> = {
  DRAFT: ['SUBMITTED'],
  SUBMITTED: ['PENDING_APPROVAL', 'WITHDRAWN'],
  PENDING_APPROVAL: ['RETURNED_TO_REQUESTER', 'REJECTED', 'APPROVED', 'WITHDRAWN'],
  RETURNED_TO_REQUESTER: ['SUBMITTED', 'WITHDRAWN'],
  REJECTED: [],
  APPROVED: ['IN_PROCUREMENT_REVIEW'],
  WITHDRAWN: [],
  CANCELLED: [],
  IN_PROCUREMENT_REVIEW: [],
};

export function assertPurchaseRequestTransition(
  from: PurchaseRequestStatus,
  to: PurchaseRequestStatus,
): void {
  if (!transitions[from].includes(to))
    throw new Error(`Illegal purchase request transition: ${from} -> ${to}`);
}

export function isPurchaseRequestEditable(status: PurchaseRequestStatus): boolean {
  return status === 'DRAFT' || status === 'RETURNED_TO_REQUESTER';
}

export type PlatformPermission = (typeof PLATFORM_PERMISSIONS)[number];
export type ActorType = 'internal_user' | 'supplier_user' | 'platform_admin' | 'system';
export type FileUploadState = 'pending' | 'scanning' | 'clean' | 'rejected' | 'deleted';
export type FileScanStatus = 'pending' | 'scanning' | 'clean' | 'infected' | 'failed';
export type FileClassification = 'internal' | 'supplier_visible' | 'restricted';

export interface AuthenticatedPrincipal {
  userId: string;
  tenantId: string;
  actorType: ActorType;
  permissions: string[];
  correlationId: string;
  activeMembership: boolean;
}

export function hasPermission(principal: AuthenticatedPrincipal, permission: string): boolean {
  return principal.activeMembership && principal.permissions.includes(permission);
}

export function redactSensitive(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((entry) => redactSensitive(entry));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, nested]) => {
      if (/token|secret|password|cookie|authorization|signedUrl|session/i.test(key))
        return [key, '[REDACTED]'];
      return [key, typeof nested === 'object' ? redactSensitive(nested) : nested];
    }),
  );
}
