# Database

Storage is a single **SQLite** file (via `better-sqlite3`) kept on a mounted volume — zero
external services. The path comes from `DATABASE_PATH` (default `./data/vira.db`; the image
uses `/app/data/vira.db`). The client enables WAL, `foreign_keys=ON`, and a 5 s busy timeout.

Schema lives in `packages/db/src/schema.ts` (Drizzle `sqlite-core`); DDL migrations are
generated SQL in `packages/db/migrations/` applied by `scripts/migrate.mjs` with a `_migrations`
ledger (transactional, ordered, idempotent). `--reset` drops all tables **in place** (it never
deletes the file, so live connections stay valid).

```bash
npm run db:migrate        # apply pending
npm run db:reset          # drop schema in place + migrate + seed
cd packages/db && npx drizzle-kit generate   # create a new migration after schema edits
```

## SQLite type mapping

- UUID PKs → `text` with a runtime `$defaultFn` generator.
- Timestamps → `integer` epoch-milliseconds (`{ mode: 'timestamp_ms' }`), compared as numbers.
- Arrays / objects → `text` JSON columns (`{ mode: 'json' }`).
- Case-insensitive search uses `like` (SQLite `LIKE` is ASCII case-insensitive).

## Entities

- **accounts** — staff & resellers (role fk, status, lockout counters, totp_secret reserved)
- **roles / permissions / role_permissions** — RBAC catalog
- **sessions** — hashed tokens, expiry, revocation, last-seen
- **end_users** — subscription customers (soft delete, owner scoping, quota, tags)
- **nodes / node_metrics** — servers + time-series health samples
- **config_groups** — protocol-allowed bundles assigned to users/configs/subscriptions
- **proxy_configs / config_versions** — configs + immutable version snapshots
- **subscriptions** — token, quota, expiry, status
- **plans** — sales templates (traffic/duration/price)
- **api_keys** — hashed secrets, scopes, allowlist, rate limit
- **audit_logs** — actor/action/resource/result/ip/ua/metadata
- **notifications** — per-account or global
- **traffic_records** — hourly per-subscription/per-node traffic
- **system_settings** — JSON key/value panel settings
- **reset_tokens** — password reset one-time tokens

Design rules followed: UUID PKs, `created_at`/`updated_at`, indexes on hot paths
(sessions token, metrics time, audit time/action, traffic time), FK cascades where ownership
implies deletion (metrics, versions, traffic), `set null` where history should survive.

## Backup

Back up by copying the volume file while quiesced, or use the online API:
`sqlite3 $DATABASE_PATH ".backup '/path/backup.db'"`. WAL mode keeps readers unblocked.
