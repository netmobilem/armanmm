import type { FastifyInstance, FastifyRequest } from 'fastify';
import { and, asc, desc, eq, like, isNull, or, count, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db, endUsers, subscriptions, proxyConfigs, auditLogs, plans, configGroups } from '@vira/db';
import type { AuthContext } from '../../plugins/auth.js';
import { requirePermission } from '../../plugins/auth.js';
import { assertCsrf } from '../../plugins/auth.js';
import { ApiError } from '../../lib/errors.js';
import { audit } from '../../lib/audit.js';
import { parsePage, paginated } from '../../lib/pagination.js';
import type { EndUserDto } from '@vira/shared';

const createSchema = z.object({
  username: z.string().regex(/^[a-zA-Z0-9_.-]{3,32}$/),
  displayName: z.string().max(64).default(''),
  groupId: z.string().uuid().nullish(),
  planId: z.string().uuid().nullish(),
  trafficQuotaBytes: z.number().int().min(0).default(0),
  expireAt: z.string().datetime({ offset: true }).nullish(),
  tags: z.array(z.string().max(24)).max(8).default([]),
  notes: z.string().max(2000).default(''),
});
const updateSchema = createSchema.partial().extend({ status: z.enum(['active', 'suspended']).optional() });
const bulkSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(200),
  action: z.enum(['suspend', 'activate', 'delete', 'assignGroup']),
  groupId: z.string().uuid().nullish(),
});

export function mapUser(u: typeof endUsers.$inferSelect): EndUserDto {
  return {
    id: u.id,
    username: u.username,
    displayName: u.displayName || u.username,
    status: u.status as EndUserDto['status'],
    ownerId: u.ownerId,
    groupId: u.groupId,
    planId: u.planId,
    trafficQuotaBytes: u.trafficQuotaBytes,
    trafficUsedBytes: u.trafficUsedBytes,
    expireAt: u.expireAt?.toISOString() ?? null,
    tags: u.tags,
    notes: u.notes,
    lastActiveAt: u.lastActiveAt?.toISOString() ?? null,
    createdAt: u.createdAt.toISOString(),
    online: !!u.lastActiveAt && Date.now() - u.lastActiveAt.getTime() < 120_000,
  };
}

/** Backend-enforced reseller isolation: resellers only ever see their own resources. */
export function resellerScope(auth: AuthContext) {
  return auth.role === 'RESELLER' ? eq(endUsers.ownerId, auth.accountId) : undefined;
}

export async function loadScopedUser(req: FastifyRequest, auth: AuthContext, id: string) {
  const scope = resellerScope(auth);
  const row = (await db.select().from(endUsers).where(and(eq(endUsers.id, id), isNull(endUsers.deletedAt), scope) as never).limit(1))[0];
  if (!row) throw ApiError.notFound('User not found');
  return row;
}

