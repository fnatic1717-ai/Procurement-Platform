import type {
  AuditEvent,
  ClarificationThread,
  PageResult,
  Quotation,
  RfqDetail,
  RfqListItem,
  RfqOverview,
  Session,
  Supplier,
} from './types';
export type ApiErrorKind =
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'validation'
  | 'server'
  | 'network'
  | 'aborted';
export class ApiError extends Error {
  constructor(
    public kind: ApiErrorKind,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}
export function normalizeError(status: number, body: unknown) {
  const r = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const msg = String(r.message ?? 'The operation could not be completed.');
  if (status === 401)
    return new ApiError('unauthorized', 'Your session has expired. Sign in again.', body);
  if (status === 403)
    return new ApiError('forbidden', 'You do not have permission to perform this action.', body);
  if (status === 404) return new ApiError('not_found', 'The requested record was not found.', body);
  if (status === 409)
    return new ApiError(
      'conflict',
      'This record changed or the idempotency payload conflicts. Refresh and try again.',
      body,
    );
  if (status === 400 || status === 422) return new ApiError('validation', msg, body);
  return new ApiError('server', msg, body);
}
export async function api<T>(path: string, init?: RequestInit, signal?: AbortSignal): Promise<T> {
  try {
    const req: RequestInit = {
      credentials: 'include',
      ...init,
      headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
    };
    if (signal) req.signal = signal;
    const res = await fetch(`/api/v1${path}`, req);
    const body = await res
      .json()
      .catch(() => ({ message: 'The server returned an invalid response.' }));
    if (!res.ok) throw normalizeError(res.status, body);
    return body as T;
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError')
      throw new ApiError('aborted', 'Request was cancelled.');
    if (e instanceof ApiError) throw e;
    throw new ApiError('network', 'Network request failed.', e);
  }
}
export const getSession = (signal?: AbortSignal) =>
  api<Session>('/auth/session', undefined, signal);
export const logout = () => api<{ loggedOut: boolean }>('/auth/logout', { method: 'POST' });
export const listRfqs = (q: URLSearchParams, signal?: AbortSignal) =>
  api<PageResult<RfqListItem>>(`/rfqs?${q}`, undefined, signal);
export const getOverview = (signal?: AbortSignal) =>
  api<RfqOverview>('/rfqs/overview', undefined, signal);
export const createRfq = (body: unknown) =>
  api<RfqDetail>('/rfqs', { method: 'POST', body: JSON.stringify(body) });
export const getRfq = (id: string, signal?: AbortSignal) =>
  api<RfqDetail>(`/rfqs/${id}`, undefined, signal);
export const updateRfq = (id: string, body: unknown) =>
  api<RfqDetail>(`/rfqs/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
export const addLine = (id: string, body: unknown) =>
  api(`/rfqs/${id}/lines`, { method: 'POST', body: JSON.stringify(body) });
export const updateLine = (rfqId: string, id: string, body: unknown) =>
  api(`/rfqs/${rfqId}/lines/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
export const deleteLine = (rfqId: string, id: string, version: number) =>
  api(`/rfqs/${rfqId}/lines/${id}?version=${version}`, { method: 'DELETE' });
export const listSuppliers = (q: URLSearchParams, signal?: AbortSignal) =>
  api<PageResult<Supplier>>(`/suppliers?${q}`, undefined, signal);
export const getSupplier = (id: string, signal?: AbortSignal) =>
  api<Supplier>(`/suppliers/${id}`, undefined, signal);
export const inviteSupplier = (rfqId: string, body: unknown) =>
  api(`/rfqs/${rfqId}/invitations`, { method: 'POST', body: JSON.stringify(body) });
export const revokeInvitation = (rfqId: string, id: string, body: unknown) =>
  api(`/rfqs/${rfqId}/invitations/${id}/revoke`, { method: 'POST', body: JSON.stringify(body) });
export const transitionRfq = (id: string, body: unknown) =>
  api(`/rfqs/${id}/transition`, { method: 'POST', body: JSON.stringify(body) });
export const closeRfq = (id: string, body: unknown) =>
  api(`/rfqs/${id}/close`, { method: 'POST', body: JSON.stringify(body) });
export const cancelRfq = (id: string, body: unknown) =>
  api(`/rfqs/${id}/cancel`, { method: 'POST', body: JSON.stringify(body) });
export const extendDeadline = (id: string, body: unknown) =>
  api(`/rfqs/${id}/deadline-extension`, { method: 'POST', body: JSON.stringify(body) });
export const listClarifications = (id: string, signal?: AbortSignal) =>
  api<ClarificationThread[]>(`/rfqs/${id}/clarifications`, undefined, signal);
export const answerClarification = (id: string, body: unknown) =>
  api(`/rfq-clarifications/${id}/responses`, { method: 'POST', body: JSON.stringify(body) });
export const closeClarification = (id: string, body: unknown) =>
  api(`/rfq-clarifications/${id}/close`, { method: 'POST', body: JSON.stringify(body) });
export const listQuotations = (id: string, signal?: AbortSignal) =>
  api<PageResult<Quotation>>(`/rfqs/${id}/quotations`, undefined, signal);
export const listAudit = (id: string, signal?: AbortSignal) =>
  api<PageResult<AuditEvent>>(`/rfqs/${id}/audit`, undefined, signal);
