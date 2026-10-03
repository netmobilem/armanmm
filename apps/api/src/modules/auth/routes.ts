import type { FastifyInstance } from 'fastify';
import { eq, or } from 'drizzle-orm';
import { z } from 'zod';
import { db, accounts, roles, sessions, resetTokens } from '@vira/db';
import { hashPassword, verifyPassword, newToken, sha256 } from '../../lib/security.js';
import { ApiError } from '../../lib/errors.js';
import { audit, notify } from '../../lib/audit.js';
import { requireAuth, rolePermissionList, SESSION_COOKIE, CSRF_COOKIE, assertCsrf } from '../../plugins/auth.js';
import { env, isProd } from '../../lib/env.js';

const MAX_FAILED = 5;
const LOCK_MINUTES = 10;

const loginSchema = z.object({ username: z.string().min(1).max(64), password: z.string().min(1).max(128) });
const changeSchema = z.object({ current: z.string().min(1), next: z.string().min(8).max(128) });
const resetReqSchema = z.object({ username: z.string().min(1).max(64) });
const resetSchema = z.object({ token: z.string().min(10), newPassword: z.string().min(8).max(128) });

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  const cookieOpts = {
    path: '/',
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: isProd,
    maxAge: env.SESSION_TTL_HOURS * 3600,
  };

  app.post('/auth/login', { config: { rateLimit: { max: 12, timeWindow: 60_000 } } }, async (req, reply) => {
    const body = loginSchema.parse(req.body ?? {});
    const row = (await db
      .select({ account: accounts, roleName: roles.name })
      .from(accounts)
      .innerJoin(roles, eq(accounts.roleId, roles.id))
      .where(eq(accounts.username, body.username))
      .limit(1))[0];

    if (!row) {
      audit(req, { actorName: body.username, action: 'LOGIN_FAILED', resourceType: 'auth', result: 'error' });
      throw new ApiError('INVALID_CREDENTIALS', 'Invalid username or password', 401);
    }
    const { account } = row;
    if (account.status === 'disabled') throw new ApiError('INVALID_CREDENTIALS', 'Invalid username or password', 401);
    if (account.lockedUntil && account.lockedUntil > new Date()) {
      throw new ApiError('ACCOUNT_LOCKED', 'Account temporarily locked due to repeated failures', 423);
    }
    if (!verifyPassword(body.password, account.passwordHash)) {
      const failed = account.failedLogins + 1;
      const lockedUntil = failed >= MAX_FAILED ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null;
      await db.update(accounts).set({ failedLogins: failed, lockedUntil }).where(eq(accounts.id, account.id));
      audit(req, { actorId: account.id, actorName: account.username, action: 'LOGIN_FAILED', resourceType: 'auth', result: 'error' });
      if (lockedUntil) await notify('security', 'Account locked', `Account ${account.username} locked after ${MAX_FAILED} failed logins`, account.id);
      throw new ApiError('INVALID_CREDENTIALS', 'Invalid username or password', 401);
    }

    await db.update(accounts).set({ failedLogins: 0, lockedUntil: null }).where(eq(accounts.id, account.id));
    const token = newToken();
    const csrf = newToken(16);
    const expiresAt = new Date(Date.now() + env.SESSION_TTL_HOURS * 3600_000);
    const [session] = await db.insert(sessions).values({
      accountId: account.id,
      tokenHash: sha256(token),
      ip: req.ip,
      userAgent: String(req.headers['user-agent'] ?? ''),
      expiresAt,
    }).returning();

    reply.setCookie(SESSION_COOKIE, token, cookieOpts);
    reply.setCookie(CSRF_COOKIE, csrf, { ...cookieOpts, httpOnly: false });
    audit(req, { actorId: account.id, actorName: account.username, action: 'LOGIN_SUCCESS', resourceType: 'auth' });

    return {
      success: true,
      requestId: req.id,
      data: {
        csrf,
        user: {
          id: account.id,
          username: account.username,
          displayName: account.displayName,
          role: row.roleName,
          permissions: await rolePermissionList(row.roleName),
          sessionId: session.id,
        },
      },
    };
  });

  app.post('/auth/logout', async (req, reply) => {
    const auth = await requireAuth(req);
    if (auth.sessionId) {
      await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.id, auth.sessionId));
    }
    audit(req, { actorId: auth.accountId, actorName: auth.username, action: 'LOGOUT', resourceType: 'auth' });
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    reply.clearCookie(CSRF_COOKIE, { path: '/' });
    return { success: true, requestId: req.id, data: null };
  });

  app.get('/auth/me', async (req) => {
    const auth = await requireAuth(req);
    return { success: true, requestId: req.id, data: { id: auth.accountId, username: auth.username, displayName: auth.displayName, role: auth.role, permissions: auth.permissions } };
  });

  app.get('/auth/csrf', async (req, reply) => {
    const cookies = req.cookies as Record<string, string>;
    let csrf = cookies?.[CSRF_COOKIE];
    if (!csrf) {
      csrf = newToken(16);
      reply.setCookie(CSRF_COOKIE, csrf, { path: '/', httpOnly: false, sameSite: 'lax', secure: isProd });
    }
    return { success: true, requestId: req.id, data: { csrf } };
  });

  app.post('/auth/change-password', async (req) => {
    const auth = await requireAuth(req);
    assertCsrf(req, auth);
    const body = changeSchema.parse(req.body ?? {});
    const account = (await db.select().from(accounts).where(eq(accounts.id, auth.accountId)).limit(1))[0];
    if (!account || !verifyPassword(body.current, account.passwordHash)) {
      throw new ApiError('INVALID_CREDENTIALS', 'Current password is incorrect', 400);
    }
    await db.update(accounts).set({ passwordHash: hashPassword(body.next), updatedAt: new Date() }).where(eq(accounts.id, auth.accountId));
    // revoke other sessions on password change
    await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.accountId, auth.accountId));
    audit(req, { actorId: auth.accountId, actorName: auth.username, action: 'PASSWORD_CHANGED', resourceType: 'auth' });
    return { success: true, requestId: req.id, data: null };
  });

  app.post('/auth/request-reset', { config: { rateLimit: { max: 5, timeWindow: 60_000 } } }, async (req) => {
    const body = resetReqSchema.parse(req.body ?? {});
    const account = (await db.select().from(accounts).where(or(eq(accounts.username, body.username), eq(accounts.email, body.username))!).limit(1))[0];
    let devToken: string | null = null;
    if (account) {
      const token = newToken();
      await db.insert(resetTokens).values({ accountId: account.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 3600_000) });
      if (!isProd) devToken = token; // dev convenience only; production must deliver via email/webhook
      audit(req, { actorId: account.id, actorName: account.username, action: 'PASSWORD_RESET_REQUESTED', resourceType: 'auth' });
    }
    return { success: true, requestId: req.id, data: { requested: true, ...(devToken ? { devToken } : {}) } };
  });

  app.post('/auth/reset-password', { config: { rateLimit: { max: 5, timeWindow: 60_000 } } }, async (req) => {
    const body = resetSchema.parse(req.body ?? {});
    const row = (await db.select().from(resetTokens).where(eq(resetTokens.tokenHash, sha256(body.token))).limit(1))[0];
    if (!row || row.usedAt || row.expiresAt < new Date()) throw ApiError.notFound('Invalid or expired reset token');
    await db.update(accounts).set({ passwordHash: hashPassword(body.newPassword), failedLogins: 0, lockedUntil: null, updatedAt: new Date() }).where(eq(accounts.id, row.accountId));
    await db.update(resetTokens).set({ usedAt: new Date() }).where(eq(resetTokens.id, row.id));
    await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.accountId, row.accountId));
    audit(req, { actorId: row.accountId, action: 'PASSWORD_RESET', resourceType: 'auth' });
    return { success: true, requestId: req.id, data: null };
  });

  app.get('/auth/sessions', async (req) => {
    const auth = await requireAuth(req);
    const rows = await db.select().from(sessions).where(eq(sessions.accountId, auth.accountId));
    return { success: true, requestId: req.id, data: rows.filter((s) => !s.revokedAt).map((s) => ({ id: s.id, ip: s.ip, userAgent: s.userAgent, createdAt: s.createdAt, lastSeenAt: s.lastSeenAt, current: s.id === auth.sessionId })) };
  });

  app.delete('/auth/sessions/:id', async (req) => {
    const auth = await requireAuth(req);
    assertCsrf(req, auth);
    await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.id, req.params as never));
    audit(req, { actorId: auth.accountId, actorName: auth.username, action: 'SESSION_REVOKED', resourceType: 'auth', resourceId: String((req.params as { id: string }).id) });
    return { success: true, requestId: req.id, data: null };
  });
}
