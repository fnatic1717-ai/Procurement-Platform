export const PLATFORM_PERMISSIONS = [
  'tenant.manage',
  'tenant.members.manage',
  'roles.manage',
  'audit.read',
  'files.read',
  'files.write',
] as const;
export type PlatformPermission = (typeof PLATFORM_PERMISSIONS)[number];
export type ActorType = 'internal_user' | 'supplier_user' | 'platform_admin' | 'system';
export type FileUploadState = 'pending' | 'scanning' | 'clean' | 'rejected' | 'deleted';
export interface AuthenticatedPrincipal { userId: string; tenantId: string; actorType: ActorType; permissions: string[]; correlationId: string; }
export function hasPermission(principal: AuthenticatedPrincipal, permission: string): boolean { return principal.permissions.includes(permission); }
export function redactSensitive(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k,v]) => /token|secret|password|cookie|authorization|signedUrl/i.test(k) ? [k,'[REDACTED]'] : [k, typeof v === 'object' ? redactSensitive(v) : v]));
}
