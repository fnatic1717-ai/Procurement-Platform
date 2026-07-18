'use client';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, ErrorState, Input } from '@procurement/ui';
import { ApiError, login } from '../lib/api';
const text = (value: FormDataEntryValue | null) => (value == null ? '' : String(value));
export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<ApiError | null>(null);
  const developmentLogin = process.env.NEXT_PUBLIC_ENABLE_DEVELOPMENT_LOGIN === 'true';
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const data = new FormData(event.currentTarget);
    try {
      const payload: { tenantId: string; userId?: string } = {
        tenantId: text(data.get('tenantId')),
      };
      const userId = text(data.get('userId'));
      if (developmentLogin && userId) payload.userId = userId;
      await login(payload, text(data.get('authorization')) || undefined);
      router.push('/sourcing');
    } catch (e) {
      if (e instanceof ApiError) setError(e);
    }
  }
  return (
    <main className="content">
      <h1>Sign in</h1>
      <p>
        Authenticate with the configured identity provider, then select one of your active tenant
        memberships.
      </p>
      {error && <ErrorState title={error.kind} description={error.message} />}
      <form className="request-form" onSubmit={submit}>
        <label>
          Tenant membership ID
          <Input name="tenantId" required />
        </label>
        <label>
          Identity-provider bearer token
          <Input name="authorization" type="password" placeholder="Bearer token" />
        </label>
        {developmentLogin && (
          <label>
            Development user ID
            <Input name="userId" />
          </label>
        )}
        <Button>Sign in</Button>
      </form>
    </main>
  );
}
