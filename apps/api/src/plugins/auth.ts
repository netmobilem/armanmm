import type { FastifyRequest } from 'fastify';
import { and, eq, isNull } from 'drizzle-orm';
import { db, sessions, accounts, roles, rolePermissions, permissions, apiKeys } from '@vira/db';
import { sha256 } from '../lib/security.js';
import { ApiError } from '../lib/errors.js';
import { audit } from '../lib/audit.js';

export const SESSION_COOKIE = 'vira_sid';
export const CSRF_COOKIE = 'vira_csrf';

export interface AuthContext {
  kind: 'session' | 'apikey';
  accountId: string;
  username: string;
  displayName: string;
  role: string;
  permissions: string[];
  sessionId?: string;
  apiKeyScopes?: string[];
}

const permCache = new Map<string, { perms: string[]; at: number }>();

export async function rolePermissionList(roleName: string): Promise<string[]> {
  const hit = permCache.get(roleName);
  if (hit && Date.now() - hit.at < 60_000) return hit.perms;
  const rows = await db
    .select({ key: permissions.key })
    .from(roles)
    .innerJoin(rolePermissions, eq(roles.id, rolePermissions.roleId))
    .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
    .where(eq(roles.name, roleName));
  const perms = rows.map((r) => r.key);
  permCache.set(roleName, { perms, at: Date.now() });
  return perms;
}

async function resolveSession(request: FastifyRequest): Promise<AuthContext | null> {
  const token = (request.cookies as Record<string, string> | undefined)?.[SESSION_COOKIE];
  if (!token) return null;
  const tokenHash = sha256(token);
  const rows = await db
    .select({
      session: sessions,
      account: accounts,
      roleName: roles.name,
    })
    .from(sessions)
    .innerJoin(accounts, eq(sessions.accountId, accounts.id))
    .innerJoin(roles, eq(accounts.roleId, roles.id))
    .where(and(eq(sessions.tokenHash, tokenHash), isNull(sessions.revokedAt)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (row.session.expiresAt < new Date()) return null;
  if (row.account.status !== 'active') return null;
  const perms = await rolePermissionList(row.roleName);
  // throttle lastSeen updates to once a minute
  if (Date.now() - row.session.lastSeenAt.getTime() > 60_000) {
    db.update(sessions).set({ lastSeenAt: new Date() }).where(eq(sessions.id, row.session.id)).catch(() => {});
  }
  return {
    kind: 'session',
    accountId: row.account.id,
    username: row.account.username,
    displayName: row.account.displayName,
    role: row.roleName,
    permissions: perms,
    sessionId: row.session.id,
  };
}

async function resolveApiKey(request: FastifyRequest): Promise<AuthContext | null> {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer vira_')) return null;
  const raw = header.slice('Bearer '.length);
  const row = (await db
    .select({ key: apiKeys, account: accounts, roleName: roles.name })
    .from(apiKeys)
    .innerJoin(accounts, eq(apiKeys.accountId, accounts.id))
    .innerJoin(roles, eq(accounts.roleId, roles.id))
    .where(and(eq(apiKeys.keyHash, sha256(raw)), isNull(apiKeys.revokedAt)))
    .limit(1))[0];
  if (!row) return null;
  if (row.key.expiresAt && row.key.expiresAt < new Date()) return null;
  if (row.account.status !== 'active') return null;
  if (row.key.ipAllowlist.length > 0 && !row.key.ipAllowlist.includes(request.ip)) return null;
  db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, row.key.id)).catch(() => {});
  return {
    kind: 'apikey',
    accountId: row.account.id,
    username: row.account.username,
    displayName: row.account.displayName,
    role: row.roleName,
    permissions: await rolePermissionList(row.roleName),
    apiKeyScopes: row.key.scopes,
  };
}

export async function getAuth(request: FastifyRequest): Promise<AuthContext | null> {
  return (await resolveSession(request)) ?? (await resolveApiKey(request));
}

export async function requireAuth(request: FastifyRequest): Promise<AuthContext> {
  const auth = await getAuth(request);
  if (!auth) throw ApiError.unauthorized();
  return auth;
}

/** Server-side RBAC enforcement. API keys must also carry the permission in their scopes. */
export async function requirePermission(request: FastifyRequest, permission: string): Promise<AuthContext> {
  const auth = await requireAuth(request);
  const allowed =
    auth.role === 'OWNER' ||
    (auth.permissions.includes(permission) &&
      (auth.kind === 'session' || !auth.apiKeyScopes || auth.apiKeyScopes.includes(permission) || auth.apiKeyScopes.includes('*')));
  if (!allowed) {
    audit(request, { actorId: auth.accountId, actorName: auth.username, action: 'ACCESS_DENIED', resourceType: 'permission', resourceId: permission, result: 'denied' });
    throw ApiError.forbidden(`Missing permission: ${permission}`);
  }
  return auth;
}

/** CSRF double-submit check for cookie-session mutations. */
export function assertCsrf(request: FastifyRequest, auth: AuthContext): void {
  if (auth.kind !== 'session') return;
  const method = request.method;
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return;
  const cookies = request.cookies as Record<string, string> | undefined;
  const cookieToken = cookies?.[CSRF_COOKIE];
  const headerToken = request.headers['x-csrf-token'];
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    throw new ApiError('CSRF_INVALID', 'CSRF token mismatch', 403);
  }
}