export async function registerUserRoutes(app: FastifyInstance): Promise<void> {
  app.get('/users', async (req) => {
    const auth = await requirePermission(req, 'users.read');
    const q = parsePage(req);
    const scope = resellerScope(auth);
    const status = (req.query as Record<string, string>).status;
    const where = and(
      isNull(endUsers.deletedAt),
      scope,
      status ? eq(endUsers.status, status) : undefined,
      q.search ? or(like(endUsers.username, `%${q.search}%`), like(endUsers.displayName, `%${q.search}%`)) : undefined,
    ) as never;
    const orderBy = q.sort === 'username' ? (q.dir === 'asc' ? asc(endUsers.username) : desc(endUsers.username)) : q.dir === 'asc' ? asc(endUsers.createdAt) : desc(endUsers.createdAt);
    const [rows, total] = await Promise.all([
      db.select().from(endUsers).where(where).orderBy(orderBy).limit(q.pageSize).offset((q.page - 1) * q.pageSize),
      db.select({ n: count() }).from(endUsers).where(where),
    ]);
    return { success: true, requestId: req.id, data: paginated(rows.map(mapUser), total[0]?.n ?? 0, q) };
  });

  app.post('/users', async (req) => {
    const auth = await requirePermission(req, 'users.create');
    assertCsrf(req, auth);
    const body = createSchema.parse(req.body ?? {});
    const dup = (await db.select({ id: endUsers.id }).from(endUsers).where(eq(endUsers.username, body.username)).limit(1))[0];
    if (dup) throw ApiError.conflict('Username already exists');
    let quota = body.trafficQuotaBytes;
    let expireAt = body.expireAt ? new Date(body.expireAt) : null;
    if (body.planId) {
      const plan = (await db.select().from(plans).where(eq(plans.id, body.planId)).limit(1))[0];
      if (plan) {
        quota = quota || plan.trafficBytes;
        expireAt = expireAt ?? new Date(Date.now() + plan.durationDays * 86_400_000);
      }
    }
    const [row] = await db.insert(endUsers).values({
      username: body.username,
      displayName: body.displayName || body.username,
      groupId: body.groupId ?? null,
      planId: body.planId ?? null,
      trafficQuotaBytes: quota,
      expireAt,
      tags: body.tags,
      notes: body.notes,
      ownerId: auth.role === 'RESELLER' ? auth.accountId : null,
    }).returning();
    audit(req, { actorId: auth.accountId, actorName: auth.username, action: 'USER_CREATED', resourceType: 'user', resourceId: row.id });
    return { success: true, requestId: req.id, data: mapUser(row) };
  });

  app.get('/users/:id', async (req) => {
    const auth = await requirePermission(req, 'users.read');
    const { id } = req.params as { id: string };
    const user = await loadScopedUser(req, auth, id);
    const [subs, cfgCount, actRows] = await Promise.all([
      db.select().from(subscriptions).where(eq(subscriptions.endUserId, id)),
      db.select({ n: count() }).from(proxyConfigs).where(and(eq(proxyConfigs.endUserId, id), isNull(proxyConfigs.deletedAt))),
      db.select().from(auditLogs).where(eq(auditLogs.resourceId, id)).orderBy(desc(auditLogs.createdAt)).limit(10),
    ]);
    return {
      success: true, requestId: req.id,
      data: {
        user: mapUser(user),
        subscriptions: subs.map((s) => ({ id: s.id, status: s.status, expiresAt: s.expiresAt?.toISOString() ?? null, trafficQuotaBytes: s.trafficQuotaBytes, trafficUsedBytes: s.trafficUsedBytes, token: s.token, createdAt: s.createdAt.toISOString() })),
        configCount: cfgCount[0]?.n ?? 0,
        activity: actRows.map((a) => ({ id: a.id, action: a.action, result: a.result, createdAt: a.createdAt.toISOString(), actorName: a.actorName })),
      },
    };
  });

  app.patch('/users/:id', async (req) => {
    const auth = await requirePermission(req, 'users.update');
    assertCsrf(req, auth);
    const { id } = req.params as { id: string };
    await loadScopedUser(req, auth, id);
    const body = updateSchema.parse(req.body ?? {});
    const [row] = await db.update(endUsers).set({
      ...(body.displayName !== undefined ? { displayName: body.displayName } : {}),
      ...(body.groupId !== undefined ? { groupId: body.groupId } : {}),
      ...(body.planId !== undefined ? { planId: body.planId } : {}),
      ...(body.trafficQuotaBytes !== undefined ? { trafficQuotaBytes: body.trafficQuotaBytes } : {}),
      ...(body.expireAt !== undefined ? { expireAt: body.expireAt ? new Date(body.expireAt) : null } : {}),
      ...(body.tags !== undefined ? { tags: body.tags } : {}),
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
      updatedAt: new Date(),
    }).where(eq(endUsers.id, id)).returning();
    audit(req, { actorId: auth.accountId, actorName: auth.username, action: 'USER_UPDATED', resourceType: 'user', resourceId: id });
    return { success: true, requestId: req.id, data: mapUser(row) };
  });

  app.delete('/users/:id', async (req) => {
    const auth = await requirePermission(req, 'users.delete');
    assertCsrf(req, auth);
    const { id } = req.params as { id: string };
    await loadScopedUser(req, auth, id);
    await db.update(endUsers).set({ deletedAt: new Date(), status: 'suspended', updatedAt: new Date() }).where(eq(endUsers.id, id));
    audit(req, { actorId: auth.accountId, actorName: auth.username, action: 'USER_DELETED', resourceType: 'user', resourceId: id });
    return { success: true, requestId: req.id, data: null };
  });

  const setStatus = async (req: FastifyRequest, id: string, status: 'active' | 'suspended', action: string) => {
    const auth = await requirePermission(req, 'users.update');
    assertCsrf(req, auth);
    await loadScopedUser(req, auth, id);
    await db.update(endUsers).set({ status, updatedAt: new Date() }).where(eq(endUsers.id, id));
    audit(req, { actorId: auth.accountId, actorName: auth.username, action, resourceType: 'user', resourceId: id });
    return { success: true, requestId: req.id, data: null };
  };
  app.post('/users/:id/suspend', async (req) => setStatus(req, (req.params as { id: string }).id, 'suspended', 'USER_SUSPENDED'));
  app.post('/users/:id/activate', async (req) => setStatus(req, (req.params as { id: string }).id, 'active', 'USER_ACTIVATED'));

  app.post('/users/bulk', async (req) => {
    const auth = await requirePermission(req, 'users.update');
    assertCsrf(req, auth);
    const body = bulkSchema.parse(req.body ?? {});
    const scope = resellerScope(auth);
    const rows = await db.select({ id: endUsers.id }).from(endUsers).where(and(inArray(endUsers.id, body.ids), isNull(endUsers.deletedAt), scope) as never);
    const ids = rows.map((r) => r.id);
    if (body.action === 'suspend') await db.update(endUsers).set({ status: 'suspended', updatedAt: new Date() }).where(inArray(endUsers.id, ids));
    if (body.action === 'activate') await db.update(endUsers).set({ status: 'active', updatedAt: new Date() }).where(inArray(endUsers.id, ids));
    if (body.action === 'delete') await db.update(endUsers).set({ deletedAt: new Date(), updatedAt: new Date() }).where(inArray(endUsers.id, ids));
    if (body.action === 'assignGroup' && body.groupId) await db.update(endUsers).set({ groupId: body.groupId, updatedAt: new Date() }).where(inArray(endUsers.id, ids));
    audit(req, { actorId: auth.accountId, actorName: auth.username, action: `USER_BULK_${body.action.toUpperCase()}`, resourceType: 'user', metadata: { count: ids.length } });
    return { success: true, requestId: req.id, data: { affected: ids.length } };
  });

  app.get('/users/:id/subscriptions', async (req) => {
    const auth = await requirePermission(req, 'subscriptions.read');
    const { id } = req.params as { id: string };
    await loadScopedUser(req, auth, id);
    const rows = await db.select().from(subscriptions).where(eq(subscriptions.endUserId, id));
    return { success: true, requestId: req.id, data: rows };
  });

  app.get('/meta/options', async (req) => {
    await requirePermission(req, 'users.read');
    const [groupRows, planRows] = await Promise.all([
      db.select({ id: configGroups.id, name: configGroups.name }).from(configGroups),
      db.select({ id: plans.id, name: plans.name }).from(plans).where(eq(plans.active, true)),
    ]);
    return { success: true, requestId: req.id, data: { groups: groupRows, plans: planRows } };
  });
}
