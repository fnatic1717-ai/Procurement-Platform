CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE tenant_status AS ENUM ('active', 'suspended', 'archived');
CREATE TYPE actor_type AS ENUM ('internal_user', 'supplier_user', 'platform_admin', 'system');
CREATE TYPE membership_status AS ENUM ('active', 'inactive', 'invited', 'locked');
CREATE TYPE membership_type AS ENUM ('internal', 'supplier');
CREATE TYPE file_upload_state AS ENUM ('pending', 'scanning', 'clean', 'rejected', 'deleted');
CREATE TYPE file_scan_status AS ENUM ('pending', 'scanning', 'clean', 'infected', 'failed');
CREATE TYPE file_classification AS ENUM ('internal', 'supplier_visible', 'restricted');

CREATE TABLE tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  status tenant_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  display_name text NOT NULL,
  subject text UNIQUE,
  actor_type actor_type NOT NULL DEFAULT 'internal_user',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE tenant_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL UNIQUE REFERENCES tenants(id),
  settings jsonb NOT NULL DEFAULT '{}',
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE tenant_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  user_id uuid NOT NULL REFERENCES users(id),
  status membership_status NOT NULL DEFAULT 'active',
  member_type membership_type NOT NULL DEFAULT 'internal',
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id)
);
CREATE INDEX tenant_memberships_tenant_status_idx ON tenant_memberships(tenant_id, status);

CREATE TABLE platform_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  description text NOT NULL,
  platform_scope boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  code text NOT NULL,
  name text NOT NULL,
  description text,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code),
  UNIQUE (tenant_id, id)
);

CREATE TABLE role_permissions (
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  role_id uuid NOT NULL,
  permission_id uuid NOT NULL REFERENCES permissions(id),
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, role_id, permission_id),
  FOREIGN KEY (tenant_id, role_id) REFERENCES roles(tenant_id, id)
);

CREATE TABLE user_role_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  user_id uuid NOT NULL REFERENCES users(id),
  role_id uuid NOT NULL,
  scope_type text NOT NULL DEFAULT 'tenant',
  scope_id uuid,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id, role_id, scope_type, scope_id),
  FOREIGN KEY (tenant_id, user_id) REFERENCES tenant_memberships(tenant_id, user_id),
  FOREIGN KEY (tenant_id, role_id) REFERENCES roles(tenant_id, id)
);
CREATE INDEX user_role_assignments_tenant_user_idx ON user_role_assignments(tenant_id, user_id);

CREATE TABLE organization_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  code text NOT NULL,
  name text NOT NULL,
  parent_id uuid,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, parent_id) REFERENCES organization_units(tenant_id, id)
);

CREATE TABLE cost_centers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  code text NOT NULL,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code),
  UNIQUE (tenant_id, id)
);

CREATE TABLE locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  code text NOT NULL,
  name text NOT NULL,
  address jsonb,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code),
  UNIQUE (tenant_id, id)
);

CREATE TABLE audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id),
  actor_id uuid REFERENCES users(id),
  actor_type actor_type NOT NULL DEFAULT 'system',
  action text NOT NULL,
  object_type text NOT NULL,
  object_id uuid,
  correlation_id text NOT NULL,
  request_context jsonb NOT NULL DEFAULT '{}',
  metadata jsonb,
  prior_state jsonb,
  resulting_state jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_events_tenant_created_idx ON audit_events(tenant_id, created_at);
CREATE INDEX audit_events_correlation_idx ON audit_events(correlation_id);

CREATE TABLE file_objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  storage_key text NOT NULL UNIQUE,
  filename text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL CHECK (size_bytes >= 0),
  checksum_sha256 text NOT NULL,
  uploader_id uuid NOT NULL REFERENCES users(id),
  classification file_classification NOT NULL,
  upload_state file_upload_state NOT NULL DEFAULT 'pending',
  scan_status file_scan_status NOT NULL DEFAULT 'pending',
  retention_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id)
);
CREATE INDEX file_objects_tenant_state_idx ON file_objects(tenant_id, upload_state, scan_status);

CREATE TABLE file_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  file_object_id uuid NOT NULL,
  object_type text NOT NULL,
  object_id uuid NOT NULL,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id, file_object_id) REFERENCES file_objects(tenant_id, id),
  UNIQUE (tenant_id, file_object_id, object_type, object_id)
);
CREATE INDEX file_links_tenant_object_idx ON file_links(tenant_id, object_type, object_id);

CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION prevent_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_events are append-only';
END;
$$;
CREATE TRIGGER audit_events_no_update BEFORE UPDATE OR DELETE ON audit_events FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['tenants','users','tenant_settings','tenant_memberships','platform_roles','roles','organization_units','cost_centers','locations','file_objects'] LOOP
    EXECUTE format('CREATE TRIGGER %I_set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t, t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['tenant_settings','tenant_memberships','roles','role_permissions','user_role_assignments','organization_units','cost_centers','locations','audit_events','file_objects','file_links'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (tenant_id = current_tenant_id()) WITH CHECK (tenant_id = current_tenant_id())', t);
  END LOOP;
END $$;

INSERT INTO permissions(code, description, platform_scope) VALUES
  ('tenant.manage', 'Manage tenant platform foundation settings', false),
  ('tenant.members.manage', 'Manage tenant memberships', false),
  ('roles.manage', 'Manage tenant roles and permission assignments', false),
  ('audit.read', 'Read tenant audit events', false),
  ('files.read', 'Read authorized tenant file metadata', false),
  ('files.restricted.read', 'Read restricted tenant file metadata after object-scope authorization', false),
  ('files.write', 'Create authorized tenant file metadata', false),
  ('platform.tenants.manage', 'Manage platform tenant provisioning without tenant business data access', true);
