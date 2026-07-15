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
