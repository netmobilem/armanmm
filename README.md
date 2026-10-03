# ViraPanel

**ViraPanel** is a production-grade subscription & configuration management platform:
user management, a pluggable configuration engine (VLESS / VMess / Trojan × WS / HTTP-Up / TCP / gRPC × none / TLS / Reality),
node monitoring through authenticated agents, subscriptions with public token pages, resellers with backend-enforced
isolation, RBAC, audit logging, background workers, and a Persian-first RTL admin UI with English support.

> Temporary product name. Branding is centralized in `packages/shared/src/branding.ts` — rename in one place.

## Quick start (local, no Docker)

Requirements: **Node ≥ 20 only** — storage is a SQLite file on disk (`DATABASE_PATH`,
default `./data/vira.db`); Redis is optional (in-process event bus fallback).

```bash
cp .env.example .env            # edit secrets; optionally DATABASE_PATH / REDIS_URL
npm install
npm run build:packages
npm run db:migrate
npm run db:seed                 # dev-only demo data (see credentials below)

# API + built web UI + embedded worker on :8080
npm run build && npm run start
# optional: simulated node agents (real agent protocol)
npm run dev:agent <token-from-node-page>
```

Dev mode with hot reload: `npm run dev` (API with embedded worker + Vite concurrently).
Run the worker as a separate process instead with `EMBED_WORKER=false npm run start` and
`npm run worker`.

**Development credentials (seeded by `npm run db:seed`, never created in production):**
`owner / Owner@12345`, `admin / Admin@12345`, `reseller / Reseller@12345`, `support / Support@12345`.

OpenAPI (dev only): `http://localhost:8080/docs`.

## Docker

```bash
docker compose up --build      # single api service (embedded worker) + data volume
```

## Railway

See [DEPLOYMENT.md](docs/DEPLOYMENT.md): **one service + one volume** — no Postgres/Redis
plugins required.

## Scripts

| command | purpose |
| --- | --- |
| `npm run dev` | API with embedded worker (tsx watch) + Vite web |
| `npm run build` | build all workspaces (tsc + vite) |
| `npm run start` | production API + embedded worker (serves built web app) |
| `npm run worker` | standalone worker (only when `EMBED_WORKER=false`) |
| `npm run test` | vitest suite (uses `./data/test.db`) |
| `npm run typecheck` | strict TS across workspaces |
| `npm run lint` | ESLint |
| `npm run db:migrate` | apply SQL migrations |
| `npm run db:seed` | development demo data |
| `npm run db:reset` | drop schema, migrate, seed |

## Documentation

- [ARCHITECTURE.md](docs/ARCHITECTURE.md) — system design, modules, data flow
- [API.md](docs/API.md) — REST surface & error contract
- [DATABASE.md](docs/DATABASE.md) — schema & migrations
- [SECURITY.md](docs/SECURITY.md) — threat model & controls
- [DEPLOYMENT.md](docs/DEPLOYMENT.md) — Docker & Railway
- [DEVELOPMENT.md](docs/DEVELOPMENT.md) — contributor workflow
