# Local Development

## Prerequisites

- Node.js 22.
- pnpm 10.
- Docker and Docker Compose.

## Setup

```bash
cp .env.example .env
pnpm install
docker compose up -d
pnpm db:migrate
pnpm test
pnpm test:integration
pnpm dev
```

## Services

- API: `http://localhost:3001/v1/health`.
- Web: `http://localhost:3000`.
- PostgreSQL: `localhost:5432`.
- Redis: `localhost:6379`.

Local credentials are placeholders only and must not be reused outside local development.

## Phase 2A migration and verification

After pulling Phase 2A, run `pnpm db:generate` and `pnpm db:migrate`. Configure at least one active approval policy and active approver membership before submitting a request; submission intentionally fails closed when no valid route exists. Development bearer identities must be registered through trusted development fixtures and are never accepted as permissions from request headers.
