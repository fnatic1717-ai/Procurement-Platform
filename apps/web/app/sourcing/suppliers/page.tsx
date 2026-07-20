'use client';
import { useEffect, useState } from 'react';
import { ErrorState, LoadingState, Table } from '@procurement/ui';
import { ApiError, listSuppliers } from '../../lib/api';
import { PermissionGate } from '../../components/permission-gate';
import { useSession } from '../../lib/session';
import type { PageResult, Supplier } from '../../lib/types';
export default function SuppliersPage() {
  const { can } = useSession();
  const [data, setData] = useState<PageResult<Supplier> | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  useEffect(() => {
    if (!can('suppliers.read')) return;
    const c = new AbortController();
    listSuppliers(new URLSearchParams('limit=25'), c.signal)
      .then(setData)
      .catch((e) => e instanceof ApiError && e.kind !== 'aborted' && setError(e));
    return () => c.abort();
  }, [can]);
  if (!can('suppliers.read'))
    return (
      <PermissionGate permission="suppliers.read">
        <></>
      </PermissionGate>
    );
  if (error) return <ErrorState title={error.kind} description={error.message} />;
  if (!data) return <LoadingState label="Loading real suppliers" />;
  if (data.total === 0) return <p>No real persisted suppliers were returned by the API.</p>;
  return (
    <PermissionGate permission="suppliers.read">
      <Table>
        <thead>
          <tr>
            <th>Supplier</th>
            <th>Status</th>
            <th>Qualification</th>
            <th>Country</th>
            <th>Currency</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((s) => (
            <tr key={s.id}>
              <td>{s.legal_name}</td>
              <td>{s.status}</td>
              <td>{s.qualification_status}</td>
              <td>{s.country}</td>
              <td>{s.default_currency}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </PermissionGate>
  );
}
