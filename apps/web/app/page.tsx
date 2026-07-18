'use client';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  Select,
  StatusBadge,
  Table,
} from '@procurement/ui';
import {
  ApiError,
  can,
  idem,
  normalizeError,
  pageParams,
  validTransitionActions,
  validateRfqDraft,
  visibleModules,
  type RfqStatus,
  type Session,
} from './sourcing';

type Json = Record<string, unknown>;
type PageResult<T = Json> = { items: T[]; total: number; page: number; limit: number };
type Rfq = Json & {
  id: string;
  rfq_number?: string;
  title?: string;
  status: RfqStatus;
  currency?: string;
  version: number;
  lines?: Json[];
  invitations?: Json[];
};
type View = 'overview' | 'rfqs' | 'new' | 'detail' | 'suppliers' | 'activity';
const blank: PageResult = { items: [], total: 0, page: 1, limit: 25 };
const text = (v: unknown) => (v == null ? '' : String(v));
const date = (v: unknown) => (v ? new Date(String(v)).toLocaleString() : 'Not set');
const statusTone = (s: string) =>
  s.includes('CANCEL')
    ? 'danger'
    : s.includes('DRAFT') || s.includes('REVIEW')
      ? 'warning'
      : s.includes('CLOSED') || s === 'PUBLISHED'
        ? 'success'
        : 'info';

