import { EmptyState, ErrorState, LoadingState } from '@procurement/ui';
import { ApiError } from '../lib/api';
export function AuthState({ loading, error }: { loading: boolean; error: ApiError | null }) {
  if (loading) return <LoadingState label="Loading authenticated session" />;
  if (error?.kind === 'unauthorized')
    return (
      <ErrorState
        title="Unauthorized"
        description="Your session has expired or authentication is required."
      />
    );
  if (error?.kind === 'forbidden')
    return (
      <ErrorState
        title="Forbidden"
        description="Your authenticated user is not authorized for this workspace."
      />
    );
  if (error) return <ErrorState title="Server error" description={error.message} />;
  return null;
}
export const NoRecords = ({ title }: { title: string }) => (
  <EmptyState title={title} description="No real persisted records were returned by the API." />
);
