'use client';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, ErrorState, Input, Select } from '@procurement/ui';
import { ApiError, discoverMemberships, login } from '../lib/api';
import type { TenantMembershipOption } from '../lib/types';
const text = (value: FormDataEntryValue | null) => (value == null ? '' : String(value));
export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const [memberships, setMemberships] = useState<TenantMembershipOption[]>([]);
  const [auth, setAuth] = useState<{ authorization?: string; userId?: string }>({});
  const developmentLogin =
    process.env.NEXT_PUBLIC_ENABLE_DEVELOPMENT_LOGIN === 'true' &&
    process.env.NODE_ENV !== 'production';
  async function discover(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    const data = new FormData(event.currentTarget);
    const authorization = developmentLogin
      ? undefined
      : text(data.get('authorization')) || undefined;
    const userId = developmentLogin ? text(data.get('userId')) : undefined;
    try {
      const result = await discoverMemberships(userId ? { userId } : {}, authorization);
      setAuth({ ...(authorization ? { authorization } : {}), ...(userId ? { userId } : {}) });
      setMemberships(result.memberships);
    } catch (e) {
      if (e instanceof ApiError) setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function select(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    const tenantId = text(new FormData(event.currentTarget).get('tenantId'));
    try {
      await login(
        { tenantId, ...(auth.userId ? { userId: auth.userId } : {}) },
        auth.authorization,
      );
      router.push('/sourcing');
    } catch (e) {
      if (e instanceof ApiError) setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="content">
      <h1>Sign in</h1>
      <p>
        Authenticate with the configured identity provider, then select one active tenant membership
        persisted for your user account.
      </p>
      {error && <ErrorState title={error.kind} description={error.message} />}
      {memberships.length === 0 ? (
        <form className="request-form" onSubmit={discover}>
          {developmentLogin ? (
            <label>
              Development user ID
              <Input name="userId" required />
            </label>
          ) : (
            <p>
              Production sign-in uses the configured SSO identity-provider flow. If SSO is not
              configured, access fails closed.
            </p>
          )}
          <Button disabled={busy}>{busy ? 'Authenticating' : 'Authenticate'}</Button>
        </form>
      ) : (
        <form className="request-form" onSubmit={select}>
          <label>
            Active tenant membership
            <Select name="tenantId" required>
              {memberships.map((m) => (
                <option key={m.id} value={m.tenantId}>
                  {m.tenantName} ({m.tenantSlug})
                </option>
              ))}
            </Select>
          </label>
          <Button disabled={busy}>Continue to procurement workspace</Button>
        </form>
      )}
    </main>
  );
}
