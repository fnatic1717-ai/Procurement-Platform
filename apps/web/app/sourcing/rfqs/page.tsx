'use client';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  ErrorState,
  Input,
  LoadingState,
  Select,
  StatusBadge,
  Table,
} from '@procurement/ui';
import { ApiError, listRfqs, updateRfqListQuery } from '../../lib/api';
import type { PageResult, RfqListItem } from '../../lib/types';
import { NoRecords } from '../../components/states';
const tone = (s: string) =>
  s.includes('CANCEL')
    ? 'danger'
    : s.includes('DRAFT') || s.includes('REVIEW')
      ? 'warning'
      : s.includes('CLOSED')
        ? 'success'
        : 'info';
export default function RfqListPage() {
  const sp = useSearchParams();
  const router = useRouter();
  const [data, setData] = useState<PageResult<RfqListItem> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const params = useMemo(() => new URLSearchParams(sp.toString()), [sp]);
  useEffect(() => {
    const c = new AbortController();
    setBusy(true);
    setError(null);
    listRfqs(params, c.signal)
      .then(setData)
      .catch((e) => {
        if (e instanceof ApiError && e.kind !== 'aborted') setError(e);
      })
      .finally(() => setBusy(false));
    return () => c.abort();
  }, [params]);
  function update(k: string, v: string) {
    const n = updateRfqListQuery(params, k, v);
    router.push(`/sourcing/rfqs?${n}`);
  }
  if (error) return <ErrorState title={error.kind} description={error.message} />;
  return (
    <>
      <div className="toolbar">
        <label>
          Search
          <Input
            defaultValue={params.get('search') ?? ''}
            onBlur={(e) => update('search', e.target.value)}
          />
        </label>
        <label>
          Status
          <Select
            value={params.get('status') ?? ''}
            onChange={(e) => update('status', e.target.value)}
          >
            <option value="">All statuses</option>
            {[
              'DRAFT',
              'READY_FOR_REVIEW',
              'PUBLISHED',
              'CLARIFICATION_OPEN',
              'QUOTATION_OPEN',
              'QUOTATION_CLOSED',
              'CANCELLED',
              'CLOSED',
            ].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
        </label>
        <label>
          Category
          <Input
            defaultValue={params.get('procurementCategory') ?? ''}
            onBlur={(e) => update('procurementCategory', e.target.value)}
          />
        </label>
        <label>
          Created from
          <Input
            type="date"
            defaultValue={(params.get('createdFrom') ?? '').slice(0, 10)}
            onBlur={(e) => update('createdFrom', e.target.value)}
          />
        </label>
        <label>
          Created to
          <Input
            type="date"
            defaultValue={(params.get('createdTo') ?? '').slice(0, 10)}
            onBlur={(e) =>
              update(
                'createdTo',
                e.target.value
                  ? new Date(
                      new Date(`${e.target.value}T00:00:00`).getTime() + 86400000,
                    ).toISOString()
                  : '',
              )
            }
          />
        </label>
        <label>
          Buyer
          <Input
            defaultValue={params.get('buyerId') ?? ''}
            onBlur={(e) => update('buyerId', e.target.value)}
          />
        </label>
        <label>
          Deadline from
          <Input
            type="date"
            defaultValue={params.get('deadlineFrom') ?? ''}
            onBlur={(e) => update('deadlineFrom', e.target.value)}
          />
        </label>
        <label>
          Deadline to
          <Input
            type="date"
            defaultValue={params.get('deadlineTo') ?? ''}
            onBlur={(e) =>
              update(
                'deadlineTo',
                e.target.value
                  ? new Date(
                      new Date(`${e.target.value}T00:00:00`).getTime() + 86400000,
                    ).toISOString()
                  : '',
              )
            }
          />
        </label>
        <label>
          Direction
          <Select
            value={params.get('direction') ?? 'desc'}
            onChange={(e) => update('direction', e.target.value)}
          >
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </Select>
        </label>
        <label>
          Page size
          <Select
            value={params.get('limit') ?? '25'}
            onChange={(e) => update('limit', e.target.value)}
          >
            <option value="10">10</option>
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </Select>
        </label>
        <label>
          Sort
          <Select
            value={params.get('sort') ?? 'created_at'}
            onChange={(e) => update('sort', e.target.value)}
          >
            <option value="created_at">Created</option>
            <option value="updated_at">Updated</option>
            <option value="submission_deadline">Quotation deadline</option>
            <option value="title">Title</option>
            <option value="status">Status</option>
          </Select>
        </label>
      </div>
      {busy && <LoadingState label="Loading real RFQs" />}
      {data?.total === 0 && <NoRecords title="No real RFQs exist" />}
      {data && data.total > 0 && (
        <Table>
          <thead>
            <tr>
              <th>RFQ</th>
              <th>Title</th>
              <th>Status</th>
              <th>Category</th>
              <th>Currency</th>
              <th>Deadline</th>
              <th>Version</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((r) => (
              <tr key={r.id}>
                <td>
                  <Link href={`/sourcing/rfqs/${r.id}`}>{r.rfq_number}</Link>
                </td>
                <td>{r.title}</td>
                <td>
                  <StatusBadge tone={tone(r.status)}>{r.status}</StatusBadge>
                </td>
                <td>{r.procurement_category}</td>
                <td>{r.currency}</td>
                <td>{new Date(r.submission_deadline).toLocaleString()}</td>
                <td>{r.version}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}{' '}
      {data && (
        <div className="pager">
          <Button disabled={data.page <= 1} onClick={() => update('page', String(data.page - 1))}>
            Previous
          </Button>
          <span>
            Page {data.page} of {Math.max(1, Math.ceil(data.total / data.limit))}. Total{' '}
            {data.total}.
          </span>
          <Button
            disabled={data.page * data.limit >= data.total}
            onClick={() => update('page', String(data.page + 1))}
          >
            Next
          </Button>
        </div>
      )}
    </>
  );
}
