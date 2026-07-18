import { EmptyState, ErrorState, LoadingState } from '@procurement/ui';
import { ApiError } from '../lib/api';
export function AuthState({ loading, error }: { loading: boolean; error: ApiError | null }) {
  if (loading) return <LoadingState label="Loading authenticated session" />;
  if (error?.kind === 'unauthorized')
    return (
      <section className="pp-state pp-state--error" role="alert">
        <strong>Signed out</strong>
        <span>Your session has expired or authentication is required.</span>
        <a href="/login">Sign in</a>
      </section>
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
