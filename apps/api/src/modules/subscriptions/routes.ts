import type { FastifyInstance } from 'fastify';
import { and, count, desc, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { db, subscriptions, endUsers, plans } from '@vira/db';
import { requirePermission, assertCsrf, type AuthContext } from '../../plugins/auth.js';
import { ApiError } from '../../lib/errors.js';
import { audit, notify } from '../../lib/audit.js';
import { newToken } from '../../lib/security.js';
import { parsePage, paginated } from '../../lib/pagination.js';
import { resellerScope } from '../users/routes.js';
import type { SubscriptionDto } from '@vira/shared';

const createSchema = z.object({
  endUserId: z.string().uuid(),
  planId: z.string().uuid().nullish(),
  trafficQuotaBytes: z.number().int().min(0).default(0),
  expiresAt: z.string().datetime({ offset: true }).nullish(),
  groupId: z.string().uuid().nullish(),
});

function mapSub(s: typeof subscriptions.$inferSelect, username: string, planName: string | null): SubscriptionDto {
  return {
    id: s.id, endUserId: s.endUserId, endUserUsername: username, planName, token: s.token,
    status: s.status as SubscriptionDto['status'],
    startedAt: s.startedAt.toISOString(), expiresAt: s.expiresAt?.toISOString() ?? null,
    trafficQuotaBytes: s.trafficQuotaBytes, trafficUsedBytes: s.trafficUsedBytes,
    groupId: s.groupId, createdAt: s.createdAt.toISOString(),
  };
}

async function scopedUserCheck(auth: AuthContext, endUserId: string) {
  const scope = auth.role === 'RESELLER' ? eq(endUsers.ownerId, auth.accountId) : undefined;
  const user = (await db.select().from(endUsers).where(and(eq(endUsers.id, endUserId), isNull(endUsers.deletedAt), scope) as never).limit(1))[0];
  if (!user) throw ApiError.notFound('User not found');
  return user;
}

export async function registerSubscriptionRoutes(app: FastifyInstance): Promise<void> {
  app.get('/subscriptions', async (req) => {
    const auth = await requirePermission(req, 'subscriptions.read');
    const q = parsePage(req);
    const scope = resellerScope(auth);
    const where = and(scope) as never;
    const rows = await db
      .select({ sub: subscriptions, username: endUsers.username, planName: plans.name })
      .from(subscriptions)
      .innerJoin(endUsers, eq(subscriptions.endUserId, endUsers.id))
      .leftJoin(plans, eq(subscriptions.planId, plans.id))
      .where(where)
      .orderBy(desc(subscriptions.createdAt))
      .limit(q.pageSize).offset((q.page - 1) * q.pageSize);
    const total = (await db.select({ n: count() }).from(subscriptions).innerJoin(endUsers, eq(subscriptions.endUserId, endUsers.id)).where(where))[0]?.n ?? 0;
    return { success: true, requestId: req.id, data: paginated(rows.map((r) => mapSub(r.sub, r.username, r.planName)), total, q) };
  });

  app.post('/subscriptions', async (req) => {
    const auth = await requirePermission(req, 'subscriptions.create');
    assertCsrf(req, auth);
    const body = createSchema.parse(req.body ?? {});
    const user = await scopedUserCheck(auth, body.endUserId);
    let quota = body.trafficQuotaBytes;
    let expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
    if (body.planId) {
      const plan = (await db.select().from(plans).where(eq(plans.id, body.planId)).limit(1))[0];
      if (plan) { quota = quota || plan.trafficBytes; expiresAt = expiresAt ?? new Date(Date.now() + plan.durationDays * 86_400_000); }
    }
    const [row] = await db.insert(subscriptions).values({
      endUserId: body.endUserId, planId: body.planId ?? null, token: newToken(24),
      expiresAt, trafficQuotaBytes: quota, groupId: body.groupId ?? user.groupId,
    }).returning();
    audit(req, { actorId: auth.accountId, actorName: auth.username, action: 'SUBSCRIPTION_CREATED', resourceType: 'subscription', resourceId: row.id });
    return { success: true, requestId: req.id, data: mapSub(row, user.username, null) };
  });

  const loadSub = async (auth: AuthContext, id: string) => {
    const scope = resellerScope(auth);
    const row = (await db
      .select({ sub: subscriptions, username: endUsers.username, planName: plans.name })
      .from(subscriptions)
      .innerJoin(endUsers, eq(subscriptions.endUserId, endUsers.id))
      .leftJoin(plans, eq(subscriptions.planId, plans.id))
      .where(and(eq(subscriptions.id, id), scope) as never)
      .limit(1))[0];
    if (!row) throw ApiError.notFound('Subscription not found');
    return row;
  };

  app.get('/subscriptions/:id', async (req) => {
    const auth = await requirePermission(req, 'subscriptions.read');
    const row = await loadSub(auth, (req.params as { id: string }).id);
    return { success: true, requestId: req.id, data: mapSub(row.sub, row.username, row.planName) };
  });

  app.post('/subscriptions/:id/renew', async (req) => {
    const auth = await requirePermission(req, 'subscriptions.update');
    assertCsrf(req, auth);
    const { id } = req.params as { id: string };
    const { days } = z.object({ days: z.number().int().min(1).max(3650).default(30) }).parse(req.body ?? {});
    const row = await loadSub(auth, id);
    const base = row.sub.expiresAt && row.sub.expiresAt > new Date() ? row.sub.expiresAt : new Date();
    const [updated] = await db.update(subscriptions).set({ status: 'active', expiresAt: new Date(base.getTime() + days * 86_400_000), updatedAt: new Date() }).where(eq(subscriptions.id, id)).returning();
    audit(req, { actorId: auth.accountId, actorName: auth.username, action: 'SUBSCRIPTION_RENEWED', resourceType: 'subscription', resourceId: id, metadata: { days } });
    return { success: true, requestId: req.id, data: mapSub(updated, row.username, row.planName) };
  });

  app.post('/subscriptions/:id/revoke', async (req) => {
    const auth = await requirePermission(req, 'subscriptions.revoke');
    assertCsrf(req, auth);
    const { id } = req.params as { id: string };
    const row = await loadSub(auth, id);
    const [updated] = await db.update(subscriptions).set({ status: 'revoked', updatedAt: new Date() }).where(eq(subscriptions.id, id)).returning();
    audit(req, { actorId: auth.accountId, actorName: auth.username, action: 'SUBSCRIPTION_REVOKED', resourceType: 'subscription', resourceId: id });
    await notify('subscription', 'Subscription revoked', `Subscription of ${row.username} was revoked`, auth.accountId);
    return { success: true, requestId: req.id, data: mapSub(updated, row.username, row.planName) };
  });

  app.post('/subscriptions/:id/reset-traffic', async (req) => {
    const auth = await requirePermission(req, 'subscriptions.update');
    assertCsrf(req, auth);
    const { id } = req.params as { id: string };
    const row = await loadSub(auth, id);
    const [updated] = await db.update(subscriptions).set({ trafficUsedBytes: 0, updatedAt: new Date() }).where(eq(subscriptions.id, id)).returning();
    await db.update(endUsers).set({ trafficUsedBytes: 0, updatedAt: new Date() }).where(eq(endUsers.id, row.sub.endUserId));
    audit(req, { actorId: auth.accountId, actorName: auth.username, action: 'SUBSCRIPTION_TRAFFIC_RESET', resourceType: 'subscription', resourceId: id });
    return { success: true, requestId: req.id, data: mapSub(updated, row.username, row.planName) };
  });

  app.post('/subscriptions/:id/regenerate-token', async (req) => {
    const auth = await requirePermission(req, 'subscriptions.update');
    assertCsrf(req, auth);
    const { id } = req.params as { id: string };
    const row = await loadSub(auth, id);
    const [updated] = await db.update(subscriptions).set({ token: newToken(24), updatedAt: new Date() }).where(eq(subscriptions.id, id)).returning();
    audit(req, { actorId: auth.accountId, actorName: auth.username, action: 'SUBSCRIPTION_TOKEN_REGENERATED', resourceType: 'subscription', resourceId: id });
    return { success: true, requestId: req.id, data: mapSub(updated, row.username, row.planName) };
  });

  app.patch('/subscriptions/:id', async (req) => {
    const auth = await requirePermission(req, 'subscriptions.update');
    assertCsrf(req, auth);
    const { id } = req.params as { id: string };
    const row = await loadSub(auth, id);
    const body = z.object({ trafficQuotaBytes: z.number().int().min(0).optional(), expiresAt: z.string().datetime({ offset: true }).nullish() }).parse(req.body ?? {});
    const [updated] = await db.update(subscriptions).set({
      ...(body.trafficQuotaBytes !== undefined ? { trafficQuotaBytes: body.trafficQuotaBytes } : {}),
      ...(body.expiresAt !== undefined ? { expiresAt: body.expiresAt ? new Date(body.expiresAt) : null } : {}),
      updatedAt: new Date(),
    }).where(eq(subscriptions.id, id)).returning();
    audit(req, { actorId: auth.accountId, actorName: auth.username, action: 'SUBSCRIPTION_UPDATED', resourceType: 'subscription', resourceId: id });
    return { success: true, requestId: req.id, data: mapSub(updated, row.username, row.planName) };
  });
}
