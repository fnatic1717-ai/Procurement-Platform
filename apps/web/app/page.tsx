'use client';
import { FormEvent, useCallback, useEffect, useState } from 'react';
type Json = Record<string, unknown>;
type View =
  | 'requests'
  | 'create'
  | 'approvals'
  | 'intake'
  | 'policies'
  | 'suppliers'
  | 'rfqs'
  | 'invitations';
type PageResult = { items: Json[]; total: number; page: number; limit: number };
const blank: PageResult = { items: [], total: 0, page: 1, limit: 25 };
async function api(path: string, init?: RequestInit) {
  const response = await fetch(`/api/v1${path}`, {
    credentials: 'include',
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  const body = (await response
    .json()
    .catch(() => ({ message: 'The server returned an invalid response.' }))) as Json;
  if (!response.ok)
    throw new Error(String(body.message ?? 'The operation could not be completed.'));
  return body;
}
const text = (v: unknown) => (v == null ? '' : String(v));
const key = () => crypto.randomUUID();
export default function Page() {
  const [view, setView] = useState<View>('requests');
  const [selected, setSelected] = useState<Json | null>(null);
  const [data, setData] = useState<PageResult>(blank);
  const [query, setQuery] = useState({
    search: '',
    status: '',
    sort: 'createdAt',
    direction: 'desc',
    page: 1,
    priority: '',
    department: '',
    category: '',
    requiredFrom: '',
    requiredTo: '',
    requesterId: '',
    buyerId: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      if (view === 'create') {
        setData(blank);
        return;
      }
      const path =
        view === 'requests'
          ? '/purchase-requests'
          : view === 'approvals'
            ? '/approvals/inbox'
            : view === 'intake'
              ? '/procurement-intake'
              : view === 'suppliers'
                ? '/suppliers'
                : view === 'rfqs'
                  ? '/rfqs'
                  : view === 'invitations'
                    ? '/supplier-portal/invitations'
                    : '/approval-policies';
      const params = new URLSearchParams();
      Object.entries(query).forEach(([k, v]) => {
        if (v) params.set(k, String(v));
      });
      const result = await api(`${path}?${params}`);
      const normalized = Array.isArray(result)
        ? { items: result, total: result.length, page: 1, limit: 25 }
        : result;
      setData(normalized as PageResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  }, [view, query]);
  useEffect(() => {
    void load();
  }, [load]);
  async function open(row: Json) {
    setBusy(true);
    setError('');
    try {
      const id = text(row.id);
      if (view === 'rfqs' || view === 'invitations') return;
      const path =
        view === 'requests'
          ? `/purchase-requests/${id}`
          : view === 'approvals'
            ? `/approvals/${id}`
            : view === 'intake'
              ? `/procurement-intake/${id}`
              : view === 'suppliers'
                ? `/suppliers/${id}`
                : `/approval-policies/${id}`;
      setSelected(await api(path));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load detail');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="shell">
      <aside>
        <h1>Procurement Platform</h1>
        <p>Operational purchasing</p>
        <nav aria-label="Primary navigation">
          <Nav
            label="My Purchase Requests"
            active={view === 'requests'}
            onClick={() => {
              setSelected(null);
              setView('requests');
            }}
          />
          <Nav
            label="Create Purchase Request"
            active={view === 'create'}
            onClick={() => {
              setSelected(null);
              setView('create');
            }}
          />
          <Nav
            label="My Approval Inbox"
            active={view === 'approvals'}
            onClick={() => {
              setSelected(null);
              setView('approvals');
            }}
          />
          <Nav
            label="Procurement Intake Queue"
            active={view === 'intake'}
            onClick={() => {
              setSelected(null);
              setView('intake');
            }}
          />
          <Nav
            label="Supplier Management"
            active={view === 'suppliers'}
            onClick={() => {
              setSelected(null);
              setView('suppliers');
            }}
          />
          <Nav
            label="Request for Quotations"
            active={view === 'rfqs'}
            onClick={() => {
              setSelected(null);
              setView('rfqs');
            }}
          />
          <Nav
            label="My Supplier Invitations"
            active={view === 'invitations'}
            onClick={() => {
              setSelected(null);
              setView('invitations');
            }}
          />
          <Nav
            label="Approval Policies"
            active={view === 'policies'}
            onClick={() => {
              setSelected(null);
              setView('policies');
            }}
          />
        </nav>
        <small>
          Supplier sourcing is available according to your persisted role and permissions.
        </small>
      </aside>
      <section className="content">
        <header>
          <p className="eyebrow">Procurement workspace</p>
          <h2>
            {selected
              ? 'Record detail'
              : view === 'requests'
                ? 'My Purchase Requests'
                : view === 'create'
                  ? 'Create Purchase Request'
                  : view === 'approvals'
                    ? 'My Approval Inbox'
                    : view === 'intake'
                      ? 'Procurement Intake Queue'
                      : view === 'suppliers'
                        ? 'Supplier Management'
                        : view === 'rfqs'
                          ? 'Request for Quotations'
                          : view === 'invitations'
                            ? 'My Supplier Invitations'
                            : 'Approval Policies'}
          </h2>
        </header>
        {error && (
          <div className="pp-state pp-state--error" role="alert">
            <strong>Action required</strong>
            <span>{error}</span>
          </div>
        )}
        {busy && (
          <div className="pp-state" aria-live="polite">
            Loading current procurement data…
          </div>
        )}
        {!busy && selected && (
          <Detail
            view={view}
            record={selected}
            close={() => setSelected(null)}
            refresh={async () => {
              setSelected(null);
              await load();
            }}
            fail={setError}
          />
        )}{' '}
        {!busy && !selected && view === 'create' && (
          <RequestForm
            done={async () => {
              setView('requests');
              await load();
            }}
            fail={setError}
          />
        )}{' '}
        {!busy && !selected && view !== 'create' && (
          <>
            <Toolbar view={view} query={query} setQuery={setQuery} />
            <Records view={view} data={data} open={open} />
            <Pager data={data} setPage={(page) => setQuery((q) => ({ ...q, page }))} />
            {view === 'policies' && <PolicyForm done={load} fail={setError} />}
            {(view === 'suppliers' || view === 'rfqs') && (
              <SourcingCreate view={view} done={load} fail={setError} />
            )}
          </>
        )}
      </section>
    </main>
  );
}
function Nav({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button className={active ? 'nav-item active' : 'nav-item'} onClick={onClick}>
      {label}
    </button>
  );
}
function Toolbar({
  view,
  query,
  setQuery,
}: {
  view: View;
  query: {
    search: string;
    status: string;
    sort: string;
    direction: string;
    page: number;
    priority: string;
    department: string;
    category: string;
    requiredFrom: string;
    requiredTo: string;
    requesterId: string;
    buyerId: string;
  };
  setQuery: React.Dispatch<
    React.SetStateAction<{
      search: string;
      status: string;
      sort: string;
      direction: string;
      page: number;
      priority: string;
      department: string;
      category: string;
      requiredFrom: string;
      requiredTo: string;
      requesterId: string;
      buyerId: string;
    }>
  >;
}) {
  return (
    <form className="toolbar" onSubmit={(e) => e.preventDefault()}>
      <label>
        Search
        <input
          className="pp-input"
          value={query.search}
          onChange={(e) => setQuery((q) => ({ ...q, search: e.target.value, page: 1 }))}
        />
      </label>
      {view === 'intake' && (
        <>
          <label>
            Priority
            <select
              className="pp-select"
              onChange={(e) => setQuery((q) => ({ ...q, priority: e.target.value, page: 1 }))}
            >
              <option value="">All priorities</option>
              <option>low</option>
              <option>normal</option>
              <option>high</option>
              <option>urgent</option>
            </select>
          </label>
          <label>
            Department
            <input
              className="pp-input"
              onChange={(e) => setQuery((q) => ({ ...q, department: e.target.value, page: 1 }))}
            />
          </label>
          <label>
            Category
            <input
              className="pp-input"
              onChange={(e) => setQuery((q) => ({ ...q, category: e.target.value, page: 1 }))}
            />
          </label>
          <label>
            Required from
            <input
              className="pp-input"
              type="date"
              onChange={(e) => setQuery((q) => ({ ...q, requiredFrom: e.target.value, page: 1 }))}
            />
          </label>
          <label>
            Required to
            <input
              className="pp-input"
              type="date"
              onChange={(e) => setQuery((q) => ({ ...q, requiredTo: e.target.value, page: 1 }))}
            />
          </label>
          <label>
            Requester UUID
            <input
              className="pp-input"
              onChange={(e) => setQuery((q) => ({ ...q, requesterId: e.target.value, page: 1 }))}
            />
          </label>
          <label>
            Buyer UUID
            <input
              className="pp-input"
              onChange={(e) => setQuery((q) => ({ ...q, buyerId: e.target.value, page: 1 }))}
            />
          </label>
        </>
      )}
      <label>
        Status
        <select
          className="pp-select"
          value={query.status}
          onChange={(e) => setQuery((q) => ({ ...q, status: e.target.value, page: 1 }))}
        >
          <option value="">All statuses</option>
          {(view === 'intake'
            ? ['unassigned', 'assigned', 'in_review', 'closed']
            : view === 'requests'
              ? [
                  'DRAFT',
                  'PENDING_APPROVAL',
                  'RETURNED_TO_REQUESTER',
                  'REJECTED',
                  'APPROVED',
                  'WITHDRAWN',
                  'CANCELLED',
                  'IN_PROCUREMENT_REVIEW',
                ]
              : []
          ).map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>
      <label>
        Sort
        <select
          className="pp-select"
          value={query.sort}
          onChange={(e) => setQuery((q) => ({ ...q, sort: e.target.value }))}
        >
          {(view === 'intake'
            ? ['receivedAt', 'requiredBy', 'estimatedTotal', 'priority']
            : ['createdAt', 'requiredBy', 'estimatedTotal', 'requestNumber', 'priority']
          ).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
      <button
        className="secondary"
        onClick={() =>
          setQuery({
            search: '',
            status: '',
            sort: view === 'intake' ? 'receivedAt' : 'createdAt',
            direction: 'desc',
            page: 1,
            priority: '',
            department: '',
            category: '',
            requiredFrom: '',
            requiredTo: '',
            requesterId: '',
            buyerId: '',
          })
        }
      >
        Clear filters
      </button>
    </form>
  );
}
function Records({ view, data, open }: { view: View; data: PageResult; open: (r: Json) => void }) {
  if (!data.items.length)
    return (
      <section className="pp-state">
        <strong>No matching operational records</strong>
        <span>Adjust the filters or complete the preceding workflow step.</span>
      </section>
    );
  return (
    <div className="pp-table-wrapper">
      <table className="pp-table">
        <thead>
          <tr>
            {(view === 'approvals'
              ? ['Step', 'Request', 'Created']
              : view === 'intake'
                ? ['Request', 'Status', 'Priority', 'Buyer', 'Aging']
                : view === 'policies'
                  ? ['Policy', 'Status', 'Priority', 'Version']
                  : view === 'suppliers'
                    ? ['Supplier', 'Legal name', 'Status', 'Qualification']
                    : view === 'rfqs'
                      ? ['RFQ', 'Title', 'Status', 'Deadline']
                      : view === 'invitations'
                        ? ['RFQ', 'Title', 'Status', 'Deadline']
                        : ['Request', 'Title', 'Status', 'Value', 'Required by']
            ).map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.items.map((r) => (
            <tr
              key={text(r.id)}
              tabIndex={0}
              onClick={() => void open(r)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void open(r);
              }}
            >
              {view === 'approvals' ? (
                <>
                  <td>{text(r.stepNumber)}</td>
                  <td>{text((r.instance as Json)?.purchaseRequestId ?? r.instanceId)}</td>
                  <td>{date(r.createdAt)}</td>
                </>
              ) : view === 'intake' ? (
                <>
                  <td>{text((r.purchaseRequest as Json)?.requestNumber)}</td>
                  <td>{text(r.status)}</td>
                  <td>{text((r.purchaseRequest as Json)?.priority)}</td>
                  <td>{text(r.currentBuyerId) || 'Unassigned'}</td>
                  <td>{text(r.agingDays)} days</td>
                </>
              ) : view === 'policies' ? (
                <>
                  <td>{text(r.name)}</td>
                  <td>{r.active ? 'Active' : 'Inactive'}</td>
                  <td>{text(r.priority)}</td>
                  <td>{text(r.version)}</td>
                </>
              ) : view === 'suppliers' ? (
                <>
                  {' '}
                  <td>{text(r.supplier_number ?? r.supplierNumber)}</td>
                  <td>{text(r.legal_name ?? r.legalName)}</td>
                  <td>{text(r.status)}</td>
                  <td>{text(r.qualification_status ?? r.qualificationStatus)}</td>{' '}
                </>
              ) : view === 'rfqs' || view === 'invitations' ? (
                <>
                  {' '}
                  <td>{text(r.rfq_number ?? r.rfqNumber)}</td>
                  <td>{text(r.title)}</td>
                  <td>{text(r.status)}</td>
                  <td>{date(r.submission_deadline ?? r.submissionDeadline)}</td>{' '}
                </>
              ) : (
                <>
                  <td>{text(r.requestNumber)}</td>
                  <td>{text(r.title)}</td>
                  <td>{text(r.status)}</td>
                  <td>
                    {text(r.currency)} {text(r.estimatedTotal)}
                  </td>
                  <td>{date(r.requiredBy)}</td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function Pager({ data, setPage }: { data: PageResult; setPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(data.total / data.limit));
  return (
    <div className="pager">
      <span>
        Page {data.page} of {pages} · {data.total} records
      </span>
      <button
        className="secondary"
        disabled={data.page <= 1}
        onClick={() => setPage(data.page - 1)}
      >
        Previous
      </button>
      <button
        className="secondary"
        disabled={data.page >= pages}
        onClick={() => setPage(data.page + 1)}
      >
        Next
      </button>
    </div>
  );
}
function RequestForm({
  record,
  done,
  fail,
}: {
  record?: Json;
  done: () => Promise<void>;
  fail: (s: string) => void;
}) {
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = Object.fromEntries(
      [...new FormData(e.currentTarget)].filter(([, value]) => value !== ''),
    ) as Json;
    if (record) d.version = record.version;
    try {
      await api(record ? `/purchase-requests/${text(record.id)}` : '/purchase-requests', {
        method: record ? 'PATCH' : 'POST',
        body: JSON.stringify(d),
      });
      await done();
    } catch (x) {
      fail(x instanceof Error ? x.message : 'Save failed');
    }
  }
  return (
    <form className="request-form" onSubmit={(e) => void submit(e)}>
      {[
        'title',
        'legalEntity',
        'department',
        'costCenter',
        'deliveryLocation',
        'procurementCategory',
      ].map((n) => (
        <Field key={n} name={n} value={record?.[n]} required />
      ))}
      <Field name="businessJustification" value={record?.businessJustification} area required />
      <Field name="currency" value={record?.currency ?? 'USD'} required />
      <Field name="requiredBy" value={text(record?.requiredBy).slice(0, 10)} type="date" required />
      <label>
        Priority
        <select
          className="pp-select"
          name="priority"
          defaultValue={text(record?.priority) || 'normal'}
        >
          {['low', 'normal', 'high', 'urgent'].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      </label>
      <Field name="internalNotes" value={record?.internalNotes} area />
      <div className="wide actions">
        <button className="pp-button">{record ? 'Save draft' : 'Create draft'}</button>
      </div>
    </form>
  );
}
function Field({
  name,
  value,
  type = 'text',
  area = false,
  required = false,
}: {
  name: string;
  value?: unknown;
  type?: string;
  area?: boolean;
  required?: boolean;
}) {
  return (
    <label className={area ? 'wide' : ''}>
      {name.replaceAll(/([A-Z])/g, ' $1')}
      {area ? (
        <textarea className="pp-input" name={name} defaultValue={text(value)} required={required} />
      ) : (
        <input
          className="pp-input"
          name={name}
          type={type}
          defaultValue={text(value)}
          required={required}
        />
      )}
    </label>
  );
}
function Detail({
  view,
  record,
  close,
  refresh,
  fail,
}: {
  view: View;
  record: Json;
  close: () => void;
  refresh: () => Promise<void>;
  fail: (s: string) => void;
}) {
  async function action(path: string, payload: Json) {
    try {
      await api(path, { method: 'POST', body: JSON.stringify(payload) });
      await refresh();
    } catch (e) {
      fail(e instanceof Error ? e.message : 'Action failed');
    }
  }
  return (
    <section className="detail">
      <button className="secondary" onClick={close}>
        ← Back to list
      </button>
      {view === 'requests' && (
        <>
          <h3>
            {text(record.requestNumber)} · {text(record.title)}
          </h3>
          <dl>
            <dt>Status</dt>
            <dd>{text(record.status)}</dd>
            <dt>Estimated total</dt>
            <dd>
              {text(record.currency)} {text(record.estimatedTotal)}
            </dd>
            <dt>Required by</dt>
            <dd>{date(record.requiredBy)}</dd>
          </dl>
          {['DRAFT', 'RETURNED_TO_REQUESTER'].includes(text(record.status)) && (
            <>
              <RequestForm record={record} done={refresh} fail={fail} />
              <ItemEditor request={record} refresh={refresh} fail={fail} />
              <button
                className="pp-button"
                onClick={() =>
                  void action(
                    `/purchase-requests/${text(record.id)}/${text(record.status) === 'DRAFT' ? 'submit' : 'resubmit'}`,
                    { version: record.version, idempotencyKey: key() },
                  )
                }
              >
                {text(record.status) === 'DRAFT' ? 'Submit' : 'Resubmit'}
              </button>
            </>
          )}
          {['PENDING_APPROVAL', 'RETURNED_TO_REQUESTER'].includes(text(record.status)) && (
            <ReasonAction
              label="Withdraw"
              run={(reason) =>
                action(`/purchase-requests/${text(record.id)}/withdraw`, {
                  version: record.version,
                  reason,
                })
              }
            />
          )}
          <Timeline record={record} />
        </>
      )}
      {view === 'approvals' && (
        <>
          <h3>Approval step {text(record.stepNumber)}</h3>
          <RequestSummary record={((record.instance as Json)?.purchaseRequest as Json) ?? {}} />
          <button
            className="pp-button"
            onClick={() =>
              void action(`/approvals/${text(record.id)}/approve`, {
                version: record.version,
                idempotencyKey: key(),
              })
            }
          >
            Approve
          </button>
          <ReasonAction
            label="Reject"
            run={(comment) =>
              action(`/approvals/${text(record.id)}/reject`, {
                version: record.version,
                idempotencyKey: key(),
                comment,
              })
            }
          />
          <ReasonAction
            label="Return to requester"
            run={(comment) =>
              action(`/approvals/${text(record.id)}/return`, {
                version: record.version,
                idempotencyKey: key(),
                comment,
              })
            }
          />
        </>
      )}
      {view === 'intake' && (
        <>
          <h3>Procurement intake review</h3>
          <RequestSummary record={(record.purchaseRequest as Json) ?? {}} />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const d = Object.fromEntries(
                [...new FormData(e.currentTarget)].filter(([, value]) => value !== ''),
              ) as Json;
              void action(`/procurement-intake/${text(record.id)}/assign`, {
                ...d,
                version: record.version,
                idempotencyKey: key(),
              });
            }}
          >
            <Field name="buyerId" required />
            <Field name="reason" area required />
            <button className="pp-button">
              {record.currentBuyerId ? 'Reassign buyer' : 'Assign buyer'}
            </button>
          </form>
        </>
      )}
      {view === 'policies' && <PolicyForm record={record} done={refresh} fail={fail} />}
    </section>
  );
}
function ItemEditor({
  request,
  refresh,
  fail,
}: {
  request: Json;
  refresh: () => Promise<void>;
  fail: (s: string) => void;
}) {
  const items = (request.items as Json[]) ?? [];
  async function save(e: FormEvent<HTMLFormElement>, item?: Json) {
    e.preventDefault();
    const d = Object.fromEntries(
      [...new FormData(e.currentTarget)].filter(([, value]) => value !== ''),
    ) as Json;
    if (item) d.version = item.version;
    else d.requestVersion = request.version;
    try {
      await api(`/purchase-requests/${text(request.id)}/items${item ? `/${text(item.id)}` : ''}`, {
        method: item ? 'PATCH' : 'POST',
        body: JSON.stringify(d),
      });
      await refresh();
    } catch (x) {
      fail(x instanceof Error ? x.message : 'Item save failed');
    }
  }
  return (
    <section>
      <h3>Request items</h3>
      {items.map((i) => (
        <form className="item-row" key={text(i.id)} onSubmit={(e) => void save(e, i)}>
          <ItemFields item={i} />
          <button className="secondary">Save item</button>
          <button
            type="button"
            className="danger"
            onClick={() =>
              void api(`/purchase-requests/${text(request.id)}/items/${text(i.id)}`, {
                method: 'DELETE',
                body: JSON.stringify({ version: i.version }),
              })
                .then(refresh)
                .catch((x) => fail(x instanceof Error ? x.message : 'Delete failed'))
            }
          >
            Remove
          </button>
        </form>
      ))}
      <form className="item-row" onSubmit={(e) => void save(e)}>
        <ItemFields />
        <button className="pp-button">Add item</button>
      </form>
    </section>
  );
}
function ItemFields({ item }: { item?: Json }) {
  return (
    <>
      <Field name="description" value={item?.description} required />
      <label>
        Item type
        <select
          name="itemType"
          className="pp-select"
          defaultValue={text(item?.itemType) || 'goods'}
        >
          <option>goods</option>
          <option>services</option>
        </select>
      </label>
      {[
        'quantity',
        'unitOfMeasure',
        'estimatedUnitPrice',
        'category',
        'specifications',
        'deliveryLocation',
      ].map((n) => (
        <Field key={n} name={n} value={item?.[n]} required />
      ))}
      <Field name="requiredBy" value={text(item?.requiredBy).slice(0, 10)} type="date" required />
      <Field name="suggestedSupplierName" value={item?.suggestedSupplierName} />
    </>
  );
}
function ReasonAction({ label, run }: { label: string; run: (r: string) => Promise<unknown> }) {
  return (
    <form
      className="inline-action"
      onSubmit={(e) => {
        e.preventDefault();
        void run(text(new FormData(e.currentTarget).get('reason')));
      }}
    >
      <label>
        {label} reason
        <textarea className="pp-input" name="reason" required />
      </label>
      <button className={label === 'Reject' ? 'danger' : 'secondary'}>{label}</button>
    </form>
  );
}
function RequestSummary({ record }: { record: Json }) {
  return (
    <dl>
      <dt>Request</dt>
      <dd>
        {text(record.requestNumber)} · {text(record.title)}
      </dd>
      <dt>Requester</dt>
      <dd>{text(record.requesterId)}</dd>
      <dt>Value</dt>
      <dd>
        {text(record.currency)} {text(record.estimatedTotal)}
      </dd>
      <dt>Priority</dt>
      <dd>{text(record.priority)}</dd>
    </dl>
  );
}
function Timeline({ record }: { record: Json }) {
  const events = (record.activity as Json[]) ?? [];
  const instances = (record.approvals as Json[]) ?? [];
  return (
    <section>
      <h3>Approval timeline and activity</h3>
      {!events.length && !instances.length ? (
        <p>No lifecycle activity has been recorded.</p>
      ) : (
        <ol className="timeline">
          {events.map((e) => (
            <li key={text(e.id)}>
              <strong>{text(e.action)}</strong>
              <span>{date(e.createdAt)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
function PolicyForm({
  record,
  done,
  fail,
}: {
  record?: Json;
  done: () => Promise<void>;
  fail: (s: string) => void;
}) {
  const initial = (record?.steps as Json[]) ?? [
    { stepNumber: 1, requiredPermission: 'approvals.act' },
  ];
  const [steps, setSteps] = useState<Json[]>(initial);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = Object.fromEntries(
      [...new FormData(e.currentTarget)].filter(([, value]) => value !== ''),
    ) as Json;
    d.priority = Number(d.priority);
    d.steps = steps.map((s, i) => ({
      ...s,
      stepNumber: i + 1,
      escalationAfterHours: s.escalationAfterHours ? Number(s.escalationAfterHours) : undefined,
    }));
    if (record) d.version = record.version;
    try {
      await api(record ? `/approval-policies/${text(record.id)}` : '/approval-policies', {
        method: record ? 'PATCH' : 'POST',
        body: JSON.stringify(d),
      });
      await done();
    } catch (x) {
      fail(x instanceof Error ? x.message : 'Policy save failed');
    }
  }
  return (
    <form className="policy-form" onSubmit={(e) => void save(e)}>
      <h3>{record ? 'Edit approval policy' : 'Create approval policy'}</h3>
      <Field name="name" value={record?.name} required />
      <Field name="priority" value={record?.priority ?? 100} type="number" required />
      <Field name="minAmount" value={record?.minAmount} />
      <Field name="maxAmount" value={record?.maxAmount} />
      <Field name="department" value={record?.department} />
      <Field name="legalEntity" value={record?.legalEntity} />
      <Field name="procurementCategory" value={record?.procurementCategory} />
      <Field name="currency" value={record?.currency} />
      <label>
        Request priority
        <select
          className="pp-select"
          name="requestPriority"
          defaultValue={text(record?.requestPriority)}
        >
          <option value="">Any priority</option>
          <option>low</option>
          <option>normal</option>
          <option>high</option>
          <option>urgent</option>
        </select>
      </label>
      {steps.map((s, i) => (
        <fieldset key={i}>
          <legend>Step {i + 1}</legend>
          <label>
            Approver user or role UUID
            <input
              className="pp-input"
              value={text(s.approverUserId ?? s.approverRoleId)}
              onChange={(e) =>
                setSteps((a) =>
                  a.map((v, x) =>
                    x === i
                      ? v.approverRoleId
                        ? { ...v, approverRoleId: e.target.value }
                        : { ...v, approverUserId: e.target.value }
                      : v,
                  ),
                )
              }
              required
            />
          </label>
          <label>
            Assignment type
            <select
              className="pp-select"
              value={s.approverRoleId ? 'role' : 'user'}
              onChange={(e) =>
                setSteps((a) =>
                  a.map((v, x) =>
                    x === i
                      ? {
                          ...v,
                          approverRoleId:
                            e.target.value === 'role' ? text(v.approverUserId) : undefined,
                          approverUserId:
                            e.target.value === 'user' ? text(v.approverRoleId) : undefined,
                        }
                      : v,
                  ),
                )
              }
            >
              <option value="user">Named user</option>
              <option value="role">Tenant role</option>
            </select>
          </label>
          <label>
            Required permission
            <input
              className="pp-input"
              value={text(s.requiredPermission)}
              onChange={(e) =>
                setSteps((a) =>
                  a.map((v, x) => (x === i ? { ...v, requiredPermission: e.target.value } : v)),
                )
              }
              required
            />
          </label>
          <label>
            Minimum threshold
            <input
              className="pp-input"
              value={text(s.minThreshold)}
              onChange={(e) =>
                setSteps((a) =>
                  a.map((v, x) =>
                    x === i ? { ...v, minThreshold: e.target.value || undefined } : v,
                  ),
                )
              }
            />
          </label>
          <label>
            Maximum threshold
            <input
              className="pp-input"
              value={text(s.maxThreshold)}
              onChange={(e) =>
                setSteps((a) =>
                  a.map((v, x) =>
                    x === i ? { ...v, maxThreshold: e.target.value || undefined } : v,
                  ),
                )
              }
            />
          </label>
          <label>
            Escalation after hours
            <input
              className="pp-input"
              type="number"
              min="1"
              value={text(s.escalationAfterHours)}
              onChange={(e) =>
                setSteps((a) =>
                  a.map((v, x) =>
                    x === i ? { ...v, escalationAfterHours: e.target.value || undefined } : v,
                  ),
                )
              }
            />
          </label>
          <button
            type="button"
            className="secondary"
            disabled={i === 0}
            onClick={() =>
              setSteps((a) => {
                const n = [...a];
                const previous = n[i - 1]!;
                n[i - 1] = n[i]!;
                n[i] = previous;
                return n;
              })
            }
          >
            Move up
          </button>
          <button
            type="button"
            className="danger"
            disabled={steps.length === 1}
            onClick={() => setSteps((a) => a.filter((_, x) => x !== i))}
          >
            Remove step
          </button>
        </fieldset>
      ))}
      <button
        type="button"
        className="secondary"
        onClick={() =>
          setSteps((a) => [...a, { stepNumber: a.length + 1, requiredPermission: 'approvals.act' }])
        }
      >
        Add approval step
      </button>
      <button className="pp-button">Save policy</button>
      {record && (
        <button
          type="button"
          className="secondary"
          onClick={() =>
            void api(`/approval-policies/${text(record.id)}/status`, {
              method: 'POST',
              body: JSON.stringify({ version: record.version, active: !record.active }),
            })
              .then(done)
              .catch((x) => fail(x instanceof Error ? x.message : 'Status change failed'))
          }
        >
          {record.active ? 'Deactivate' : 'Activate'}
        </button>
      )}
    </form>
  );
}
function date(v: unknown) {
  return v ? new Date(String(v)).toLocaleDateString('en') : '';
}

function SourcingCreate({
  view,
  done,
  fail,
}: {
  view: 'suppliers' | 'rfqs';
  done: () => Promise<void>;
  fail: (message: string) => void;
}) {
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = Object.fromEntries(
      [...new FormData(event.currentTarget)].filter(([, value]) => value !== ''),
    );
    try {
      await api(view === 'suppliers' ? '/suppliers' : '/rfqs', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      event.currentTarget.reset();
      await done();
    } catch (error) {
      fail(error instanceof Error ? error.message : 'Unable to save sourcing record');
    }
  }
  return (
    <form
      className="request-form"
      onSubmit={(event) => void submit(event)}
      aria-label={view === 'suppliers' ? 'Create supplier' : 'Create RFQ draft'}
    >
      <h3 className="wide">{view === 'suppliers' ? 'Create supplier' : 'Create RFQ draft'}</h3>
      {view === 'suppliers' ? (
        <>
          <Field name="legalName" required />
          <Field name="tradingName" />
          <Field name="supplierType" required />
          <Field name="country" required />
          <Field name="defaultCurrency" required />
          <Field name="primaryEmail" type="email" />
          <Field name="primaryPhone" />
        </>
      ) : (
        <>
          <Field name="title" required />
          <Field name="procurementCategory" required />
          <Field name="currency" required />
          <Field name="clarificationDeadline" type="datetime-local" required />
          <Field name="submissionDeadline" type="datetime-local" required />
          <Field name="requiredBy" type="date" required />
          <Field name="deliveryLocation" required />
        </>
      )}
      <button className="pp-button wide">
        {view === 'suppliers' ? 'Create supplier' : 'Create RFQ draft'}
      </button>
    </form>
  );
}
