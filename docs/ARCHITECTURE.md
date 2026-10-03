# Architecture

## High-level topology

```
            ┌──────────────────────────────────────────┐
  browser ─▶│  Single service: web-api (Fastify)        │
            │  /api/v1/* + built SPA + embedded worker  │
            │        │ Drizzle/better-sqlite3           │
            │  ┌─────▼─────────────┐                    │
            │  │ SQLite on volume  │  /app/data/vira.db │
            │  └───────────────────┘                    │
            └──────────────────────────────────────────┘
                  │ (optional) ioredis: cache / pub-sub / job queue
  node agents ─▶ POST /api/v1/agent/heartbeat (Bearer node token)
```

- **web-api** is the only required service: it serves the REST API, the compiled React SPA, and
  runs the background worker in-process (`EMBED_WORKER`, on by default). One Railway service,
  one volume — simple ops and cheap hosting.
- **storage** is a single SQLite file (WAL) on a mounted volume; no external database is needed.
- **Redis is optional.** Without it the API falls back to an in-process event bus for realtime
  and in-memory caching; the worker still runs its scheduled sweeps and consumes locally
  enqueued jobs. Set `REDIS_URL` only if you scale to multiple instances.
- **worker** (embedded or standalone via `EMBED_WORKER=false` + `Dockerfile.worker`) runs
  scheduled sweeps (node health, subscription expiry, retention cleanup) and consumes on-demand
  jobs with exponential-backoff retries. With Redis it uses leader locks; embedded it is single-instance.
- **node agents** authenticate with per-node hashed tokens and push heartbeats/metrics/usage.

## Monorepo layout

```
apps/api        Fastify REST API (modules: auth, users, configs, nodes, agent,
                subscriptions, publicsub, plans, groups, resellers, apikeys,
                audit, notifications, dashboard, search, settings, admins,
                reports, realtime)
apps/web        React 18 + Vite SPA (TanStack Query, custom design tokens, fa/en i18n)
apps/worker     background worker (library: startWorker(); thin CLI in main.ts)
packages/shared branding, permission catalog, DTO types, error codes, in-process event bus
packages/db     Drizzle (sqlite-core) schema + SQL migrations + better-sqlite3 client
packages/core   pure configuration engine (protocol/transport/security adapters)
scripts/        migrate, seed, bootstrap (prod first-boot), dev orchestrator, dev node agent
infrastructure/ Dockerfiles at repo root, railway.toml, docker-compose.yml
docs/           this documentation
```

## Configuration engine

`packages/core` is dependency-free and deterministic:

- `ProtocolAdapter` (vless / vmess / trojan) — credential kind + link builder.
- `TransportAdapter` (ws / httpupgrade / tcp / grpc) — transport params.
- `SecurityAdapter` (none / tls / reality) — security params.
- `validateSpec()` (Zod) → `buildLink()` → `buildSubscriptionBody()`.

New protocols are added by registering one adapter object; no rewrite of generation logic.
Every config mutation stores an immutable `config_versions` snapshot.

## AuthN / AuthZ

- Sessions: DB-backed, httpOnly `SameSite=Lax` cookie, SHA-256 token hash, revocable, TTL configurable.
- CSRF: double-submit cookie for session mutations (API-key calls exempt).
- Passwords: scrypt (N=16384) with per-user salt, timing-safe compare; lockout after 5 failures.
- RBAC: roles → permission catalog (`resource.action`), enforced in `requirePermission` middleware.
- Reseller isolation: every user/subscription query adds an `ownerId` scope predicate server-side.
- API keys: hashed at rest, prefix shown, scopes ∩ role permissions, IP allowlist, one-time secret.

## Real-time

SSE endpoint `/api/v1/events` (per-user, authed). API & worker publish `nodes-updated`,
`notifications`, `dashboard` events. With Redis they go over pub/sub (multi-instance); without
Redis they are delivered via the in-process event bus (`packages/shared` `emitLocalEvent`).
The SPA invalidates queries on message.

## Caching

Dashboard aggregates are cached for 8 s (`vira:dashboard:v1`) — in Redis when available,
otherwise in an in-memory TTL map. Rate-limit counters likewise use Redis or an in-memory
fallback. Cache invalidation is TTL-based plus explicit invalidation on writes where cheap.
