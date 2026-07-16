CREATE TYPE purchase_request_status AS ENUM ('DRAFT','SUBMITTED','PENDING_APPROVAL','RETURNED_TO_REQUESTER','REJECTED','APPROVED','WITHDRAWN','CANCELLED','IN_PROCUREMENT_REVIEW');
CREATE TYPE purchase_item_type AS ENUM ('goods','services');
CREATE TYPE purchase_priority AS ENUM ('low','normal','high','urgent');
CREATE TYPE approval_decision AS ENUM ('pending','approved','rejected','returned');
CREATE TYPE intake_status AS ENUM ('unassigned','assigned','in_review','closed');

CREATE TABLE tenant_number_sequences (tenant_id uuid NOT NULL REFERENCES tenants(id), sequence_name text NOT NULL, next_value bigint NOT NULL DEFAULT 1 CHECK(next_value>0), PRIMARY KEY(tenant_id,sequence_name));
CREATE TABLE purchase_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id), request_number text NOT NULL, requester_id uuid NOT NULL,
 legal_entity text NOT NULL, department text NOT NULL, cost_center text NOT NULL, delivery_location text NOT NULL, procurement_category text NOT NULL,
 title text NOT NULL, business_justification text NOT NULL, currency char(3) NOT NULL CHECK(currency=upper(currency)), estimated_total numeric(20,4) NOT NULL DEFAULT 0 CHECK(estimated_total>=0), required_by date NOT NULL,
 priority purchase_priority NOT NULL DEFAULT 'normal', internal_notes text, status purchase_request_status NOT NULL DEFAULT 'DRAFT', version integer NOT NULL DEFAULT 1 CHECK(version>0),
 submitted_at timestamptz, final_approved_at timestamptz, withdrawn_at timestamptz, withdrawn_by uuid, withdrawal_reason text, cancelled_at timestamptz, cancelled_by uuid, cancellation_reason text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id,id), UNIQUE(tenant_id,request_number),
 FOREIGN KEY(tenant_id,requester_id) REFERENCES tenant_memberships(tenant_id,user_id));
CREATE INDEX purchase_requests_owner_status_idx ON purchase_requests(tenant_id,requester_id,status);
CREATE INDEX purchase_requests_queue_idx ON purchase_requests(tenant_id,status,required_by);

CREATE TABLE purchase_request_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, purchase_request_id uuid NOT NULL, description text NOT NULL, item_type purchase_item_type NOT NULL,
 quantity numeric(20,6) NOT NULL CHECK(quantity>0), unit_of_measure text NOT NULL, estimated_unit_price numeric(20,4) NOT NULL CHECK(estimated_unit_price>=0),
 estimated_line_total numeric(20,4) GENERATED ALWAYS AS (round(quantity*estimated_unit_price,4)) STORED, category text NOT NULL, specifications text NOT NULL,
 required_by date NOT NULL, delivery_location text NOT NULL, suggested_supplier_name text, accounting_dimensions jsonb NOT NULL DEFAULT '{}', version integer NOT NULL DEFAULT 1 CHECK(version>0),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id,id), FOREIGN KEY(tenant_id,purchase_request_id) REFERENCES purchase_requests(tenant_id,id) ON DELETE RESTRICT);
CREATE INDEX purchase_request_items_request_idx ON purchase_request_items(tenant_id,purchase_request_id);

CREATE TABLE approval_policies (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id), name text NOT NULL, active boolean NOT NULL DEFAULT true, priority integer NOT NULL DEFAULT 100,
 min_amount numeric(20,4), max_amount numeric(20,4), department text, legal_entity text, procurement_category text, currency char(3), request_priority purchase_priority,
 version integer NOT NULL DEFAULT 1, created_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id,id),
 FOREIGN KEY(tenant_id,created_by) REFERENCES tenant_memberships(tenant_id,user_id), CHECK(min_amount IS NULL OR max_amount IS NULL OR min_amount<=max_amount));
CREATE INDEX approval_policies_resolution_idx ON approval_policies(tenant_id,active,priority);
CREATE TABLE approval_policy_steps (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, policy_id uuid NOT NULL, step_number integer NOT NULL CHECK(step_number>0), approver_user_id uuid, approver_role_id uuid,
 required_permission text NOT NULL, min_threshold numeric(20,4), max_threshold numeric(20,4), active boolean NOT NULL DEFAULT true, escalation_after_hours integer CHECK(escalation_after_hours>0),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id,id), UNIQUE(tenant_id,policy_id,step_number),
 FOREIGN KEY(tenant_id,policy_id) REFERENCES approval_policies(tenant_id,id), FOREIGN KEY(tenant_id,approver_user_id) REFERENCES tenant_memberships(tenant_id,user_id), FOREIGN KEY(tenant_id,approver_role_id) REFERENCES roles(tenant_id,id),
 CHECK((approver_user_id IS NOT NULL)::int+(approver_role_id IS NOT NULL)::int=1));

