# Tenant Isolation

Phase 1 uses shared PostgreSQL infrastructure with mandatory tenant discrimination and database-enforced Row-Level Security.

## Database rules
- Every tenant-owned table includes `tenant_id`.
- Tenant-owned role permissions include `tenant_id`; global platform permissions and platform roles are modeled separately.
- Composite tenant-aware foreign keys prevent cross-tenant role assignments, file links, organization hierarchies, and membership references.
- PostgreSQL enums constrain tenant status, actor type, membership status, membership type, file upload state, scan status, and file classification.
- RLS policies compare each row's `tenant_id` with `current_setting('app.current_tenant_id', true)` and deny access when tenant context is absent.

## Application rules
Tenant context is set inside a database transaction after authentication and tenant membership authorization. The application must not trust a tenant ID from request headers or request bodies without validating the user's active membership.

## Verification
The integration test suite applies the real SQL migration to PostgreSQL and proves allowed same-tenant operations, denied cross-tenant reads/writes/updates/deletes, denied absent and invalid tenant context, append-only audit behavior, cross-tenant FileLink denial, and cross-tenant role-assignment denial.
