import type { FastifyInstance } from 'fastify';
import { eq, like, isNull, and } from 'drizzle-orm';
import { db, endUsers, proxyConfigs, nodes, subscriptions, plans } from '@vira/db';
import { requireAuth } from '../../plugins/auth.js';

/** Global search (Ctrl+K): grouped results across core entities, scope-aware. */
export async function registerSearchRoutes(app: FastifyInstance): Promise<void> {
  app.get('/search', async (req) => {
    const auth = await requireAuth(req);
    const q = ((req.query as Record<string, string>).q ?? '').trim();
    if (q.length < 2) return { success: true, requestId: req.id, data: { users: [], configs: [], nodes: [], subscriptions: [], plans: [] } };
    const pattern = `%${q}%`;
    const scope = auth.role === 'RESELLER' ? eq(endUsers.ownerId, auth.accountId) : undefined;

    const [users, configs, nodeList, subs, planList] = await Promise.all([
      db.select({ id: endUsers.id, username: endUsers.username, displayName: endUsers.displayName, status: endUsers.status })
        .from(endUsers).where(and(isNull(endUsers.deletedAt), scope, like(endUsers.username, pattern))!).limit(5),
      db.select({ id: proxyConfigs.id, name: proxyConfigs.name, protocol: proxyConfigs.protocol, status: proxyConfigs.status })
        .from(proxyConfigs).where(and(isNull(proxyConfigs.deletedAt), like(proxyConfigs.name, pattern))!).limit(5),
      db.select({ id: nodes.id, name: nodes.name, location: nodes.location, status: nodes.status })
        .from(nodes).where(like(nodes.name, pattern)).limit(5),
      db.select({ id: subscriptions.id, token: subscriptions.token, status: subscriptions.status, username: endUsers.username })
        .from(subscriptions).innerJoin(endUsers, eq(subscriptions.endUserId, endUsers.id))
        .where(and(scope, like(endUsers.username, pattern))!).limit(5),
      db.select({ id: plans.id, name: plans.name }).from(plans).where(like(plans.name, pattern)).limit(5),
    ]);

    const visibleNodes = auth.role === 'RESELLER' ? [] : nodeList;
    const visiblePlans = auth.role === 'RESELLER' ? [] : planList;
    return { success: true, requestId: req.id, data: { users, configs, nodes: visibleNodes, subscriptions: subs, plans: visiblePlans } };
  });
}
