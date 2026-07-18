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
export type Permission =
  | 'rfqs.read'
  | 'rfqs.create'
  | 'rfqs.update_draft'
  | 'rfqs.publish'
  | 'rfqs.extend_deadline'
  | 'rfqs.cancel'
  | 'rfqs.close'
  | 'rfq_invitations.manage'
  | 'rfq_clarifications.manage'
  | 'quotations.read'
  | 'quotations.read_commercial'
  | 'suppliers.read';
export type Session = {
  tenantId: string;
  userId: string;
  role: string;
  permissions: string[];
  token: string;
};
export type ApiErrorKind =
  'unauthorized' | 'forbidden' | 'not_found' | 'conflict' | 'validation' | 'server' | 'network';
export class ApiError extends Error {
  constructor(
    public kind: ApiErrorKind,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}
export function normalizeError(status: number, body: unknown): ApiError {
  const record = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const message = String(record.message ?? 'The operation could not be completed.');
  if (status === 401)
    return new ApiError(
      'unauthorized',
      'Your session has expired or authentication is required.',
      body,
    );
  if (status === 403)
    return new ApiError('forbidden', 'You do not have permission to perform this action.', body);
  if (status === 404) return new ApiError('not_found', 'The requested record was not found.', body);
  if (status === 409)
    return new ApiError(
      'conflict',
      'This record changed before your action completed. Refresh and try again.',
      body,
    );
  if (status === 400) return new ApiError('validation', message, body);
  return new ApiError('server', message, body);
}
export const can = (session: Pick<Session, 'permissions'> | null, permission: Permission) =>
  Boolean(session?.permissions.includes(permission));
export function visibleModules(session: Pick<Session, 'permissions'> | null) {
  return [
    { key: 'overview', label: 'Sourcing overview', permission: 'rfqs.read' as Permission },
    { key: 'rfqs', label: 'RFQs', permission: 'rfqs.read' as Permission },
    { key: 'suppliers', label: 'Suppliers', permission: 'suppliers.read' as Permission },
    { key: 'activity', label: 'Activity and audit', permission: 'rfqs.read' as Permission },
  ].filter((m) => can(session, m.permission));
}
export function validTransitionActions(
  status: RfqStatus,
  session: Pick<Session, 'permissions'> | null,
) {
  if (!can(session, 'rfqs.publish')) return [];
  const map: Partial<Record<RfqStatus, RfqStatus[]>> = {
    DRAFT: ['READY_FOR_REVIEW'],
    READY_FOR_REVIEW: ['PUBLISHED'],
    PUBLISHED: ['CLARIFICATION_OPEN', 'QUOTATION_OPEN'],
    CLARIFICATION_OPEN: ['QUOTATION_OPEN'],
    QUOTATION_OPEN: ['QUOTATION_CLOSED'],
  };
  return map[status] ?? [];
}
export function validateRfqDraft(input: {
  title: string;
  currency: string;
  clarificationDeadline: string;
  submissionDeadline: string;
  requiredBy: string;
  deliveryLocation: string;
  procurementCategory: string;
}) {
  const errors: Record<string, string> = {};
  if (!input.title.trim()) errors.title = 'Title is required.';
  if (!/^[A-Z]{3}$/.test(input.currency))
    errors.currency = 'Currency must be a three-letter ISO code.';
  if (!input.procurementCategory.trim())
    errors.procurementCategory = 'Procurement category is required.';
  if (!input.deliveryLocation.trim()) errors.deliveryLocation = 'Delivery location is required.';
  if (!input.clarificationDeadline)
    errors.clarificationDeadline = 'Clarification deadline is required.';
  if (!input.submissionDeadline) errors.submissionDeadline = 'Quotation deadline is required.';
  if (
    input.clarificationDeadline &&
    input.submissionDeadline &&
    new Date(input.clarificationDeadline) > new Date(input.submissionDeadline)
  )
    errors.submissionDeadline = 'Quotation deadline must be after the clarification deadline.';
  if (!input.requiredBy) errors.requiredBy = 'Required-by date is required.';
  return errors;
}
export function pageParams(search: string) {
  const params = new URLSearchParams(search);
  return {
    page: Number(params.get('page') || '1'),
    limit: Number(params.get('limit') || '25'),
    search: params.get('search') || '',
    status: params.get('status') || '',
    from: params.get('from') || '',
    to: params.get('to') || '',
    category: params.get('category') || '',
  };
}
export const idem = () => crypto.randomUUID();
