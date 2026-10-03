# Security

## Credentials & secrets
- Passwords: scrypt (N=16384, r=8, p=1) + per-user salt, timing-safe verification.
- Session tokens & node/API keys stored **hashed** (SHA-256); raw values shown once.
- Secrets only via environment variables (`SESSION_SECRET`, `ENCRYPTION_KEY`, optional `REDIS_URL`);
  the database is a local SQLite file (`DATABASE_PATH`) on the service volume — no external credentials.
- Production first-boot uses `scripts/bootstrap.mjs`: owner account only from explicit
  `OWNER_USERNAME`/`OWNER_PASSWORD` env (≥12-char password enforced); no default credentials anywhere.
- Seed credentials are created **only** by the explicit dev seed; production refuses without `--force`.

## Session & request security
- httpOnly, `SameSite=Lax` session cookie; `Secure` in production; revocable sessions.
- CSRF double-submit for cookie mutations; API keys exempt by design.
- Login rate limiting + account lockout (5 failures → 10 min); per-route limits on sensitive endpoints.
- Global rate limit (Redis-backed when available); request body capped at 1 MB.
- Security headers: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`.
- Strict CORS allow-list in production.

## Authorization
- RBAC enforced server-side on every route (`requirePermission`).
- Reseller data isolation via `ownerId` predicates in SQL — never client-side filtering.
- API key scopes intersect role permissions; IP allowlist; expiry; rotation.

## Data protection
- ORM-parameterized queries only (Drizzle) — no string-built SQL with user input.
- Error responses never leak stack traces or internals; request IDs for tracing.
- Soft deletes for users/configs; audit log for every sensitive action including denials.

## Operational
- Docker images run as non-root user; healthchecks; graceful shutdown on SIGTERM.
- Agent endpoints require hashed bearer tokens; heartbeats rate-limited.
- 2FA-ready: `accounts.totp_secret` column reserved.

## Known hardening next-steps (documented, not blocking)
- Wire `request-reset` to a real email/webhook transport in production.
- Add TOTP verification at login when `totp_secret` set.
- Object storage (S3-compatible) if file uploads are introduced.
