import type { FastifyInstance } from 'fastify';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db, nodes, nodeMetrics, proxyConfigs, subscriptions, endUsers, trafficRecords } from '@vira/db';
import { sha256 } from '../../lib/security.js';
import { ApiError } from '../../lib/errors.js';
import { publishEvent } from '../../lib/redis.js';

const heartbeatSchema = z.object({
  cpu: z.number().min(0).max(100),
  memory: z.number().min(0).max(100),
  disk: z.number().min(0).max(100).default(0),
  connections: z.number().int().min(0).default(0),
  trafficIn: z.number().int().min(0).default(0),
  trafficOut: z.number().int().min(0).default(0),
  latencyMs: z.number().int().min(0).max(10000).nullish(),
  version: z.string().max(40).nullish(),
  usage: z.array(z.object({ credential: z.string().max(128), bytes: z.number().int().min(0).max(1e12) })).max(500).default([]),
});

/** Authenticated node-agent API: identity proven by possession of the node agent token. */
export async function registerAgentRoutes(app: FastifyInstance): Promise<void> {
  app.post('/agent/heartbeat', { config: { rateLimit: { max: 120, timeWindow: 60_000 } } }, async (req) => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer vira-node-')) throw ApiError.unauthorized('Node agent token required');
    const token = header.slice('Bearer '.length);
    const node = (await db.select().from(nodes).where(eq(nodes.agentTokenHash, sha256(token))).limit(1))[0];
    if (!node) throw ApiError.unauthorized('Unknown node agent');

    const body = heartbeatSchema.parse(req.body ?? {});
    const status = !node.enabled ? 'maintenance' : body.cpu > 90 || body.memory > 90 ? 'degraded' : 'online';
    await db.update(nodes).set({
      status,
      latencyMs: body.latencyMs ?? node.latencyMs,
      version: body.version ?? node.version,
      lastHeartbeatAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(nodes.id, node.id));
    await db.insert(nodeMetrics).values({
      nodeId: node.id, cpu: body.cpu, memory: body.memory, disk: body.disk,
      connections: body.connections, trafficIn: body.trafficIn, trafficOut: body.trafficOut,
    });

    // Per-credential usage accounting → subscription + user traffic, hourly traffic records.
    if (body.usage.length > 0) {
      const periodStart = new Date(Math.floor(Date.now() / 3_600_000) * 3_600_000);
      for (const u of body.usage) {
        const config = (await db.select().from(proxyConfigs).where(and(eq(proxyConfigs.credential, u.credential), eq(proxyConfigs.status, 'active'))).limit(1))[0];
        if (!config?.endUserId) continue;
        const sub = (await db.select().from(subscriptions).where(and(eq(subscriptions.endUserId, config.endUserId), eq(subscriptions.status, 'active'))).limit(1))[0];
        if (!sub) continue;
        await db.update(subscriptions).set({ trafficUsedBytes: sql`${subscriptions.trafficUsedBytes} + ${u.bytes}`, updatedAt: new Date() }).where(eq(subscriptions.id, sub.id));
        await db.update(endUsers).set({ trafficUsedBytes: sql`${endUsers.trafficUsedBytes} + ${u.bytes}`, lastActiveAt: new Date() }).where(eq(endUsers.id, config.endUserId));
        await db.insert(trafficRecords).values({ subscriptionId: sub.id, nodeId: node.id, bytes: u.bytes, periodStart });
      }
    }
    await publishEvent({ type: 'nodes-updated' });
    return { success: true, requestId: req.id, data: { acknowledged: true } };
  });
}
