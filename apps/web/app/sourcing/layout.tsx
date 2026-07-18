'use client';
import { ReactNode } from 'react';
import { SessionProvider } from '../lib/session';
import { AppShell } from '../components/app-shell';
export default function SourcingLayout({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <AppShell>{children}</AppShell>
    </SessionProvider>
  );
}
