'use client';
import { ReactNode } from 'react';
import { ErrorState, LoadingState } from '@procurement/ui';
import { useSession } from '../lib/session';
import type { Permission } from '../lib/types';
export function PermissionGate({
  permission,
  children,
}: {
  permission: Permission;
  children: ReactNode;
}) {
  const { loading, session, can } = useSession();
  if (loading) return <LoadingState label="Checking session permissions" />;
  if (!session)
    return (
      <ErrorState
        title="unauthorized"
        description="Sign in to access this procurement workspace."
      />
    );
  if (!can(permission))
    return (
      <ErrorState
        title="forbidden"
        description="You do not have permission to access this procurement workspace."
      />
    );
  return <>{children}</>;
}
