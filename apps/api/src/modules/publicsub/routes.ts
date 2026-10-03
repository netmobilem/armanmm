import type { FastifyInstance } from 'fastify';
import { and, eq, isNull } from 'drizzle-orm';
import { db, subscriptions, endUsers, proxyConfigs, nodes } from '@vira/db';
import { ApiError } from '../../lib/errors.js';
import { buildSubscriptionBody } from '@vira/core';
import { configLink } from '../configs/routes.js';

async function resolveSub(token: string) {
  const sub = (await db.select().from(subscriptions).where(eq(subscriptions.token, token)).limit(1))[0];
  if (!sub) throw ApiError.notFound('Subscription not found');
  const user = (await db.select().from(endUsers).where(and(eq(endUsers.id, sub.endUserId), isNull(endUsers.deletedAt))).limit(1))[0];
  if (!user) throw ApiError.notFound('Subscription not found');
  const configs = await db
    .select({ config: proxyConfigs, node: nodes })
    .from(proxyConfigs)
    .innerJoin(nodes, eq(proxyConfigs.nodeId, nodes.id))
    .where(and(eq(proxyConfigs.endUserId, user.id), eq(proxyConfigs.status, 'active'), isNull(proxyConfigs.deletedAt)));
  return { sub, user, configs };
}

function isActive(sub: typeof subscriptions.$inferSelect, user: typeof endUsers.$inferSelect): boolean {
  if (sub.status !== 'active' || user.status !== 'active') return false;
  if (sub.expiresAt && sub.expiresAt < new Date()) return false;
  if (sub.trafficQuotaBytes > 0 && sub.trafficUsedBytes >= sub.trafficQuotaBytes) return false;
  return true;
}

/** Public, token-protected subscription endpoints (no session auth — the token IS the secret). */
export async function registerPublicSubRoutes(app: FastifyInstance): Promise<void> {
  // Raw subscription body for client apps (v2rayNG, Nekobox, …)
  app.get('/sub/:token', async (req, reply) => {
    const { token } = req.params as { token: string };
    const { sub, user, configs } = await resolveSub(token);
    await db.update(endUsers).set({ lastActiveAt: new Date() }).where(eq(endUsers.id, user.id)).catch(() => {});
    const links = configs.map((c) => configLink(c.config, c.node.address, c.node.name));
    const format = (req.query as Record<string, string>).format === 'plain' ? 'plain' : 'base64';
    reply.header('content-type', 'text/plain; charset=utf-8');
    reply.header('subscription-userinfo', `upload=0; download=${sub.trafficUsedBytes}; total=${sub.trafficQuotaBytes}; expire=${sub.expiresAt ? Math.floor(sub.expiresAt.getTime() / 1000) : 0}`);
    reply.header('profile-title', encodeURIComponent(user.displayName || user.username));
    return buildSubscriptionBody(links, format);
  });

  // JSON payload for the built-in mobile-first subscription page (/sub/:token SPA route)
  app.get('/public/sub/:token', async (req) => {
    const { token } = req.params as { token: string };
    const { sub, user, configs } = await resolveSub(token);
    await db.update(endUsers).set({ lastActiveAt: new Date() }).where(eq(endUsers.id, user.id)).catch(() => {});
    const active = isActive(sub, user);
    return {
      success: true,
      requestId: req.id,
      data: {
        username: user.displayName || user.username,
        active,
        status: sub.status,
        startedAt: sub.startedAt.toISOString(),
        expiresAt: sub.expiresAt?.toISOString() ?? null,
        daysLeft: sub.expiresAt ? Math.max(0, Math.ceil((sub.expiresAt.getTime() - Date.now()) / 86_400_000)) : null,
        trafficQuotaBytes: sub.trafficQuotaBytes,
        trafficUsedBytes: sub.trafficUsedBytes,
        subUrl: `/sub/${token}`,
        configs: configs.map((c) => ({
          id: c.config.id,
          name: c.config.name,
          protocol: c.config.protocol,
          transport: c.config.transport,
          security: c.config.security,
          nodeName: c.node.name,
          location: c.node.location,
          link: active ? configLink(c.config, c.node.address, c.node.name) : null,
        })),
      },
    };
  });
}
