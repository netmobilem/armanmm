import type { FastifyInstance } from 'fastify';
import { and, desc, eq, gte, like, lte } from 'drizzle-orm';
import { db, auditLogs } from '@vira/db';
import { requirePermission } from '../../plugins/auth.js';
import { parsePage, paginated } from '../../lib/pagination.js';
import { count } from 'drizzle-orm';

export async function registerAuditRoutes(app: FastifyInstance): Promise<void> {
  app.get('/audit', async (req) => {
    await requirePermission(req, 'audit.read');
    const q = parsePage(req);
    const f = req.query as Record<string, string>;
    const where = and(
      f.action ? like(auditLogs.action, `%${f.action}%`) : undefined,
      f.result ? eq(auditLogs.result, f.result) : undefined,
      f.actor ? like(auditLogs.actorName, `%${f.actor}%`) : undefined,
      f.from ? gte(auditLogs.createdAt, new Date(f.from)) : undefined,
      f.to ? lte(auditLogs.createdAt, new Date(f.to)) : undefined,
      q.search ? like(auditLogs.action, `%${q.search}%`) : undefined,
    ) as never;
    const [rows, total] = await Promise.all([
      db.select().from(auditLogs).where(where).orderBy(desc(auditLogs.createdAt)).limit(q.pageSize).offset((q.page - 1) * q.pageSize),
      db.select({ n: count() }).from(auditLogs).where(where),
    ]);
    return {
      success: true, requestId: req.id,
      data: paginated(rows.map((a) => ({ id: a.id, actorName: a.actorName, action: a.action, resourceType: a.resourceType, resourceId: a.resourceId, result: a.result, ip: a.ip, metadata: a.metadata, createdAt: a.createdAt.toISOString() })), total[0]?.n ?? 0, q),
    };
  });
}
