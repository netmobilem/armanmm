import type { FastifyInstance, FastifyReply } from 'fastify';
import { and, count, gte, isNull, lte, sql } from 'drizzle-orm';
import { db, endUsers, subscriptions, proxyConfigs } from '@vira/db';
import { requirePermission } from '../../plugins/auth.js';

function parseRange(req: { query: unknown }): { from: Date; to: Date } {
  const q = req.query as Record<string, string>;
  const to = q.to ? new Date(q.to) : new Date();
  const from = q.from ? new Date(q.from) : new Date(to.getTime() - 30 * 86_400_000);
  return { from, to };
}

function csv(headers: string[], rows: (string | number)[][]): string {
  return [headers.join(','), ...rows.map((r) => r.map((c) => JSON.stringify(c)).join(','))].join('\n');
}

function maybeCsv(reply: FastifyReply, req: { query: unknown }, name: string, headers: string[], rows: (string | number)[][]): boolean {
  const format = (req.query as Record<string, string>).format;
  if (format === 'csv') {
    reply.header('content-type', 'text/csv').header('content-disposition', `attachment; filename="${name}.csv"`);
    reply.send(csv(headers, rows));
    return true;
  }
  return false;
}

export async function registerReportRoutes(app: FastifyInstance): Promise<void> {
  app.get('/reports/traffic', async (req, reply) => {
    await requirePermission(req, 'audit.read');
    const { from, to } = parseRange(req);
    const rows = await db.all<{ day: string; bytes: string; node: string }>(sql`
      SELECT strftime('%Y-%m-%d', t.period_start / 1000, 'unixepoch') AS day, CAST(COALESCE(SUM(t.bytes),0) AS TEXT) AS bytes, n.name AS node
      FROM traffic_records t JOIN nodes n ON n.id = t.node_id
      WHERE t.period_start >= ${from.getTime()} AND t.period_start <= ${to.getTime()}
      GROUP BY 1, 3 ORDER BY 1`);
    const data = rows.map((r) => ({ day: r.day, node: r.node, bytes: Number(r.bytes) }));
    if (maybeCsv(reply, req, 'traffic-report', ['day', 'node', 'bytes'], data.map((d) => [d.day, d.node, d.bytes]))) return;
    return { success: true, requestId: req.id, data };
  });

  app.get('/reports/users', async (req, reply) => {
    await requirePermission(req, 'users.read');
    const rows = await db.select({ status: endUsers.status, n: count() }).from(endUsers).where(isNull(endUsers.deletedAt) as never).groupBy(endUsers.status);
    const data = rows.map((r) => ({ status: r.status, count: r.n }));
    if (maybeCsv(reply, req, 'users-report', ['status', 'count'], data.map((d) => [d.status, d.count]))) return;
    return { success: true, requestId: req.id, data };
  });

  app.get('/reports/subscriptions', async (req, reply) => {
    await requirePermission(req, 'subscriptions.read');
    const { from, to } = parseRange(req);
    const rows = await db.select({ status: subscriptions.status, n: count(), used: sql<number>`coalesce(sum(traffic_used_bytes),0)` })
      .from(subscriptions).where(and(gte(subscriptions.createdAt, from), lte(subscriptions.createdAt, to))).groupBy(subscriptions.status);
    const data = rows.map((r) => ({ status: r.status, count: r.n, usedBytes: Number(r.used) }));
    if (maybeCsv(reply, req, 'subscriptions-report', ['status', 'count', 'usedBytes'], data.map((d) => [d.status, d.count, d.usedBytes]))) return;
    return { success: true, requestId: req.id, data };
  });

  app.get('/reports/nodes', async (req, reply) => {
    await requirePermission(req, 'nodes.read');
    const rows = await db.all<{ name: string; status: string; bytes: string }>(sql`
      SELECT n.name, n.status, CAST(COALESCE(SUM(t.bytes),0) AS TEXT) AS bytes
      FROM nodes n LEFT JOIN traffic_records t ON t.node_id = n.id
      GROUP BY n.name, n.status ORDER BY n.name`);
    const data = rows.map((r) => ({ node: r.name, status: r.status, bytes: Number(r.bytes) }));
    if (maybeCsv(reply, req, 'nodes-report', ['node', 'status', 'bytes'], data.map((d) => [d.node, d.status, d.bytes]))) return;
    return { success: true, requestId: req.id, data };
  });

  app.get('/reports/configs', async (req, reply) => {
    await requirePermission(req, 'configs.read');
    const rows = await db.select({ protocol: proxyConfigs.protocol, status: proxyConfigs.status, n: count() })
      .from(proxyConfigs).where(isNull(proxyConfigs.deletedAt) as never).groupBy(proxyConfigs.protocol, proxyConfigs.status);
    const data = rows.map((r) => ({ protocol: r.protocol, status: r.status, count: r.n }));
    if (maybeCsv(reply, req, 'configs-report', ['protocol', 'status', 'count'], data.map((d) => [d.protocol, d.status, d.count]))) return;
    return { success: true, requestId: req.id, data };
  });
}