CREATE TABLE purchase_request_approval_instances (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, purchase_request_id uuid NOT NULL, policy_id uuid NOT NULL, policy_version integer NOT NULL, route_snapshot jsonb NOT NULL,
 submission_key text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz, UNIQUE(tenant_id,id), UNIQUE(tenant_id,purchase_request_id,submission_key),
 FOREIGN KEY(tenant_id,purchase_request_id) REFERENCES purchase_requests(tenant_id,id), FOREIGN KEY(tenant_id,policy_id) REFERENCES approval_policies(tenant_id,id));
CREATE INDEX approval_instances_request_idx ON purchase_request_approval_instances(tenant_id,purchase_request_id);
CREATE TABLE purchase_request_approval_steps (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, instance_id uuid NOT NULL, step_number integer NOT NULL, approver_user_id uuid, approver_role_id uuid, required_permission text NOT NULL,
 decision approval_decision NOT NULL DEFAULT 'pending', decision_by uuid, decision_at timestamptz, comment text, idempotency_key text, version integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id,id), UNIQUE(tenant_id,instance_id,step_number), UNIQUE(tenant_id,idempotency_key),
 FOREIGN KEY(tenant_id,instance_id) REFERENCES purchase_request_approval_instances(tenant_id,id), FOREIGN KEY(tenant_id,approver_user_id) REFERENCES tenant_memberships(tenant_id,user_id), FOREIGN KEY(tenant_id,approver_role_id) REFERENCES roles(tenant_id,id), FOREIGN KEY(tenant_id,decision_by) REFERENCES tenant_memberships(tenant_id,user_id));
CREATE INDEX approval_inbox_idx ON purchase_request_approval_steps(tenant_id,approver_user_id,decision);

CREATE TABLE procurement_intake_records (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, purchase_request_id uuid NOT NULL, status intake_status NOT NULL DEFAULT 'unassigned', current_buyer_id uuid, version integer NOT NULL DEFAULT 1,
 received_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id,id), UNIQUE(tenant_id,purchase_request_id),
 FOREIGN KEY(tenant_id,purchase_request_id) REFERENCES purchase_requests(tenant_id,id), FOREIGN KEY(tenant_id,current_buyer_id) REFERENCES tenant_memberships(tenant_id,user_id));
CREATE INDEX procurement_intake_queue_idx ON procurement_intake_records(tenant_id,status,received_at);
CREATE TABLE buyer_assignments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, intake_record_id uuid NOT NULL, buyer_id uuid NOT NULL, assigned_by uuid NOT NULL, reason text NOT NULL,
 effective_from timestamptz NOT NULL DEFAULT now(), effective_until timestamptz, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id,id),
 FOREIGN KEY(tenant_id,intake_record_id) REFERENCES procurement_intake_records(tenant_id,id), FOREIGN KEY(tenant_id,buyer_id) REFERENCES tenant_memberships(tenant_id,user_id), FOREIGN KEY(tenant_id,assigned_by) REFERENCES tenant_memberships(tenant_id,user_id));
CREATE INDEX buyer_assignment_history_idx ON buyer_assignments(tenant_id,intake_record_id,effective_until);

CREATE OR REPLACE FUNCTION next_tenant_request_number(p_tenant_id uuid) RETURNS text LANGUAGE plpgsql SECURITY INVOKER AS $$ DECLARE n bigint; BEGIN
 INSERT INTO tenant_number_sequences(tenant_id,sequence_name,next_value) VALUES(p_tenant_id,'purchase_request',1)
 ON CONFLICT(tenant_id,sequence_name) DO UPDATE SET next_value=tenant_number_sequences.next_value+1 RETURNING next_value INTO n; RETURN 'PR-'||to_char(n,'FM000000'); END $$;

INSERT INTO permissions(code,description,platform_scope) VALUES
('purchase_requests.create','Create purchase request drafts',false),('purchase_requests.read_own','Read own purchase requests',false),('purchase_requests.read_all','Read all tenant purchase requests',false),
('purchase_requests.update_own_draft','Update own editable purchase requests',false),('purchase_requests.submit','Submit and resubmit own purchase requests',false),('purchase_requests.withdraw','Withdraw eligible own purchase requests',false),
('approvals.read_assigned','Read assigned approvals',false),('approvals.act','Act on the current assigned approval step',false),('procurement_intake.read','Read procurement intake queue',false),
('procurement_intake.assign','Assign active tenant buyers',false),('approval_policies.manage','Manage tenant approval policies',false);

DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['purchase_requests','purchase_request_items','approval_policies','approval_policy_steps','purchase_request_approval_instances','purchase_request_approval_steps','procurement_intake_records','buyer_assignments','tenant_number_sequences'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t); EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (tenant_id=current_tenant_id()) WITH CHECK (tenant_id=current_tenant_id())',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['purchase_requests','purchase_request_items','approval_policies','approval_policy_steps','purchase_request_approval_steps','procurement_intake_records'] LOOP
  EXECUTE format('CREATE TRIGGER %I_set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()',t,t);
 END LOOP;
END $$;

CREATE OR REPLACE FUNCTION prevent_approval_snapshot_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'approval route snapshots are immutable'; END $$;
CREATE TRIGGER approval_instance_immutable BEFORE UPDATE OR DELETE ON purchase_request_approval_instances FOR EACH ROW EXECUTE FUNCTION prevent_approval_snapshot_mutation();
