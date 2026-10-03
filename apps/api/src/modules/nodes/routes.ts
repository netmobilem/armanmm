import type { FastifyInstance, FastifyRequest } from 'fastify';
import { desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { connect } from 'node:net';
import { db, nodes, nodeMetrics } from '@vira/db';
import { requirePermission, assertCsrf } from '../../plugins/auth.js';
import { ApiError } from '../../lib/errors.js';
import { audit, notify } from '../../lib/audit.js';
import { newToken, sha256 } from '../../lib/security.js';
import { parsePage, paginated } from '../../lib/pagination.js';
import { publishEvent } from '../../lib/redis.js';
import type { NodeDto } from '@vira/shared';

const bodySchema = z.object({
  name: z.string().min(1).max(80),
  location: z.string().max(80).default(''),
  address: z.string().min(1).max(255),
  port: z.number().int().min(1).max(65535).default(443),
  core: z.string().max(40).default('xray'),
});

export function mapNode(n: typeof nodes.$inferSelect, metric?: typeof nodeMetrics.$inferSelect | null): NodeDto {
  return {
    id: n.id, name: n.name, location: n.location, address: n.address, port: n.port, core: n.core,
    status: n.status as NodeDto['status'], enabled: n.enabled,
    latencyMs: n.latencyMs, lastHeartbeatAt: n.lastHeartbeatAt?.toISOString() ?? null, version: n.version,
    metrics: metric ? { cpu: metric.cpu, memory: metric.memory, disk: metric.disk, connections: metric.connections, trafficIn: metric.trafficIn, trafficOut: metric.trafficOut } : null,
    createdAt: n.createdAt.toISOString(),
  };
}

export async function latestMetrics(nodeIds: string[]) {
  if (nodeIds.length === 0) return new Map<string, typeof nodeMetrics.$inferSelect>();
  const rows = await db.all<{ node_id: string; cpu: number; memory: number; disk: number; connections: number; traffic_in: string | number; traffic_out: string | number }>(sql`
    SELECT m.node_id, m.cpu, m.memory, m.disk, m.connections, m.traffic_in, m.traffic_out
    FROM node_metrics m
    JOIN (SELECT node_id, MAX(created_at) AS last_at FROM node_metrics GROUP BY node_id) latest
      ON latest.node_id = m.node_id AND latest.last_at = m.created_at`);
  const map = new Map<string, typeof nodeMetrics.$inferSelect>();
  for (const r of rows) {
    map.set(r.node_id, { id: '', nodeId: r.node_id, cpu: Number(r.cpu), memory: Number(r.memory), disk: Number(r.disk), connections: Number(r.connections), trafficIn: Number(r.traffic_in), trafficOut: Number(r.traffic_out), createdAt: new Date() });
  }
  return map;
}

export async function registerNodeRoutes(app: FastifyInstance): Promise<void> {
  app.get('/nodes', async (req) => {
    await requirePermission(req, 'nodes.read');
    const q = parsePage(req);
    const rows = await db.select().from(nodes).orderBy(desc(nodes.createdAt));
    const metrics = await latestMetrics(rows.map((r) => r.id));
    const filtered = rows.filter((r) => !q.search || r.name.toLowerCase().includes(q.search.toLowerCase()));
    return { success: true, requestId: req.id, data: paginated(filtered.map((r) => mapNode(r, metrics.get(r.id) ?? null)), rows.length, q) };
  });

  app.post('/nodes', async (req) => {
    const auth = await requirePermission(req, 'nodes.create');
    assertCsrf(req, auth);
    const body = bodySchema.parse(req.body ?? {});
    const [row] = await db.insert(nodes).values({ ...body, status: 'starting' }).returning();
    audit(req, { actorId: auth.accountId, actorName: auth.username, action: 'NODE_ADDED', resourceType: 'node', resourceId: row.id });
    await notify('node', 'Node added', `Node ${row.name} registered and awaiting first heartbeat`);
    await publishEvent({ type: 'nodes-updated' });
    return { success: true, requestId: req.id, data: mapNode(row) };
  });

  app.get('/nodes/:id', async (req) => {
    await requirePermission(req, 'nodes.read');
    const { id } = req.params as { id: string };
    const row = (await db.select().from(nodes).where(eq(nodes.id, id)).limit(1))[0];
    if (!row) throw ApiError.notFound('Node not found');
    const metrics = await db.select().from(nodeMetrics).where(eq(nodeMetrics.nodeId, id)).orderBy(desc(nodeMetrics.createdAt)).limit(24);
    return { success: true, requestId: req.id, data: { node: mapNode(row, metrics[0] ?? null), history: metrics.map((m) => ({ cpu: m.cpu, memory: m.memory, connections: m.connections, trafficIn: m.trafficIn, trafficOut: m.trafficOut, at: m.createdAt.toISOString() })) } };
  });

  app.patch('/nodes/:id', async (req) => {
    const auth = await requirePermission(req, 'nodes.update');
    assertCsrf(req, auth);
    const { id } = req.params as { id: string };
    const body = bodySchema.partial().parse(req.body ?? {});
    const [row] = await db.update(nodes).set({ ...body, updatedAt: new Date() }).where(eq(nodes.id, id)).returning();
    if (!row) throw ApiError.notFound('Node not found');
    audit(req, { actorId: auth.accountId, actorName: auth.username, action: 'NODE_UPDATED', resourceType: 'node', resourceId: id });
    await publishEvent({ type: 'nodes-updated' });
    return { success: true, requestId: req.id, data: mapNode(row) };
  });

  app.delete('/nodes/:id', async (req) => {
    const auth = await requirePermission(req, 'nodes.delete');
    assertCsrf(req, auth);
    const { id } = req.params as { id: string };
    await db.delete(nodes).where(eq(nodes.id, id));
    audit(req, { actorId: auth.accountId, actorName: auth.username, action: 'NODE_DELETED', resourceType: 'node', resourceId: id });
    await publishEvent({ type: 'nodes-updated' });
    return { success: true, requestId: req.id, data: null };
  });

  const setEnabled = async (req: FastifyRequest, enabled: boolean, action: string) => {
    const auth = await requirePermission(req, 'nodes.update');
    assertCsrf(req, auth);
    const { id } = req.params as { id: string };
    const [row] = await db.update(nodes).set({ enabled, status: enabled ? 'starting' : 'maintenance', updatedAt: new Date() }).where(eq(nodes.id, id)).returning();
    if (!row) throw ApiError.notFound('Node not found');
    audit(req, { actorId: auth.accountId, actorName: auth.username, action, resourceType: 'node', resourceId: id });
    await publishEvent({ type: 'nodes-updated' });
    return { success: true, requestId: req.id, data: mapNode(row) };
  };
  app.post('/nodes/:id/enable', async (req) => setEnabled(req, true, 'NODE_ENABLED'));
  app.post('/nodes/:id/disable', async (req) => setEnabled(req, false, 'NODE_DISABLED'));

  app.post('/nodes/:id/agent-token', async (req) => {
    const auth = await requirePermission(req, 'nodes.update');
    assertCsrf(req, auth);
    const { id } = req.params as { id: string };
    const token = `vira-node-${newToken(24)}`;
    const [row] = await db.update(nodes).set({ agentTokenHash: sha256(token), updatedAt: new Date() }).where(eq(nodes.id, id)).returning();
    if (!row) throw ApiError.notFound('Node not found');
    audit(req, { actorId: auth.accountId, actorName: auth.username, action: 'NODE_AGENT_TOKEN_ISSUED', resourceType: 'node', resourceId: id });
    return { success: true, requestId: req.id, data: { token } }; // shown once
  });

  app.post('/nodes/:id/test', async (req) => {
    const auth = await requirePermission(req, 'nodes.read');
    const { id } = req.params as { id: string };
    const row = (await db.select().from(nodes).where(eq(nodes.id, id)).limit(1))[0];
    if (!row) throw ApiError.notFound('Node not found');
    const started = Date.now();
    const result = await new Promise<{ ok: boolean; latencyMs: number }>((resolvePromise) => {
      const socket = connect({ host: row.address, port: row.port, timeout: 3000 });
      socket.once('connect', () => { resolvePromise({ ok: true, latencyMs: Date.now() - started }); socket.destroy(); });
      socket.once('timeout', () => { resolvePromise({ ok: false, latencyMs: -1 }); socket.destroy(); });
      socket.once('error', () => { resolvePromise({ ok: false, latencyMs: -1 }); socket.destroy(); });
    });
    audit(req, { actorId: auth.accountId, actorName: auth.username, action: 'NODE_CONNECTION_TEST', resourceType: 'node', resourceId: id, result: result.ok ? 'success' : 'error' });
    return { success: true, requestId: req.id, data: result };
  });
}
