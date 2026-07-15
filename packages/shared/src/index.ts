export const PLATFORM_PERMISSIONS = [
  'tenant.manage',
  'tenant.members.manage',
  'roles.manage',
  'audit.read',
  'files.read',
  'files.restricted.read',
  'files.write',
  'platform.tenants.manage',
] as const;

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
      if (/token|secret|password|cookie|authorization|signedUrl|session/i.test(key)) return [key, '[REDACTED]'];
      return [key, typeof nested === 'object' ? redactSensitive(nested) : nested];
    }),
  );
}
