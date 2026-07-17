# Authorization Model

Authorization is deny-by-default and enforced server-side.

## Authentication

The API uses an injectable `AuthProvider` selected by validated configuration. Development authentication is only valid for development and test, and it does not accept caller-supplied permissions. Production configuration must use Auth0 and fails validation when Auth0 settings are incomplete.

## Permission loading

A principal's permissions are loaded from trusted membership, role, and permission sources. The development/test policy service uses controlled fixtures for tests; production wiring must load the same shape from database role assignments.

## Guards and decorators

Reusable permission decorators mark protected handlers, and NestJS authentication and authorization guards enforce authentication, active tenant membership, permissions, and tenant scope. Health endpoints are explicitly public.

## Segregation of duties

Reusable policy hooks prevent requester self-approval and buyer self-approval by default. Overrides require an enabled tenant policy, written justification, an independent authorized approver, and immutable audit logging.

## Phase 2A permission matrix

| Capability           | Permission                                                  | Object rule                                                            |
| -------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------- |
| Create a draft       | `purchase_requests.create`                                  | Requester is always the authenticated actor.                           |
| Read requests        | `purchase_requests.read_own` / `purchase_requests.read_all` | Own records unless tenant-wide read is granted.                        |
| Edit lines or header | `purchase_requests.update_own_draft`                        | Own `DRAFT` or `RETURNED_TO_REQUESTER` record only.                    |
| Submit/resubmit      | `purchase_requests.submit`                                  | Own editable request with a valid independent route.                   |
| Withdraw             | `purchase_requests.withdraw`                                | Own eligible request only.                                             |
| Read/act on approval | `approvals.read_assigned` / `approvals.act`                 | Current pending step, same tenant, active member, never self-approval. |
| Read/assign intake   | `procurement_intake.read` / `procurement_intake.assign`     | Same tenant; buyer must be an active internal member.                  |
| Manage policies      | `approval_policies.manage`                                  | Tenant policy and tenant-safe approver references only.                |
