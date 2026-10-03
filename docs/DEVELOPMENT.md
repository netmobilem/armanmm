# Development

## Layout & workflow
- Workspaces: `apps/*`, `packages/*` (npm workspaces).
- `packages/core` must stay pure & unit-tested (no IO).
- API modules: `apps/api/src/modules/<name>/routes.ts` — register via `app.ts`.
- Business logic in services/adapters, never in React components.
- Frontend pages in `apps/web/src/pages`, shared primitives in `components/`, tokens in `styles.css`.
- i18n keys in `apps/web/src/lib/i18n.tsx` (fa + en); never hardcode labels in pages.

## Commands
```bash
npm run dev           # api (embedded worker) + web with watch
npm run test          # vitest (creates/resets ./data/test.db automatically)
npm run typecheck     # strict TS everywhere (ordered: shared → db → core → worker → api → web)
npm run lint          # eslint
```

## Testing conventions
- API tests use `app.inject()` (no network) against a dedicated test DB.
- `apps/api/tests/setup.ts` migrates the test DB and seeds the RBAC catalog.
- Config-engine tests are pure/deterministic.

## Code rules
- strict TS, no unused imports, no magic numbers (named constants), no hardcoded secrets/URLs,
  consistent error envelope, audit every mutation, confirm dialogs for destructive UI actions,
  skeletons/empty/error states for every list.

## Adding a protocol
1. Implement `ProtocolAdapter` in `packages/core/src/adapters/protocols.ts`.
2. Add its id to the Zod enum in `spec.ts` + shared types.
3. Add unit tests for link shape.
4. Surface it in the wizard's protocol step (web) — data-driven, no new page.

## Adding a job
Register a handler in `apps/worker/src/jobs.ts` (`jobHandlers`) and enqueue via
`enqueueJob()` from the API. Sweeps: add an interval with `withLock()` in `apps/worker/src/worker.ts`.

Notes for the SQLite storage layer:
- No `ilike` — use `like` (ASCII case-insensitive in SQLite).
- Raw SQL must be SQLite dialect: `strftime(...)` instead of `to_char`/`date_trunc`,
  `json_extract` instead of `::jsonb`, `db.all()` instead of `db.execute()`.
- Timestamps are epoch-ms integers; interpolate `date.getTime()` in raw SQL.
