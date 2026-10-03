import type { FastifyInstance } from 'fastify';
import { count, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, accounts, roles, endUsers, subscriptions, systemSettings } from '@vira/db';
import { requirePermission, assertCsrf } from '../../plugins/auth.js';
import { ApiError } from '../../lib/errors.js';
import { audit } from '../../lib/audit.js';
import { hashPassword } from '../../lib/security.js';

const LIMITS_KEY = 'reseller_limits';

async function resellerRoleId(): Promise<string> {
  const role = (await db.select().from(roles).where(eq(roles.name, 'RESELLER')).limit(1))[0];
  if (!role) throw new ApiError('INTERNAL_ERROR', 'RESELLER role missing', 500);
  return role.id;
}

async function getLimits(): Promise<Record<string, { maxUsers: number }>> {
  const row = (await db.select().from(systemSettings).where(eq(systemSettings.key, LIMITS_KEY)).limit(1))[0];
  return (row?.value as Record<string, { maxUsers: number }>) ?? {};
}

export async function registerResellerRoutes(app: FastifyInstance): Promise<void> {
  app.get('/resellers', async (req) => {
    await requirePermission(req, 'resellers.read');
    const roleId = await resellerRoleId();
    const rows = await db.select().from(accounts).where(eq(accounts.roleId, roleId));
    const limits = await getLimits();
    const data = await Promise.all(rows.map(async (r) => {
      const [users, subs] = await Promise.all([
        db.select({ n: count() }).from(endUsers).where(eq(endUsers.ownerId, r.id)),
        db.select({ n: count() }).from(subscriptions).innerJoin(endUsers, eq(subscriptions.endUserId, endUsers.id)).where(eq(endUsers.ownerId, r.id)),
      ]);
      return {
        id: r.id, username: r.username, displayName: r.displayName, status: r.status,
        createdAt: r.createdAt.toISOString(),
        userCount: users[0]?.n ?? 0,
        subscriptionCount: subs[0]?.n ?? 0,
        maxUsers: limits[r.id]?.maxUsers ?? 50,
      };
    }));
    return { success: true, requestId: req.id, data };
  });

  app.post('/resellers', async (req) => {
    const auth = await requirePermission(req, 'resellers.create');
    assertCsrf(req, auth);
    const body = z.object({ username: z.string().regex(/^[a-z0-9_.-]{3,32}$/), password: z.string().min(8).max(128), displayName: z.string().max(64).default(''), maxUsers: z.number().int().min(1).max(10000).default(50) }).parse(req.body ?? {});
    const dup = (await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.username, body.username)).limit(1))[0];
    if (dup) throw ApiError.conflict('Username already exists');
    const roleId = await resellerRoleId();
    const [row] = await db.insert(accounts).values({ username: body.username, displayName: body.displayName || body.username, passwordHash: hashPassword(body.password), roleId }).returning();
    const limits = await getLimits();
    limits[row.id] = { maxUsers: body.maxUsers };
    await db.insert(systemSettings).values({ key: LIMITS_KEY, value: limits }).onConflictDoUpdate({ target: systemSettings.key, set: { value: limits, updatedAt: new Date() } });
    audit(req, { actorId: auth.accountId, actorName: auth.username, action: 'RESELLER_CREATED', resourceType: 'reseller', resourceId: row.id });
    return { success: true, requestId: req.id, data: { id: row.id, username: row.username } };
  });

  app.patch('/resellers/:id', async (req) => {
    const auth = await requirePermission(req, 'resellers.update');
    assertCsrf(req, auth);
    const { id } = req.params as { id: string };
    const body = z.object({ status: z.enum(['active', 'disabled']).optional(), displayName: z.string().max(64).optional(), maxUsers: z.number().int().min(1).max(10000).optional() }).parse(req.body ?? {});
    if (body.status || body.displayName) {
      await db.update(accounts).set({ ...(body.status ? { status: body.status } : {}), ...(body.displayName ? { displayName: body.displayName } : {}), updatedAt: new Date() }).where(eq(accounts.id, id));
    }
    if (body.maxUsers) {
      const limits = await getLimits();
      limits[id] = { maxUsers: body.maxUsers };
      await db.insert(systemSettings).values({ key: LIMITS_KEY, value: limits }).onConflictDoUpdate({ target: systemSettings.key, set: { value: limits, updatedAt: new Date() } });
    }
    audit(req, { actorId: auth.accountId, actorName: auth.username, action: 'RESELLER_UPDATED', resourceType: 'reseller', resourceId: id });
    return { success: true, requestId: req.id, data: null };
  });

  app.delete('/resellers/:id', async (req) => {
    const auth = await requirePermission(req, 'resellers.delete');
    assertCsrf(req, auth);
    const { id } = req.params as { id: string };
    await db.update(accounts).set({ status: 'disabled', updatedAt: new Date() }).where(eq(accounts.id, id));
    audit(req, { actorId: auth.accountId, actorName: auth.username, action: 'RESELLER_DISABLED', resourceType: 'reseller', resourceId: id });
    return { success: true, requestId: req.id, data: null };
  });
}
