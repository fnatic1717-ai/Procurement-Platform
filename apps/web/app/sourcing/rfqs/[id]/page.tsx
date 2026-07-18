'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Button,
  ErrorState,
  Input,
  LoadingState,
  Select,
  StatusBadge,
  Table,
} from '@procurement/ui';
import {
  addLine,
  answerClarification,
  ApiError,
  cancelRfq,
  closeClarification,
  closeRfq,
  deleteLine,
  extendDeadline,
  getRfq,
  getSupplier,
  inviteSupplier,
  listAudit,
  listClarifications,
  listQuotations,
  listSuppliers,
  revokeInvitation,
  transitionRfq,
  updateLine,
  updateRfq,
} from '../../../lib/api';
import { IdempotencyStore } from '../../../lib/idempotency';
import { useSession } from '../../../lib/session';
import type {
  AuditEvent,
  ClarificationThread,
  PageResult,
  Quotation,
  RfqDetail,
  RfqLine,
  RfqStatus,
  Supplier,
} from '../../../lib/types';
const text = (v: unknown) => (v == null ? '' : String(v));
export default function RfqDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { can, session } = useSession();
  const [rfq, setRfq] = useState<RfqDetail | null>(null);
  const [quotations, setQuotations] = useState<PageResult<Quotation> | null>(null);
  const [clarifications, setClarifications] = useState<ClarificationThread[]>([]);
  const [audit, setAudit] = useState<PageResult<AuditEvent> | null>(null);
  const [suppliers, setSuppliers] = useState<PageResult<Supplier> | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(true);
  const [mutationBusy, setMutationBusy] = useState(false);
  const idStore = useRef(new IdempotencyStore());
  const refresh = async () => {
    const r = await getRfq(id);
    setRfq(r);
    if (can('quotations.read')) setQuotations(await listQuotations(id));
    if (can('rfq_clarifications.manage')) setClarifications(await listClarifications(id));
    setAudit(await listAudit(id));
  };
  useEffect(() => {
    refresh()
      .catch((e) => e instanceof ApiError && setError(e))
      .finally(() => setBusy(false));
  }, [id]);
  const actions = useMemo(() => {
    if (!rfq) return [] as RfqStatus[];
    const map: Partial<Record<RfqStatus, RfqStatus[]>> = {
      DRAFT: ['READY_FOR_REVIEW'],
      READY_FOR_REVIEW: ['PUBLISHED'],
      PUBLISHED: ['CLARIFICATION_OPEN', 'QUOTATION_OPEN'],
      CLARIFICATION_OPEN: ['QUOTATION_OPEN'],
      QUOTATION_OPEN: ['QUOTATION_CLOSED'],
    };
    return can('rfqs.publish') ? (map[rfq.status] ?? []) : [];
  }, [rfq, can]);
  async function mutate(
    operation: string,
    payload: Record<string, unknown>,
    fn: (body: unknown) => Promise<unknown>,
    idempotent = true,
  ) {
    if (mutationBusy) return;
    const prepared = idempotent ? idStore.current.prepare(operation, payload) : null;
    if (idempotent && !prepared) return;
    setMutationBusy(true);
    setError(null);
    try {
      await fn(idempotent ? { ...payload, idempotencyKey: prepared!.key } : payload);
      if (idempotent) idStore.current.finish(operation, true);
      await refresh();
    } catch (e) {
      if (idempotent) idStore.current.finish(operation, false);
      if (e instanceof ApiError) setError(e);
    } finally {
      setMutationBusy(false);
    }
  }
  if (busy) return <LoadingState label="Loading persisted RFQ workspace" />;
  if (error) return <ErrorState title={error.kind} description={error.message} />;
  if (!rfq)
    return <ErrorState title="Not found" description="The RFQ was not returned by the API." />;
  return (
    <div className="detail">
      <h3>
        {rfq.rfq_number} — {rfq.title}
      </h3>
      <dl>
        <dt>Status</dt>
        <dd>
          <StatusBadge>{rfq.status}</StatusBadge>
        </dd>
        <dt>Owner</dt>
        <dd>{rfq.buyer_id}</dd>
        <dt>Currency</dt>
        <dd>{rfq.currency}</dd>
        <dt>Version</dt>
        <dd>{rfq.version}</dd>
        <dt>Clarification deadline</dt>
        <dd>{new Date(rfq.clarification_deadline).toLocaleString()}</dd>
        <dt>Quotation deadline</dt>
        <dd>{new Date(rfq.submission_deadline).toLocaleString()}</dd>
        <dt>Created</dt>
        <dd>{new Date(rfq.created_at).toLocaleString()}</dd>
        <dt>Updated</dt>
        <dd>{new Date(rfq.updated_at).toLocaleString()}</dd>
      </dl>
      {can('rfqs.update_draft') && ['DRAFT', 'READY_FOR_REVIEW'].includes(rfq.status) && (
        <HeaderForm
          rfq={rfq}
          onSave={async (body) => {
            await mutate(
              'header:update',
              { ...(body as Record<string, unknown>), version: rfq.version },
              (payload) => updateRfq(rfq.id, payload),
              false,
            );
          }}
        />
      )}
      <section>
        <h3>Lifecycle actions</h3>
        {actions.map((to) => (
          <Button
            key={to}
            disabled={mutationBusy}
            onClick={() =>
              void mutate(
                `transition:${rfq.id}:${to}`,
                { status: to, version: rfq.version },
                (body) => transitionRfq(rfq.id, body),
              )
            }
          >
            {rfq.status} → {to}
          </Button>
        ))}
        {can('rfqs.close') && rfq.status === 'QUOTATION_CLOSED' && (
          <ReasonAction
            label="Close RFQ"
            onSubmit={(reason) =>
              mutate(`close:${rfq.id}`, { version: rfq.version, reason }, (body) =>
                closeRfq(rfq.id, body),
              )
            }
          />
        )}{' '}
        {can('rfqs.cancel') && !['CANCELLED', 'CLOSED'].includes(rfq.status) && (
          <ReasonAction
            label="Cancel RFQ"
            onSubmit={(reason) =>
              mutate(`cancel:${rfq.id}:${reason}`, { version: rfq.version, reason }, (body) =>
                cancelRfq(rfq.id, body),
              )
            }
          />
        )}{' '}
        {can('rfqs.extend_deadline') &&
          ['PUBLISHED', 'CLARIFICATION_OPEN', 'QUOTATION_OPEN'].includes(rfq.status) && (
            <DeadlineAction
              rfq={rfq}
              onSubmit={(body) =>
                mutate(
                  `deadline:${rfq.id}:${JSON.stringify(body)}`,
                  { ...body, version: rfq.version },
                  (payload) => extendDeadline(rfq.id, payload),
                )
              }
            />
          )}
      </section>
      <Lines
        rfq={rfq}
        canEdit={can('rfqs.update_draft') && rfq.status === 'DRAFT'}
        mutate={mutate}
        mutationBusy={mutationBusy}
      />
      <section>
        <h3>Suppliers and invitations</h3>
        <div className="toolbar">
          {can('rfq_invitations.manage') && (
            <Button
              onClick={async () =>
                setSuppliers(await listSuppliers(new URLSearchParams('limit=20')))
              }
            >
              Search suppliers
            </Button>
          )}
        </div>
        {can('rfq_invitations.manage') && suppliers && (
          <form
            className="item-row"
            onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const supplierId = text(fd.get('supplierId'));
              if (!supplierId) return;
              await mutate(
                'invitation:create',
                {
                  supplierId,
                  supplierContactId: text(fd.get('supplierContactId')) || undefined,
                  expiresAt: text(fd.get('expiresAt')),
                },
                (payload) => inviteSupplier(rfq.id, payload),
                false,
              );
            }}
          >
            <label>
              Supplier
              <Select
                name="supplierId"
                defaultValue=""
                required
                onChange={async (e) => {
                  setSelectedSupplier(null);
                  if (e.target.value) setSelectedSupplier(await getSupplier(e.target.value));
                }}
              >
                <option value="">Select supplier</option>
                {suppliers.items.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.legal_name} — {s.status}/{s.qualification_status}
                  </option>
                ))}
              </Select>
            </label>

            <label>
              Contact
              <Select name="supplierContactId">
                <option value="">No contact</option>
                {selectedSupplier?.contacts
                  ?.filter((c) => c.active)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.full_name} {c.email}
                    </option>
                  ))}
              </Select>
            </label>
            <label>
              Expires at
              <Input name="expiresAt" type="datetime-local" required />
            </label>
            <Button>Add invitation</Button>
          </form>
        )}
        <Table>
          <tbody>
            {rfq.invitations.map((i) => (
              <tr key={i.id}>
                <td>{i.supplierLegalName ?? i.supplier_id}</td>
                <td>{i.supplierContactName ?? 'No contact'}</td>
                <td>{i.status}</td>
                <td>{text(i.sent_at)}</td>
                <td>
                  {can('rfq_invitations.manage') && (
                    <ReasonAction
                      label="Revoke"
                      onSubmit={(reason) =>
                        mutate(`revoke:${i.id}:${reason}`, { version: i.version, reason }, (body) =>
                          revokeInvitation(rfq.id, i.id, body),
                        )
                      }
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </section>
      <Clarifications
        threads={clarifications}
        canManage={can('rfq_clarifications.manage')}
        mutate={mutate}
        refresh={refresh}
      />
      <Quotations
        data={quotations}
        commercial={Boolean(session?.permissions.includes('quotations.read_commercial'))}
      />
      <Terms rfq={rfq} />
      <Audit data={audit} />
    </div>
  );
}
function HeaderForm({
  rfq,
  onSave,
}: {
  rfq: RfqDetail;
  onSave: (body: Record<string, string>) => Promise<void>;
}) {
  return (
    <form
      className="item-row"
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        await onSave({
          title: text(fd.get('title')),
          procurementCategory: text(fd.get('procurementCategory')),
          currency: text(fd.get('currency')),
          clarificationDeadline: text(fd.get('clarificationDeadline')),
          submissionDeadline: text(fd.get('submissionDeadline')),
          requiredBy: text(fd.get('requiredBy')),
          deliveryLocation: text(fd.get('deliveryLocation')),
        });
      }}
    >
      <h3>Edit RFQ header</h3>
      <label>
        Title
        <Input name="title" defaultValue={rfq.title} />
      </label>
      <label>
        Category
        <Input name="procurementCategory" defaultValue={rfq.procurement_category} />
      </label>
      <label>
        Currency
        <Input name="currency" defaultValue={rfq.currency} />
      </label>
      <label>
        Clarification deadline
        <Input
          name="clarificationDeadline"
          type="datetime-local"
          defaultValue={rfq.clarification_deadline.slice(0, 16)}
        />
      </label>
      <label>
        Quotation deadline
        <Input
          name="submissionDeadline"
          type="datetime-local"
          defaultValue={rfq.submission_deadline.slice(0, 16)}
        />
      </label>
      <label>
        Required by
        <Input name="requiredBy" type="date" defaultValue={rfq.required_by?.slice(0, 10)} />
      </label>
      <label>
        Delivery location
        <Input name="deliveryLocation" defaultValue={rfq.delivery_location} />
      </label>
      <Button>Save header</Button>
    </form>
  );
}
function Lines({
  rfq,
  canEdit,
  mutate,
  mutationBusy,
}: {
  rfq: RfqDetail;
  canEdit: boolean;
  mutate: (
    operation: string,
    payload: Record<string, unknown>,
    fn: (body: unknown) => Promise<unknown>,
    idempotent?: boolean,
  ) => Promise<void>;
  mutationBusy: boolean;
}) {
  const blank = {
    description: '',
    itemType: 'goods',
    quantity: '1',
    unitOfMeasure: 'EA',
    specifications: '',
    requiredBy: rfq.required_by?.slice(0, 10),
    deliveryLocation: rfq.delivery_location,
    category: rfq.procurement_category,
  };
  const form = (line?: RfqLine) => (
    <form
      className="item-row"
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const body = {
          description: text(fd.get('description')),
          itemType: text(fd.get('itemType')),
          quantity: text(fd.get('quantity')),
          unitOfMeasure: text(fd.get('unitOfMeasure')),
          specifications: text(fd.get('specifications')),
          requiredBy: text(fd.get('requiredBy')),
          deliveryLocation: text(fd.get('deliveryLocation')),
          category: text(fd.get('category')),
          lineSequence: Number(fd.get('lineSequence')),
          version: line?.version,
        };
        if (line)
          await mutate(
            `line:update:${line.id}`,
            body,
            (payload) => updateLine(rfq.id, line.id, payload),
            false,
          );
        else await mutate('line:create', body, (payload) => addLine(rfq.id, payload), false);
      }}
    >
      <label>
        Description
        <Input name="description" defaultValue={line?.description ?? blank.description} />
      </label>
      <label>
        Type
        <Select name="itemType" defaultValue={line?.item_type ?? blank.itemType}>
          <option value="goods">Goods</option>
          <option value="services">Services</option>
        </Select>
      </label>
      <label>
        Quantity
        <Input name="quantity" defaultValue={line?.quantity ?? blank.quantity} />
      </label>
      <label>
        Unit
        <Input name="unitOfMeasure" defaultValue={line?.unit_of_measure ?? blank.unitOfMeasure} />
      </label>
      <label>
        Category
        <Input name="category" defaultValue={line?.category ?? blank.category} />
      </label>
      <label>
        Required by
        <Input
          name="requiredBy"
          type="date"
          defaultValue={(line?.required_by ?? blank.requiredBy)?.slice(0, 10)}
        />
      </label>
      <label>
        Delivery
        <Input
          name="deliveryLocation"
          defaultValue={line?.delivery_location ?? blank.deliveryLocation}
        />
      </label>
      <label>
        Specifications
        <Input name="specifications" defaultValue={line?.specifications ?? blank.specifications} />
      </label>
      <label>
        Sequence
        <Input
          name="lineSequence"
          type="number"
          defaultValue={line?.line_sequence ?? rfq.lines.length + 1}
        />
      </label>
      <Button disabled={mutationBusy}>{line ? 'Save line' : 'Add line'}</Button>
      {line && (
        <Button
          type="button"
          onClick={() =>
            void mutate(
              `line:delete:${line.id}`,
              { version: line.version },
              () => deleteLine(rfq.id, line.id, line.version),
              false,
            )
          }
        >
          Delete line
        </Button>
      )}
    </form>
  );
  return (
    <section>
      <h3>Lines</h3>
      {rfq.lines.length === 0 ? (
        <p>No persisted RFQ lines exist.</p>
      ) : (
        rfq.lines.map((l) => (
          <article className="card" key={l.id}>
            <strong>
              {l.line_sequence}. {l.description}
            </strong>
            <span>
              {l.quantity} {l.unit_of_measure} — {l.category}
            </span>
            {canEdit && form(l)}
          </article>
        ))
      )}
      {canEdit && form()}
    </section>
  );
}
function ReasonAction({ label, onSubmit }: { label: string; onSubmit: (reason: string) => void }) {
  return (
    <form
      className="inline-action"
      onSubmit={(e) => {
        e.preventDefault();
        const reason = text(new FormData(e.currentTarget).get('reason'));
        if (confirm(`${label}: this action is persisted and audited. Continue?`)) onSubmit(reason);
      }}
    >
      <label>
        {label} reason
        <Input name="reason" required />
      </label>
      <Button>{label}</Button>
    </form>
  );
}
function DeadlineAction({
  rfq,
  onSubmit,
}: {
  rfq: RfqDetail;
  onSubmit: (body: Record<string, string>) => void;
}) {
  return (
    <form
      className="inline-action"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        onSubmit({
          clarificationDeadline: text(fd.get('clarificationDeadline')),
          submissionDeadline: text(fd.get('submissionDeadline')),
          reason: text(fd.get('reason')),
        });
      }}
    >
      <label>
        Clarification deadline
        <Input
          name="clarificationDeadline"
          type="datetime-local"
          defaultValue={rfq.clarification_deadline.slice(0, 16)}
        />
      </label>
      <label>
        Quotation deadline
        <Input
          name="submissionDeadline"
          type="datetime-local"
          defaultValue={rfq.submission_deadline.slice(0, 16)}
        />
      </label>
      <label>
        Reason
        <Input name="reason" required />
      </label>
      <Button>Extend deadlines</Button>
    </form>
  );
}
function Clarifications({
  threads,
  canManage,
  mutate,
}: {
  threads: ClarificationThread[];
  canManage: boolean;
  mutate: (
    o: string,
    p: Record<string, unknown>,
    f: (b: unknown) => Promise<unknown>,
    idempotent?: boolean,
  ) => Promise<void>;
  refresh: () => Promise<void>;
}) {
  return (
    <section>
      <h3>Clarifications</h3>
      {threads.length === 0 && <p>No persisted clarification threads exist.</p>}
      {threads.map((t) => (
        <article className={`card ${t.visibility === 'PRIVATE' ? 'private' : 'public'}`} key={t.id}>
          <strong>
            {t.subject} — {t.visibility} — {t.status}
          </strong>
          {t.messages.map((m) => (
            <p key={m.id}>
              <b>{m.author_supplier_id ? 'Supplier' : 'Internal'}:</b> {m.body}
              <br />
              <small>{text(m.published_at ?? m.publishedAt)}</small>
            </p>
          ))}
          {canManage && t.status === 'OPEN' && (
            <>
              <form
                className="inline-action"
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  void mutate(
                    `clarification-response:${t.id}`,
                    { body: text(fd.get('body')), visibility: text(fd.get('visibility')) },
                    (body) => answerClarification(t.id, body),
                    false,
                  );
                }}
              >
                <label>
                  Response
                  <Input name="body" required />
                </label>
                <label>
                  Visibility
                  <Select name="visibility">
                    <option value="PRIVATE">Private response</option>
                    <option value="PUBLIC">Public clarification</option>
                  </Select>
                </label>
                <Button>Respond</Button>
              </form>
              <Button
                onClick={() =>
                  void mutate(`clarification-close:${t.id}`, {}, (body) =>
                    closeClarification(t.id, body),
                  )
                }
              >
                Close thread
              </Button>
            </>
          )}
        </article>
      ))}
    </section>
  );
}
function Quotations({
  data,
  commercial,
}: {
  data: PageResult<Quotation> | null;
  commercial: boolean;
}) {
  return (
    <section>
      <h3>Quotations</h3>
      {!data || data.total === 0 ? (
        <p>No submitted quotations exist.</p>
      ) : (
        <Table>
          <tbody>
            {data.items.map((q) => (
              <tr key={q.id}>
                <td>{q.quotation_number}</td>
                <td>{q.supplierLegalName ?? q.supplier_id}</td>
                <td>{q.status}</td>
                <td>{commercial ? q.currency : 'Commercial permission required'}</td>
                <td>{q.current_revision}</td>
                <td>{text(q.submitted_at)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </section>
  );
}
function Terms({ rfq }: { rfq: RfqDetail }) {
  return (
    <section>
      <h3>Files and terms</h3>
      <dl>
        <dt>Commercial terms</dt>
        <dd>{rfq.commercial_terms ?? 'Not set'}</dd>
        <dt>Payment terms</dt>
        <dd>{rfq.payment_terms ?? 'Not set'}</dd>
        <dt>Confidentiality instructions</dt>
        <dd>{rfq.confidentiality_instructions ?? 'Not set'}</dd>
      </dl>
    </section>
  );
}
function Audit({ data }: { data: PageResult<AuditEvent> | null }) {
  return (
    <section>
      <h3>Activity and audit</h3>
      {!data || data.total === 0 ? (
        <p>No persisted audit events were returned.</p>
      ) : (
        <ol className="timeline">
          {data.items.map((a) => (
            <li key={a.id}>
              <strong>{a.action}</strong>
              <span>
                {a.actor_type} {a.actor_id} at {new Date(a.created_at).toLocaleString()}
              </span>
              <span>
                {a.object_type} {a.object_id}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
