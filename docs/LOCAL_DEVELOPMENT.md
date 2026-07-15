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
