'use client';
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { ApiError, getSession, logout as requestLogout } from './api';
import type { Permission, Session } from './types';
interface SessionState {
  session: Session | null;
  loading: boolean;
  error: ApiError | null;
  can: (p: Permission) => boolean;
  reload: () => Promise<void>;
  logout: () => Promise<void>;
}
const C = createContext<SessionState | null>(null);
export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  async function reload() {
    setLoading(true);
    setError(null);
    try {
      setSession(await getSession());
    } catch (e) {
      setSession(null);
      if (e instanceof ApiError && e.kind !== 'aborted') setError(e);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void reload();
  }, []);
  const value = useMemo<SessionState>(
    () => ({
      session,
      loading,
      error,
      can: (p) => Boolean(session?.permissions.includes(p)),
      reload,
      logout: async () => {
        await requestLogout();
        setSession(null);
      },
    }),
    [session, loading, error],
  );
  return <C.Provider value={value}>{children}</C.Provider>;
}
export function useSession() {
  const v = useContext(C);
  if (!v) throw new Error('SessionProvider missing');
  return v;
}