async function api<T>(
  path: string,
  session: Session,
  init?: RequestInit,
  signal?: AbortSignal,
): Promise<T> {
  const request: RequestInit = {
    credentials: 'include',
    ...init,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer dev:${session.token}`,
      'x-tenant-id': session.tenantId,
      ...(init?.headers ?? {}),
    },
  };
  if (signal) request.signal = signal;
  const response = await fetch(`/api/v1${path}`, request);
  const body = await response
    .json()
    .catch(() => ({ message: 'The server returned an invalid response.' }));
  if (!response.ok) throw normalizeError(response.status, body);
  return body as T;
}
function defaultSession(): Session | null {
  if (typeof window === 'undefined') return null;
  const stored = window.localStorage.getItem('procurement.session');
  return stored ? (JSON.parse(stored) as Session) : null;
}
export default function Page() {
  const [session, setSession] = useState<Session | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [view, setView] = useState<View>('overview');
  const [rfqs, setRfqs] = useState<PageResult>(blank);
  const [suppliers, setSuppliers] = useState<PageResult>(blank);
  const [selected, setSelected] = useState<Rfq | null>(null);
  const [quotations, setQuotations] = useState<PageResult>(blank);
  const [clarifications, setClarifications] = useState<Json[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | Error | null>(null);
  const [success, setSuccess] = useState('');
  const [query, setQuery] = useState(() =>
    pageParams(typeof window === 'undefined' ? '' : window.location.search),
  );
  const modules = useMemo(() => visibleModules(session), [session]);
  useEffect(() => setSession(defaultSession()), []);
  const saveSession = (next: Session) => {
    window.localStorage.setItem('procurement.session', JSON.stringify(next));
    setSession(next);
  };
  const loadRfqs = useCallback(
    async (signal?: AbortSignal) => {
      if (!session || !can(session, 'rfqs.read')) return;
      setBusy(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        Object.entries(query).forEach(([k, v]) => {
          if (v) params.set(k, String(v));
        });
        window.history.replaceState(null, '', `?${params}`);
        setRfqs(await api<PageResult>(`/rfqs?${params}`, session, undefined, signal));
      } catch (e) {
        setError(e as Error);
      } finally {
        setBusy(false);
      }
    },
    [query, session],
  );
  useEffect(() => {
    const c = new AbortController();
    void loadRfqs(c.signal);
    return () => c.abort();
  }, [loadRfqs]);
  async function openRfq(id: string) {
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      const rfq = await api<Rfq>(`/rfqs/${id}`, session);
      setSelected(rfq);
      setView('detail');
      if (can(session, 'quotations.read'))
        setQuotations(await api<PageResult>(`/rfqs/${id}/quotations`, session));
      if (can(session, 'rfq_clarifications.manage'))
        setClarifications(await api<Json[]>(`/rfqs/${id}/clarifications`, session));
    } catch (e) {
      setError(e as Error);
    } finally {
      setBusy(false);
    }
  }
  async function loadSuppliers() {
    if (!session || !can(session, 'suppliers.read')) return;
    setBusy(true);
    setError(null);
    try {
      setSuppliers(await api<PageResult>('/suppliers?limit=50', session));
    } catch (e) {
      setError(e as Error);
    } finally {
      setBusy(false);
    }
  }
  async function createRfq(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;
    const fd = new FormData(event.currentTarget);
    const payload = {
      title: text(fd.get('title')),
      procurementCategory: text(fd.get('procurementCategory')),
      currency: text(fd.get('currency')).toUpperCase(),
      clarificationDeadline: text(fd.get('clarificationDeadline')),
      submissionDeadline: text(fd.get('submissionDeadline')),
      requiredBy: text(fd.get('requiredBy')),
      deliveryLocation: text(fd.get('deliveryLocation')),
    };
    const errors = validateRfqDraft(payload);
    if (Object.keys(errors).length) {
      setError(new ApiError('validation', Object.values(errors).join(' ')));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const rfq = await api<Rfq>('/rfqs', session, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setSuccess('RFQ draft saved.');
      await openRfq(rfq.id);
    } catch (e) {
      setError(e as Error);
    } finally {
      setBusy(false);
    }
  }
  async function addLine(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !selected) return;
    const fd = new FormData(event.currentTarget);
    const payload = {
      description: text(fd.get('description')),
      itemType: text(fd.get('itemType')) || 'goods',
      quantity: text(fd.get('quantity')),
      unitOfMeasure: text(fd.get('unitOfMeasure')),
      specifications: text(fd.get('specifications')),
      requiredBy: text(fd.get('requiredBy')),
      deliveryLocation: text(fd.get('deliveryLocation')),
      category: text(fd.get('category')),
      lineSequence: Number(selected.lines?.length ?? 0) + 1,
    };
    setBusy(true);
    setError(null);
    try {
      await api(`/rfqs/${selected.id}/lines`, session, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setSuccess('RFQ line saved.');
      await openRfq(selected.id);
    } catch (e) {
      setError(e as Error);
    } finally {
      setBusy(false);
    }
  }
  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !selected) return;
    const fd = new FormData(event.currentTarget);
    const supplierId = text(fd.get('supplierId'));
    const supplier = suppliers.items.find((s) => text(s.id) === supplierId);
    const payload = {
      supplierId,
      supplierContactId: text(fd.get('supplierContactId')) || undefined,
      expiresAt: text(fd.get('expiresAt')),
    };
    if (
      text(supplier?.status) !== 'ACTIVE' ||
      text(supplier?.qualification_status) !== 'APPROVED'
    ) {
      setError(
        new ApiError(
          'validation',
          'Only active and approved suppliers can be invited. The backend will enforce final eligibility.',
        ),
      );
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api(`/rfqs/${selected.id}/invitations`, session, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setSuccess('Supplier invitation added.');
      await openRfq(selected.id);
    } catch (e) {
      setError(e as Error);
    } finally {
      setBusy(false);
    }
  }
  async function transition(to: RfqStatus) {
    if (!session || !selected) return;
    const key = idem();
    if (!confirm(`Send RFQ workflow action ${selected.status} -> ${to}?`)) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/rfqs/${selected.id}/transition`, session, {
        method: 'POST',
        body: JSON.stringify({ status: to, version: selected.version, idempotencyKey: key }),
      });
      setSuccess('RFQ status updated by the backend.');
      await openRfq(selected.id);
    } catch (e) {
      setError(e as Error);
    } finally {
      setBusy(false);
    }
  }
  if (!session) return <SessionForm onSave={saveSession} />;
  const overview = rfqs.items.reduce<Record<string, Json[]>>((a, r) => {
    const s = text(r.status);
    (a[s] ??= []).push(r);
    return a;
  }, {});
  return (
    <main className={`shell ${collapsed ? 'shell--collapsed' : ''}`}>
      <aside>
        <h1>Procurement Platform</h1>
        <p>Internal sourcing workspace</p>
        <Button onClick={() => setCollapsed(!collapsed)}>
          {collapsed ? 'Expand' : 'Collapse'}
        </Button>
        <nav aria-label="Internal sourcing navigation">
          {modules.map((m) => (
            <button
              className={`nav-item ${view === m.key ? 'active' : ''}`}
              key={m.key}
              onClick={() => {
                setView(m.key as View);
                if (m.key === 'suppliers') void loadSuppliers();
              }}
            >
              {m.label}
              <small>{m.permission}</small>
            </button>
          ))}
          {can(session, 'rfqs.create') && (
            <button
              className={`nav-item ${view === 'new' ? 'active' : ''}`}
              onClick={() => setView('new')}
            >
              Create RFQ draft<small>rfqs.create</small>
            </button>
          )}
        </nav>
        <small>
          Tenant {session.tenantId}
          <br />
          User {session.userId}
          <br />
          Role {session.role}
        </small>
      </aside>
      <section className="content">
        <header>
          <p className="eyebrow">Home / Internal sourcing / {view}</p>
          <h2>Internal sourcing workspace</h2>
          {success && (
            <p className="success" role="status">
              {success}
            </p>
          )}
        </header>
        {error && (
          <ErrorState
            title={error instanceof ApiError ? error.kind.replace('_', ' ') : 'Request failed'}
            description={error.message}
          />
        )}{' '}
        {busy && <LoadingState label="Loading real sourcing records" />}
        {view === 'overview' && (
          <section className="cards">
            {[
              'DRAFT',
              'READY_FOR_REVIEW',
              'CLARIFICATION_OPEN',
              'QUOTATION_OPEN',
              'QUOTATION_CLOSED',
            ].map((s) => (
              <article className="card" key={s}>
                <h3>{s.replaceAll('_', ' ')}</h3>
                <strong>{overview[s]?.length ?? 0}</strong>
                {(overview[s] ?? []).slice(0, 5).map((r) => (
                  <button
                    key={text(r.id)}
                    className="link"
                    onClick={() => void openRfq(text(r.id))}
                  >
                    {text(r.rfq_number)} {text(r.title)}
                  </button>
                ))}
                {!overview[s]?.length && <span>No real RFQs currently match this work queue.</span>}
              </article>
            ))}
          </section>
        )}
        {view === 'rfqs' && (
          <RfqList rfqs={rfqs} query={query} setQuery={setQuery} openRfq={openRfq} />
        )}{' '}
        {view === 'new' && <RfqForm onSubmit={createRfq} />}{' '}
        {view === 'suppliers' && <SupplierList suppliers={suppliers} />}{' '}
        {view === 'activity' && (
          <EmptyState
            title="Activity timeline"
            description="Open an RFQ workspace to view persisted RFQ audit and activity sections exposed by the backend."
          />
        )}
        {view === 'detail' && selected && (
          <RfqWorkspace
            rfq={selected}
            quotations={quotations}
            clarifications={clarifications}
            suppliers={suppliers}
            session={session}
            addLine={addLine}
            invite={invite}
            loadSuppliers={loadSuppliers}
            transition={transition}
          />
        )}
      </section>
    </main>
  );
}
function SessionForm({ onSave }: { onSave: (s: Session) => void }) {
  return (
    <main className="content">
      <h1>Sign in to internal sourcing</h1>
      <p>
        Use authenticated development credentials mapped to persisted tenant membership and
        permissions.
      </p>
      <form
        className="request-form"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          onSave({
            tenantId: text(fd.get('tenantId')),
            userId: text(fd.get('userId')),
            token: text(fd.get('userId')),
            role: text(fd.get('role')) || 'Buyer',
            permissions: text(fd.get('permissions'))
              .split(',')
              .map((p) => p.trim())
              .filter(Boolean),
          });
        }}
      >
        <label>
          Tenant ID
          <Input name="tenantId" required />
        </label>
        <label>
          User ID
          <Input name="userId" required />
        </label>
        <label>
          Current role
          <Input name="role" defaultValue="Buyer" />
        </label>
        <label className="wide">
          Persisted permissions
          <Input
            name="permissions"
            defaultValue="rfqs.read,rfqs.create,rfqs.update_draft,rfqs.publish,rfq_invitations.manage,rfq_clarifications.manage,quotations.read,suppliers.read"
          />
        </label>
        <Button>Continue</Button>
      </form>
    </main>
  );
}
function RfqList({
  rfqs,
  query,
  setQuery,
  openRfq,
}: {
  rfqs: PageResult;
  query: ReturnType<typeof pageParams>;
  setQuery: (q: ReturnType<typeof pageParams>) => void;
  openRfq: (id: string) => Promise<void>;
}) {
  return (
    <>
      <div className="toolbar">
        <label>
          Search
          <Input
            value={query.search}
            onChange={(e) => setQuery({ ...query, search: e.target.value, page: 1 })}
          />
        </label>
        <label>
          Status
          <Select
            value={query.status}
            onChange={(e) => setQuery({ ...query, status: e.target.value, page: 1 })}
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
            value={query.category}
            onChange={(e) => setQuery({ ...query, category: e.target.value, page: 1 })}
          />
        </label>
        <label>
          From
          <Input
            type="date"
            value={query.from}
            onChange={(e) => setQuery({ ...query, from: e.target.value, page: 1 })}
          />
        </label>
        <label>
          To
          <Input
            type="date"
            value={query.to}
            onChange={(e) => setQuery({ ...query, to: e.target.value, page: 1 })}
          />
        </label>
      </div>
      {rfqs.total === 0 ? (
        <EmptyState
          title="No real RFQs exist"
          description="Create an RFQ draft or adjust filters."
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <th>RFQ</th>
              <th>Title</th>
              <th>Status</th>
              <th>Currency</th>
              <th>Quotation deadline</th>
              <th>Version</th>
            </tr>
          </thead>
          <tbody>
            {rfqs.items.map((r) => (
              <tr key={text(r.id)} tabIndex={0} onClick={() => void openRfq(text(r.id))}>
                <td>{text(r.rfq_number)}</td>
                <td>{text(r.title)}</td>
                <td>
                  <StatusBadge tone={statusTone(text(r.status))}>{text(r.status)}</StatusBadge>
                </td>
                <td>{text(r.currency)}</td>
                <td>{date(r.submission_deadline)}</td>
                <td>{text(r.version)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <div className="pager">
        <Button
          disabled={query.page <= 1}
          onClick={() => setQuery({ ...query, page: query.page - 1 })}
        >
          Previous
        </Button>
        <span>
          Page {rfqs.page} of {Math.max(1, Math.ceil(rfqs.total / rfqs.limit))}. Total {rfqs.total}.
        </span>
        <Button
          disabled={rfqs.page * rfqs.limit >= rfqs.total}
          onClick={() => setQuery({ ...query, page: query.page + 1 })}
        >
          Next
        </Button>
      </div>
    </>
  );
}
function RfqForm({ onSubmit }: { onSubmit: (e: FormEvent<HTMLFormElement>) => void }) {
  return (
    <form className="request-form" onSubmit={onSubmit}>
      <label>
        Title
        <Input name="title" required maxLength={250} />
      </label>
      <label>
        Procurement category
        <Input name="procurementCategory" required maxLength={150} />
      </label>
      <label>
        Currency
        <Input name="currency" required defaultValue="USD" maxLength={3} />
      </label>
      <label>
        Clarification deadline
        <Input name="clarificationDeadline" type="datetime-local" required />
      </label>
      <label>
        Quotation deadline
        <Input name="submissionDeadline" type="datetime-local" required />
      </label>
      <label>
        Required by
        <Input name="requiredBy" type="date" required />
      </label>
      <label className="wide">
        Delivery location
        <Input name="deliveryLocation" required maxLength={500} />
      </label>
      <Button>Save RFQ draft</Button>
    </form>
  );
}
function SupplierList({ suppliers }: { suppliers: PageResult }) {
  return suppliers.total === 0 ? (
    <EmptyState
      title="No real suppliers exist"
      description="No persisted suppliers were returned by the API."
    />
  ) : (
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
        {suppliers.items.map((s) => (
          <tr key={text(s.id)}>
            <td>{text(s.legal_name)}</td>
            <td>{text(s.status)}</td>
            <td>{text(s.qualification_status)}</td>
            <td>{text(s.country)}</td>
            <td>{text(s.default_currency)}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
function RfqWorkspace({
  rfq,
  quotations,
  clarifications,
  suppliers,
  session,
  addLine,
  invite,
  loadSuppliers,
  transition,
}: {
  rfq: Rfq;
  quotations: PageResult;
  clarifications: Json[];
  suppliers: PageResult;
  session: Session;
  addLine: (e: FormEvent<HTMLFormElement>) => void;
  invite: (e: FormEvent<HTMLFormElement>) => void;
  loadSuppliers: () => Promise<void>;
  transition: (to: RfqStatus) => Promise<void>;
}) {
  return (
    <div className="detail">
      <h3>
        {text(rfq.rfq_number)} — {text(rfq.title)}
      </h3>
      <dl>
        <dt>Status</dt>
        <dd>
          <StatusBadge tone={statusTone(rfq.status)}>{rfq.status}</StatusBadge>
        </dd>
        <dt>Currency</dt>
        <dd>{text(rfq.currency)}</dd>
        <dt>Version</dt>
        <dd>{rfq.version}</dd>
        <dt>Clarification deadline</dt>
        <dd>{date(rfq.clarification_deadline)}</dd>
        <dt>Quotation deadline</dt>
        <dd>{date(rfq.submission_deadline)}</dd>
        <dt>Created</dt>
        <dd>{date(rfq.created_at)}</dd>
        <dt>Updated</dt>
        <dd>{date(rfq.updated_at)}</dd>
      </dl>
      <section>
        <h3>State actions</h3>
        {validTransitionActions(rfq.status, session).map((s) => (
          <Button key={s} onClick={() => void transition(s)}>
            {rfq.status} → {s}
          </Button>
        ))}
        {can(session, 'rfqs.cancel') && !['CANCELLED', 'CLOSED'].includes(rfq.status) && (
          <span> Cancellation is supported by POST /rfqs/:id/cancel with a reason.</span>
        )}
      </section>
      <section>
        <h3>Lines</h3>
        {!rfq.lines?.length ? (
          <EmptyState
            title="No RFQ lines exist"
            description="No persisted RFQ lines were returned."
          />
        ) : (
          <Table>
            <tbody>
              {rfq.lines.map((l) => (
                <tr key={text(l.id)}>
                  <td>{text(l.line_sequence)}</td>
                  <td>{text(l.description)}</td>
                  <td>
                    {text(l.quantity)} {text(l.unit_of_measure)}
                  </td>
                  <td>{text(l.category)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        {can(session, 'rfqs.update_draft') && rfq.status === 'DRAFT' && (
          <form className="item-row" onSubmit={addLine}>
            <label>
              Description
              <Input name="description" required />
            </label>
            <label>
              Type
              <Select name="itemType">
                <option value="goods">Goods</option>
                <option value="services">Services</option>
              </Select>
            </label>
            <label>
              Quantity
              <Input name="quantity" required defaultValue="1" />
            </label>
            <label>
              Unit
              <Input name="unitOfMeasure" required />
            </label>
            <label>
              Category
              <Input name="category" required />
            </label>
            <label>
              Required by
              <Input type="date" name="requiredBy" required />
            </label>
            <label>
              Delivery location
              <Input name="deliveryLocation" required />
            </label>
            <label>
              Specifications
              <Input name="specifications" required />
            </label>
            <Button>Add real RFQ line</Button>
          </form>
        )}
      </section>
      <section>
        <h3>Suppliers and invitations</h3>
        <Button onClick={() => void loadSuppliers()}>Load eligible supplier records</Button>
        {!rfq.invitations?.length ? (
          <EmptyState
            title="No invitations exist"
            description="No persisted RFQ invitations were returned."
          />
        ) : (
          <Table>
            <tbody>
              {rfq.invitations.map((i) => (
                <tr key={text(i.id)}>
                  <td>{text(i.supplier_id)}</td>
                  <td>{text(i.status)}</td>
                  <td>{date(i.sent_at)}</td>
                  <td>{date(i.expires_at)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        {can(session, 'rfq_invitations.manage') &&
          ['DRAFT', 'READY_FOR_REVIEW'].includes(rfq.status) && (
            <form className="item-row" onSubmit={invite}>
              <label>
                Supplier
                <Select name="supplierId" required>
                  {suppliers.items.map((s) => (
                    <option key={text(s.id)} value={text(s.id)}>
                      {text(s.legal_name)} — {text(s.status)} / {text(s.qualification_status)}
                    </option>
                  ))}
                </Select>
              </label>
              <label>
                Supplier contact ID
                <Input name="supplierContactId" />
              </label>
              <label>
                Expires at
                <Input type="datetime-local" name="expiresAt" required />
              </label>
              <Button>Add invitation</Button>
            </form>
          )}
      </section>
      <section>
        <h3>Clarifications</h3>
        {clarifications.length === 0 ? (
          <EmptyState
            title="No clarification threads exist"
            description="No persisted public or private clarification records were returned."
          />
        ) : (
          clarifications.map((c) => (
            <article className="card" key={text(c.id)}>
              <strong>
                {text(c.subject)} — {text(c.visibility)}
              </strong>
              <pre>{JSON.stringify(c.messages, null, 2)}</pre>
            </article>
          ))
        )}
      </section>
      <section>
        <h3>Quotations</h3>
        {quotations.total === 0 ? (
          <EmptyState
            title="No submitted quotations exist"
            description="No persisted non-draft quotations were returned."
          />
        ) : (
          <Table>
            <tbody>
              {quotations.items.map((q) => (
                <tr key={text(q.id)}>
                  <td>{text(q.quotation_number)}</td>
                  <td>{text(q.supplier_id)}</td>
                  <td>{text(q.status)}</td>
                  <td>{text(q.currency)}</td>
                  <td>{date(q.submitted_at)}</td>
                  <td>{text(q.current_revision)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </section>
      <section>
        <h3>Files, terms, activity and audit</h3>
        <p>
          Files and terms are shown only when fields are returned by the RFQ detail API.
          Audit-sensitive changes are read from persisted backend records and never generated in the
          browser.
        </p>
      </section>
    </div>
  );
}
