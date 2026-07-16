'use client';
import { FormEvent, useEffect, useState } from 'react';
type RequestRow = {
  id: string;
  requestNumber: string;
  title: string;
  status: string;
  estimatedTotal: string;
  currency: string;
  requiredBy: string;
};
const views = [
  'My Purchase Requests',
  'Create Purchase Request',
  'My Approval Inbox',
  'Procurement Intake Queue',
  'Approval Policies',
] as const;
export default function Page() {
  const [view, setView] = useState<(typeof views)[number]>('My Purchase Requests');
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  async function load() {
    setState('loading');
    try {
      const response = await fetch('/api/v1/purchase-requests', { credentials: 'include' });
      if (!response.ok) throw new Error();
      setRows(await response.json());
      setState('ready');
    } catch {
      setState('error');
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget));
    const response = await fetch('/api/v1/purchase-requests', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    if (response.ok) {
      setView('My Purchase Requests');
      await load();
    } else setState('error');
  }
  return (
    <main className="shell">
      <aside>
        <h1>Procurement Platform</h1>
        <p>Operational purchasing</p>
        <nav aria-label="Primary">
          {views.map((v) => (
            <button
              key={v}
              className={view === v ? 'nav-item active' : 'nav-item'}
              onClick={() => setView(v)}
            >
              {v}
            </button>
          ))}
        </nav>
        <small>RFQs, awards, and purchase orders are planned for later phases.</small>
      </aside>
      <section className="content">
        <header>
          <p className="eyebrow">Phase 2A workspace</p>
          <h2>{view}</h2>
        </header>
        {view === 'My Purchase Requests' && (
          <section>
            {state === 'loading' ? (
              <div className="pp-state" aria-live="polite">
                Loading purchase requests…
              </div>
            ) : state === 'error' ? (
              <div className="pp-state pp-state--error" role="alert">
                <strong>Requests could not be loaded</strong>
                <span>Check your session and try again.</span>
                <button className="pp-button" onClick={load}>
                  Try again
                </button>
              </div>
            ) : rows.length === 0 ? (
              <div className="pp-state">
                <strong>No purchase requests yet</strong>
                <span>Create a request when a documented business need is ready for approval.</span>
              </div>
            ) : (
              <div className="pp-table-wrapper">
                <table className="pp-table">
                  <thead>
                    <tr>
                      <th>Request</th>
                      <th>Title</th>
                      <th>Status</th>
                      <th>Estimated value</th>
                      <th>Required by</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id}>
                        <td>{r.requestNumber}</td>
                        <td>{r.title}</td>
                        <td>
                          <span className="pp-status-badge pp-status-badge--info">
                            {r.status.replaceAll('_', ' ')}
                          </span>
                        </td>
                        <td>
                          {r.currency} {r.estimatedTotal}
                        </td>
                        <td>{new Date(r.requiredBy).toLocaleDateString('en')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
        {view === 'Create Purchase Request' && (
          <form className="request-form" onSubmit={create}>
            <label>
              Title
              <input className="pp-input" name="title" required />
            </label>
            <label>
              Business justification
              <textarea className="pp-input" name="businessJustification" required />
            </label>
            <label>
              Legal entity
              <input className="pp-input" name="legalEntity" required />
            </label>
            <label>
              Department
              <input className="pp-input" name="department" required />
            </label>
            <label>
              Cost center
              <input className="pp-input" name="costCenter" required />
            </label>
            <label>
              Delivery location
              <input className="pp-input" name="deliveryLocation" required />
            </label>
            <label>
              Procurement category
              <input className="pp-input" name="procurementCategory" required />
            </label>
            <label>
              Currency
              <input
                className="pp-input"
                name="currency"
                pattern="[A-Z]{3}"
                defaultValue="USD"
                required
              />
            </label>
            <label>
              Required-by date
              <input className="pp-input" name="requiredBy" type="date" required />
            </label>
            <label>
              Priority
              <select className="pp-select" name="priority">
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
                <option value="low">Low</option>
              </select>
            </label>
            <label className="wide">
              Internal notes
              <textarea className="pp-input" name="internalNotes" />
            </label>
            <div className="wide actions">
              <button className="pp-button" type="submit">
                Create draft
              </button>
            </div>
          </form>
        )}
        {view === 'My Approval Inbox' && (
          <OperationalEmpty
            title="No approvals assigned"
            text="Current sequential approval steps assigned to you will appear here."
          />
        )}
        {view === 'Procurement Intake Queue' && (
          <OperationalEmpty
            title="No approved requests in intake"
            text="Fully approved requests enter this queue transactionally for buyer assignment."
          />
        )}
        {view === 'Approval Policies' && (
          <OperationalEmpty
            title="No approval policies available"
            text="Tenant administrators can configure ordered, threshold-based approval routes through the approval-policy API."
          />
        )}
      </section>
    </main>
  );
}
function OperationalEmpty({ title, text }: { title: string; text: string }) {
  return (
    <div className="pp-state">
      <strong>{title}</strong>
      <span>{text}</span>
    </div>
  );
}
