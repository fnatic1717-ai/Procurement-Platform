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
  'purchase_requests.cancel',
  'approvals.read_assigned',
  'approvals.act',
  'procurement_intake.read',
  'procurement_intake.assign',
  'approval_policies.manage',
  'suppliers.create',
  'suppliers.read',
  'suppliers.update',
  'suppliers.qualify',
  'suppliers.activate',
  'suppliers.suspend',
  'suppliers.block',
  'supplier_users.manage',
  'supplier_compliance.manage',
  'rfqs.create',
  'rfqs.read',
  'rfqs.update_draft',
  'rfqs.publish',
  'rfqs.extend_deadline',
  'rfqs.cancel',
  'rfqs.close',
  'rfq_invitations.manage',
  'rfq_clarifications.manage',
  'quotations.read',
  'quotations.read_commercial',
  'supplier_portal.rfqs.read_invited',
  'supplier_portal.invitations.respond',
  'supplier_portal.clarifications.create',
  'supplier_portal.quotations.create',
  'supplier_portal.quotations.submit',
  'supplier_portal.quotations.revise',
  'supplier_portal.quotations.withdraw',
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
  DRAFT: ['SUBMITTED', 'CANCELLED'],
  SUBMITTED: ['PENDING_APPROVAL', 'WITHDRAWN', 'CANCELLED'],
  PENDING_APPROVAL: ['RETURNED_TO_REQUESTER', 'REJECTED', 'APPROVED', 'WITHDRAWN', 'CANCELLED'],
  RETURNED_TO_REQUESTER: ['SUBMITTED', 'WITHDRAWN', 'CANCELLED'],
  REJECTED: [],
  APPROVED: ['IN_PROCUREMENT_REVIEW', 'CANCELLED'],
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

export const PHASE_2B_PERMISSIONS = [
  'suppliers.create',
  'suppliers.read',
  'suppliers.update',
  'suppliers.qualify',
  'suppliers.activate',
  'suppliers.suspend',
  'suppliers.block',
  'supplier_users.manage',
  'supplier_compliance.manage',
  'rfqs.create',
  'rfqs.read',
  'rfqs.update_draft',
  'rfqs.publish',
  'rfqs.extend_deadline',
  'rfqs.cancel',
  'rfqs.close',
  'rfq_invitations.manage',
  'rfq_clarifications.manage',
  'quotations.read',
  'quotations.read_commercial',
  'supplier_portal.rfqs.read_invited',
  'supplier_portal.invitations.respond',
  'supplier_portal.clarifications.create',
  'supplier_portal.quotations.create',
  'supplier_portal.quotations.submit',
  'supplier_portal.quotations.revise',
  'supplier_portal.quotations.withdraw',
] as const;

export const SUPPLIER_STATUSES = [
  'DRAFT',
  'PENDING_QUALIFICATION',
  'ACTIVE',
  'SUSPENDED',
  'BLOCKED',
  'INACTIVE',
  'REJECTED',
] as const;
export type SupplierStatus = (typeof SUPPLIER_STATUSES)[number];
export const QUALIFICATION_STATUSES = [
  'NOT_STARTED',
  'PENDING',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
  'EXPIRED',
] as const;
export type QualificationStatus = (typeof QUALIFICATION_STATUSES)[number];
export const RFQ_STATUSES = [
  'DRAFT',
  'READY_FOR_REVIEW',
  'PUBLISHED',
  'CLARIFICATION_OPEN',
  'QUOTATION_OPEN',
  'QUOTATION_CLOSED',
  'CANCELLED',
  'CLOSED',
] as const;
export type RfqStatus = (typeof RFQ_STATUSES)[number];
export const INVITATION_STATUSES = [
  'DRAFT',
  'SENT',
  'VIEWED',
  'ACCEPTED',
  'DECLINED',
  'EXPIRED',
  'REVOKED',
] as const;
export const QUOTATION_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'REVISED',
  'WITHDRAWN',
  'LATE_REJECTED',
  'LOCKED',
] as const;
export type QuotationStatus = (typeof QUOTATION_STATUSES)[number];

const supplierTransitions: Readonly<Record<SupplierStatus, readonly SupplierStatus[]>> = {
  DRAFT: ['PENDING_QUALIFICATION'],
  PENDING_QUALIFICATION: ['ACTIVE', 'REJECTED'],
  ACTIVE: ['SUSPENDED', 'BLOCKED', 'INACTIVE'],
  SUSPENDED: ['ACTIVE', 'BLOCKED', 'INACTIVE'],
  BLOCKED: ['ACTIVE', 'INACTIVE'],
  INACTIVE: ['ACTIVE'],
  REJECTED: ['PENDING_QUALIFICATION'],
};
const rfqTransitions: Readonly<Record<RfqStatus, readonly RfqStatus[]>> = {
  DRAFT: ['READY_FOR_REVIEW', 'CANCELLED'],
  READY_FOR_REVIEW: ['DRAFT', 'PUBLISHED', 'CANCELLED'],
  PUBLISHED: ['CLARIFICATION_OPEN', 'QUOTATION_OPEN', 'CANCELLED'],
  CLARIFICATION_OPEN: ['QUOTATION_OPEN', 'QUOTATION_CLOSED', 'CANCELLED'],
  QUOTATION_OPEN: ['QUOTATION_CLOSED', 'CANCELLED'],
  QUOTATION_CLOSED: ['CLOSED'],
  CANCELLED: [],
  CLOSED: [],
};
export function assertSupplierTransition(from: SupplierStatus, to: SupplierStatus): void {
  if (!supplierTransitions[from].includes(to))
    throw new Error(`Illegal supplier transition: ${from} -> ${to}`);
}
export function assertRfqTransition(from: RfqStatus, to: RfqStatus): void {
  if (!rfqTransitions[from].includes(to))
    throw new Error(`Illegal RFQ transition: ${from} -> ${to}`);
}
export function assertSupplierEligibleForInvitation(
  status: SupplierStatus,
  qualification: QualificationStatus,
): void {
  if (status !== 'ACTIVE' || qualification !== 'APPROVED')
    throw new Error('Supplier must be active and qualified');
}
export function assertBeforeDeadline(deadline: Date, now = new Date()): void {
  if (now.getTime() > deadline.getTime()) throw new Error('Submission deadline has passed');
}
/** Decimal-safe multiplication of non-negative decimal strings, returned at four decimal places. */
export function calculateNetLineAmount(
  quantity: string,
  unitPrice: string,
  discount: string,
  tax: string,
): string {
  const scale = 10_000n;
  const parse = (value: string) => {
    if (!/^\d+(\.\d{1,4})?$/.test(value)) throw new Error('Invalid monetary value');
    const [whole, fraction = ''] = value.split('.');
    return BigInt(whole!) * scale + BigInt(fraction.padEnd(4, '0'));
  };
  const q = parse(quantity),
    price = parse(unitPrice),
    d = parse(discount),
    t = parse(tax);
  const result = (q * price) / scale - d + t;
  if (result < 0n) throw new Error('Net line amount cannot be negative');
  return `${result / scale}.${(result % scale).toString().padStart(4, '0')}`;
}

export function sourcingPayloadHash(payload: unknown): string {
  const canonical = (value: unknown): string => {
    if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
    if (value && typeof value === 'object')
      return `{${Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, nested]) => `${JSON.stringify(key)}:${canonical(nested)}`)
        .join(',')}}`;
    return JSON.stringify(value);
  };
  // FNV-1a is used only as a deterministic preimage here; persistence uses SHA-256 in the API.
  let hash = 2166136261;
  for (const character of canonical(payload)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
