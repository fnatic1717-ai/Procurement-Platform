export type RfqStatus =
  | 'DRAFT'
  | 'READY_FOR_REVIEW'
  | 'PUBLISHED'
  | 'CLARIFICATION_OPEN'
  | 'QUOTATION_OPEN'
  | 'QUOTATION_CLOSED'
  | 'CANCELLED'
  | 'CLOSED';
export type Permission =
  | 'rfqs.read'
  | 'rfqs.create'
  | 'rfqs.update_draft'
  | 'rfqs.publish'
  | 'rfqs.extend_deadline'
  | 'rfqs.cancel'
  | 'rfqs.close'
  | 'rfq_invitations.manage'
  | 'rfq_clarifications.manage'
  | 'quotations.read'
  | 'quotations.read_commercial'
  | 'suppliers.read';
export interface Session {
  userId: string;
  tenantId: string;
  actorType: string;
  role: string;
  permissions: string[];
  activeMembership: boolean;
}
export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}
export interface RfqListItem {
  id: string;
  rfq_number: string;
  title: string;
  status: RfqStatus;
  procurement_category: string;
  buyer_id: string;
  currency: string;
  clarification_deadline: string;
  submission_deadline: string;
  created_at: string;
  updated_at: string;
  version: number;
}
export interface RfqLine {
  id: string;
  description: string;
  item_type: 'goods' | 'services';
  quantity: string;
  unit_of_measure: string;
  specifications: string;
  required_by: string;
  delivery_location: string;
  category: string;
  line_sequence: number;
  version: number;
}
export interface Invitation {
  id: string;
  supplier_id: string;
  supplier_contact_id?: string | null;
  supplierLegalName?: string;
  supplierContactName?: string;
  status: string;
  expires_at: string;
  sent_at?: string | null;
  revoked_at?: string | null;
  version: number;
}
export interface RfqDetail extends RfqListItem {
  required_by: string;
  delivery_location: string;
  commercial_terms?: string | null;
  payment_terms?: string | null;
  confidentiality_instructions?: string | null;
  lines: RfqLine[];
  invitations: Invitation[];
  allowed_transitions?: RfqStatus[];
}
export interface SupplierContact {
  id: string;
  full_name: string;
  email?: string | null;
  active: boolean;
  supplier_id: string;
}
export interface Supplier {
  id: string;
  supplier_number: string;
  legal_name: string;
  status: string;
  qualification_status: string;
  country: string;
  default_currency: string;
  contacts?: SupplierContact[];
  version: number;
}
export interface ClarificationMessage {
  id: string;
  body: string;
  visibility: 'PRIVATE' | 'PUBLIC';
  author_id?: string;
  author_supplier_id?: string | null;
  published_at?: string;
  publishedAt?: string;
  buyerAuthored?: boolean;
}
export interface ClarificationThread {
  id: string;
  subject: string;
  visibility: 'PRIVATE' | 'PUBLIC';
  status: string;
  requesting_supplier_id?: string | null;
  created_at?: string;
  messages: ClarificationMessage[];
}
export interface Quotation {
  id: string;
  quotation_number: string;
  supplier_id: string;
  supplierLegalName?: string;
  supplier_legal_name?: string;
  status: string;
  currency?: string;
  total_amount?: string;
  tax_amount?: string;
  submitted_at?: string;
  withdrawn_at?: string;
  withdrawal_reason?: string;
  current_revision: number;
  lines?: QuotationLine[];
  history?: QuotationRevision[];
}
export interface QuotationLine {
  id: string;
  rfqLineId?: string;
  rfq_line_id?: string;
  offeredDescription?: string;
  offered_description?: string;
  quantity?: string;
  unit_of_measure?: string;
  unitPrice?: string;
  unit_price?: string;
  discount?: string;
  tax?: string;
  complianceResponse?: string;
  compliance_response?: string;
}
export interface QuotationRevision {
  revisionNumber?: number;
  revision_number?: number;
  submittedAt?: string;
  submitted_at?: string;
}
export interface AuditEvent {
  id: string;
  action: string;
  actor_id?: string;
  actor_type: string;
  object_type: string;
  object_id: string;
  prior_state: unknown;
  resulting_state: unknown;
  created_at: string;
}
export interface OverviewQueue {
  count: number;
  records: RfqListItem[];
}
export interface RfqOverview {
  drafts: OverviewQueue;
  readyForReview: OverviewQueue;
  clarificationOpen: OverviewQueue;
  quotationOpen: OverviewQueue;
  readyToClose: OverviewQueue;
  recentlyUpdated: OverviewQueue;
}

export interface TenantMembershipOption {
  id: string;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  memberType: string;
}
