import type { FastifyInstance } from 'fastify';
import { and, count, desc, eq, gte, isNull, lte, sql } from 'drizzle-orm';
import { db, endUsers, proxyConfigs, subscriptions, nodes, auditLogs } from '@vira/db';
import { workerStatus } from '@vira/worker';
import { requireAuth } from '../../plugins/auth.js';
import { getRedis } from '../../lib/redis.js';
import { mapUser } from '../users/routes.js';
import { mapNode, latestMetrics } from '../nodes/routes.js';

const CACHE_KEY = 'vira:dashboard:v1';
const CACHE_TTL = 8;

export async function registerDashboardRoutes(app: FastifyInstance): Promise<void> {
  app.get('/dashboard', async (req) => {
    await requireAuth(req);
    const redis = getRedis();
    if (redis) {
      const hit = await redis.get(CACHE_KEY).catch(() => null);
      if (hit) return JSON.parse(hit);
    }
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
    const soon = new Date(now.getTime() + 7 * 86_400_000);

    const [activeUsers, recentUsers, activeConfigs, totalTraffic, activeSubs, nodeRows, expiring, recentAudit, configStats, subStats] = await Promise.all([
      db.select({ n: count() }).from(endUsers).where(and(eq(endUsers.status, 'active'), isNull(endUsers.deletedAt))),
      db.select().from(endUsers).where(isNull(endUsers.deletedAt) as never).orderBy(desc(endUsers.createdAt)).limit(5),
      db.select({ n: count() }).from(proxyConfigs).where(and(eq(proxyConfigs.status, 'active'), isNull(proxyConfigs.deletedAt))),
      db.select({ n: sql<number>`coalesce(sum(traffic_used_bytes),0)` }).from(subscriptions),
      db.select({ n: count() }).from(subscriptions).where(eq(subscriptions.status, 'active')),
      db.select().from(nodes),
      db.select({ n: count() }).from(subscriptions).where(and(eq(subscriptions.status, 'active'), gte(subscriptions.expiresAt, now), lte(subscriptions.expiresAt, soon))),
      db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(6),
      db.select({ protocol: proxyConfigs.protocol, n: count() }).from(proxyConfigs).where(isNull(proxyConfigs.deletedAt) as never).groupBy(proxyConfigs.protocol),
      db.select({ status: subscriptions.status, n: count() }).from(subscriptions).groupBy(subscriptions.status),
    ]);

    // 7-day traffic series from traffic_records (fallback: node metric deltas)
    const seriesRows = await db.all<{ day: string; bytes: string }>(sql`
      SELECT strftime('%Y-%m-%d', period_start / 1000, 'unixepoch') AS day, CAST(COALESCE(SUM(bytes),0) AS TEXT) AS bytes
      FROM traffic_records WHERE period_start >= ${weekAgo.getTime()}
      GROUP BY 1 ORDER BY 1`);
    const dayMap = new Map(seriesRows.map((r) => [r.day, Number(r.bytes)]));
    const trafficSeries = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now.getTime() - (6 - i) * 86_400_000);
      const key = d.toISOString().slice(0, 10);
      return { label: key, bytes: dayMap.get(key) ?? 0 };
    });

    const metrics = await latestMetrics(nodeRows.map((n) => n.id));
    const workerAlive = await isWorkerAlive();

    const payload = {
      success: true,
      requestId: req.id,
      data: {
        stats: {
          activeUsers: activeUsers[0]?.n ?? 0,
          activeConfigs: activeConfigs[0]?.n ?? 0,
          totalTrafficBytes: Number(totalTraffic[0]?.n ?? 0),
          activeSubscriptions: activeSubs[0]?.n ?? 0,
          onlineNodes: nodeRows.filter((n) => n.status === 'online' || n.status === 'degraded').length,
          totalNodes: nodeRows.length,
          expiringSoon: expiring[0]?.n ?? 0,
        },
        trafficSeries,
        nodes: nodeRows.slice(0, 4).map((n) => mapNode(n, metrics.get(n.id) ?? null)),
        recentUsers: recentUsers.map(mapUser),
        recentActivity: recentAudit.map((a) => ({ id: a.id, actorName: a.actorName, action: a.action, resourceType: a.resourceType, resourceId: a.resourceId, result: a.result, ip: a.ip, createdAt: a.createdAt.toISOString() })),
        configStats: configStats.map((c) => ({ protocol: c.protocol, count: c.n })),
        subscriptionStats: subStats.map((s) => ({ status: s.status, count: s.n })),
        systemHealth: [
          { component: 'api', status: 'healthy', latencyMs: 0 },
          { component: 'database', status: 'healthy', latencyMs: null },
          { component: 'redis', status: getRedis() ? 'healthy' : 'unknown', latencyMs: null },
          { component: 'worker', status: workerAlive ? 'healthy' : 'unknown', latencyMs: null },
          { component: 'nodes', status: nodeRows.some((n) => n.status === 'offline' && n.enabled) ? 'warning' : 'healthy', latencyMs: null },
        ],
      },
    };
    if (redis) await redis.set(CACHE_KEY, JSON.stringify(payload), 'EX', CACHE_TTL).catch(() => {});
    return payload;
  });
}

async function isWorkerAlive(): Promise<boolean> {
  const redis = getRedis();
  if (redis) {
    const ts = await redis.get('vira:worker:heartbeat').catch(() => null);
    return !!ts && Date.now() - Number(ts) < 60_000;
  }
  // Redis-less: an embedded worker reports via the module singleton.
  return workerStatus.running && Date.now() - workerStatus.lastTickAt < 60_000;
}
