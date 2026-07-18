'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode, useState } from 'react';
import { Button } from '@procurement/ui';
import { useSession } from '../lib/session';
import { AuthState } from './states';
export function AppShell({ children }: { children: ReactNode }) {
  const { session, loading, error, can, logout } = useSession();
  const [collapsed, setCollapsed] = useState(false);
  const path = usePathname();
  if (loading || error || !session)
    return (
      <main className="content">
        <AuthState loading={loading} error={error} />
      </main>
    );
  const nav = [
    { href: '/sourcing', label: 'Sourcing overview', show: can('rfqs.read') },
    { href: '/sourcing/rfqs', label: 'RFQs', show: can('rfqs.read') },
    { href: '/sourcing/rfqs/new', label: 'Create RFQ draft', show: can('rfqs.create') },
    { href: '/sourcing/suppliers', label: 'Suppliers', show: can('suppliers.read') },
  ].filter((n) => n.show);
  return (
    <main className={`shell ${collapsed ? 'shell--collapsed' : ''}`}>
      <aside>
        <h1>Procurement Platform</h1>
        <p>Internal sourcing</p>
        <Button
          aria-label={collapsed ? 'Expand sidebar navigation' : 'Collapse sidebar navigation'}
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? 'Expand' : 'Collapse'}
        </Button>
        <nav aria-label="Internal sourcing navigation">
          {nav.map((n) => (
            <Link
              className={`nav-item ${path === n.href ? 'active' : ''}`}
              key={n.href}
              href={n.href}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <small>
          Tenant {session.tenantId}
          <br />
          User {session.userId}
          <br />
          Role {session.role}
        </small>
        <Button onClick={() => void logout()}>Log out</Button>
      </aside>
      <section className="content">
        <header>
          <p className="eyebrow">
            Home / Internal sourcing{path.replace('/sourcing', '').replaceAll('/', ' / ')}
          </p>
          <h2>Internal sourcing workspace</h2>
        </header>
        {children}
      </section>
    </main>
  );
}
