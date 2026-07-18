'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ErrorState, LoadingState } from '@procurement/ui';
import { ApiError, getOverview } from '../lib/api';
import type { RfqOverview } from '../lib/types';
import { NoRecords } from '../components/states';
export default function SourcingOverview() {
  const [data, setData] = useState<RfqOverview | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  useEffect(() => {
    const c = new AbortController();
    getOverview(c.signal)
      .then(setData)
      .catch((e) => {
        if (e instanceof ApiError && e.kind !== 'aborted') setError(e);
      })
      .finally(() => setBusy(false));
    return () => c.abort();
  }, []);
  if (busy) return <LoadingState label="Loading real sourcing overview" />;
  if (error) return <ErrorState title={error.kind} description={error.message} />;
  if (!data) return <NoRecords title="No sourcing overview available" />;
  const queues = [
    ['Drafts', data.drafts],
    ['Ready for review', data.readyForReview],
    ['Clarification open', data.clarificationOpen],
    ['Quotation open', data.quotationOpen],
    ['Ready to close', data.readyToClose],
    ['Recently updated', data.recentlyUpdated],
  ] as const;
  return (
    <section className="cards">
      {queues.map(([label, q]) => (
        <article className="card" key={label}>
          <h3>{label}</h3>
          <strong>{q.count}</strong>
          {q.records.length === 0 ? (
            <span>No real RFQs currently match this queue.</span>
          ) : (
            q.records.map((r) => (
              <Link key={r.id} className="link" href={`/sourcing/rfqs/${r.id}`}>
                {r.rfq_number} — {r.title}
              </Link>
            ))
          )}
        </article>
      ))}
    </section>
  );
}
