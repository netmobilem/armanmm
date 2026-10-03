# API

Base: `/api/v1`. Auth: session cookie or `Authorization: Bearer vira_…` API key.
Mutations with session auth require `X-CSRF-Token` header (value from `/api/v1/auth/csrf`).

## Error contract

```json
{ "success": false, "error": { "code": "RESOURCE_NOT_FOUND", "message": "…" }, "requestId": "uuid" }
```

Every response carries `x-request-id`. Codes: `VALIDATION_ERROR, UNAUTHORIZED, FORBIDDEN,
RESOURCE_NOT_FOUND, CONFLICT, RATE_LIMITED, ACCOUNT_LOCKED, INVALID_CREDENTIALS,
SESSION_EXPIRED, CSRF_INVALID, NODE_UNREACHABLE, INTERNAL_ERROR`.

## Endpoints (summary)

| area | methods |
| --- | --- |
| auth | `POST /auth/login` `POST /auth/logout` `GET /auth/me` `GET /auth/csrf` `POST /auth/change-password` `POST /auth/request-reset` `POST /auth/reset-password` `GET /auth/sessions` `DELETE /auth/sessions/:id` |
| users | `GET/POST /users` `GET/PATCH/DELETE /users/:id` `POST /users/:id/suspend|activate` `POST /users/bulk` `GET /users/:id/subscriptions` `GET /meta/options` |
| configs | `GET/POST /configs` `GET/PATCH/DELETE /configs/:id` `POST /configs/:id/revoke|rotate` |
| nodes | `GET/POST /nodes` `GET/PATCH/DELETE /nodes/:id` `POST /nodes/:id/enable|disable|test|agent-token` |
| agent | `POST /agent/heartbeat` (Bearer node token) |
| subscriptions | `GET/POST /subscriptions` `GET/PATCH /subscriptions/:id` `POST /subscriptions/:id/renew|revoke|reset-traffic|regenerate-token` |
| public sub | `GET /sub/:token` (base64 body + `subscription-userinfo` header) `GET /public/sub/:token` (JSON) |
| plans/groups | full CRUD |
| resellers | `GET/POST /resellers` `PATCH/DELETE /resellers/:id` |
| api-keys | `GET/POST /api-keys` `POST /api-keys/:id/rotate` `DELETE /api-keys/:id` |
| audit | `GET /audit?search=&result=&action=&from=&to=&page=` |
| notifications | `GET /notifications` `POST /notifications/read-all` |
| dashboard | `GET /dashboard` |
| search | `GET /search?q=` |
| settings | `GET/PATCH /settings` |
| admins | `GET/POST /admins` `PATCH /admins/:id` `POST /admins/:id/reset-password|revoke-sessions` |
| reports | `GET /reports/traffic|users|subscriptions|nodes|configs` (`&format=csv`) |
| realtime | `GET /events` (SSE) |
| ops | `GET /health` `GET /ready` `GET /metrics` ; dev-only `/docs` (OpenAPI) |

Permission matrix examples: `users.create`, `configs.update`, `subscriptions.revoke`,
`nodes.delete`, `settings.update`, `audit.read`, `admins.manage` (OWNER only), `system.manage`.
