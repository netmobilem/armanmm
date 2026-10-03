# Deployment — step by step (Railway)

## Topology on Railway

**One service + one volume. No Postgres, no Redis.**

| resource | builder | start | notes |
| --- | --- | --- | --- |
| `web-api` | Docker (`Dockerfile`) | `migrate → bootstrap → api` | serves REST API + built SPA + **embedded worker** |
| Volume | — | mounted at `/app/data` | holds the single SQLite file (`/app/data/vira.db`) |

Storage is a single SQLite database file on a Railway volume, so there are no database
credentials to manage and nothing external to connect to. Redis is optional; without it the
worker is embedded and realtime uses the in-process event bus.

Boot is self-healing: migrations apply on every start (ledger-based, idempotent), and
`scripts/bootstrap.mjs` creates the RBAC catalog + an initial OWNER **only** when
`OWNER_USERNAME` / `OWNER_PASSWORD` (≥ 12 chars) are provided. No default credentials exist.

## 1. Push the code to GitHub

```bash
git init && git add . && git commit -m "ViraPanel initial release"
git remote add origin https://github.com/<YOU>/virapanel.git
git push -u origin main
```

(`.env` is git-ignored; `package-lock.json` MUST be committed.)

## 2. Create the Railway project

1. https://railway.app → **New Project** → **Deploy from GitHub repo** → pick the repo.
   Railway reads `railway.toml` (Docker builder, start command, healthcheck `/api/v1/health`).

No database or Redis plugins are needed.

## 3. Attach a volume

1. Click the service → **Settings → Volumes → Add Volume** (or right-click → **Volume**).
2. Mount path: `/app/data`.
3. The SQLite file (`DATABASE_PATH=/app/data/vira.db`, baked into the image) is created here
   on first boot and survives every redeploy.

## 4. Configure variables

**Settings → Networking → Generate Domain** → copy the URL, e.g. `https://virapanel.up.railway.app`.
Then **Variables → Add**:

| variable | value |
| --- | --- |
| `NODE_ENV` | `production` |
| `PORT` | `8080` |
| `DATABASE_PATH` | `/app/data/vira.db` |
| `SESSION_SECRET` | `openssl rand -hex 32` |
| `ENCRYPTION_KEY` | `openssl rand -hex 16` |
| `PUBLIC_URL` | your generated domain |
| `CORS_ORIGIN` | same as `PUBLIC_URL` |
| `OWNER_USERNAME` | e.g. `owner` (first boot only) |
| `OWNER_PASSWORD` | strong, ≥ 12 chars (first boot only) |

Deploy. Watch **Logs**: expect `[migrate] applied …`, `[bootstrap] RBAC catalog created`,
`[bootstrap] owner account "owner" created`, `[worker] ready`, then `ViraPanel API listening`.
After the first successful boot you may delete `OWNER_USERNAME/OWNER_PASSWORD`.

## 5. Verify

- `https://<domain>/api/v1/health` → `{"status":"ok"}`
- `https://<domain>/api/v1/ready` → `{"status":"ready","checks":{"database":"ok",…}}`
- open `https://<domain>` → login with the owner you created.
- `/docs` (Swagger) is disabled automatically in production.

## 6. Real nodes in production

From **Nodes → issue agent token** (shown once). On each VPS run any agent that POSTs
`/api/v1/agent/heartbeat` with `Authorization: Bearer <token>` and a JSON body
`{cpu,memory,disk,connections,trafficIn,trafficOut,version,usage:[{credential,bytes}]}`.
`scripts/dev-node-agent.mjs` is a reference client for development.

## 7. Operations

- New git push → automatic redeploy. The volume (and the database on it) is untouched.
- **Backups:** copy the database file. Easiest is a Railway Cron/one-off service that runs
  `sqlite3 /app/data/vira.db ".backup /app/data/backup-$(date +%F).db"`, or snapshot the volume.
  Avoid copying `vira.db` raw while the app is writing; use the `.backup` API or stop the service.
- Rotate `SESSION_SECRET` to invalidate all sessions.
- Manual migration if preferred: `npx railway run node scripts/migrate.mjs` (same for
  `scripts/bootstrap.mjs`).

## Optional: Redis or a standalone worker

- Set `REDIS_URL` if you run more than one API instance (shared cache/pub-sub/job queue).
  With a single instance it is unnecessary.
- To run the worker as its own service: set `EMBED_WORKER=false` on `web-api`, add a second
  service from the same repo with **Build → Dockerfile Path** = `Dockerfile.worker`, and give it
  the same `DATABASE_PATH` volume + variables. (Only worthwhile with Redis for leader locking.)

## Troubleshooting

| symptom | cause / fix |
| --- | --- |
| `SQLITE_CANTOPEN` / can't create DB | volume not mounted at `/app/data`, or wrong `DATABASE_PATH` |
| database empty after redeploy | volume not attached — data lives on the volume, not the image |
| healthcheck failing | ensure `healthcheckPath=/api/v1/health` and `PORT=8080` |
| login cookie rejected | `PUBLIC_URL`/`CORS_ORIGIN` must equal the generated https domain |
| migrations error on redeploy | ledger prevents re-application; check `_migrations` table |

## Docker (alternative)

`docker compose up --build` — single `api` service with the embedded worker and a named
`viradata` volume; same boot chain (migrate → bootstrap → api).
