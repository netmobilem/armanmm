import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, configGroups } from '@vira/db';
import { requirePermission, assertCsrf } from '../../plugins/auth.js';
import { ApiError } from '../../lib/errors.js';
import { audit } from '../../lib/audit.js';
import type { GroupDto } from '@vira/shared';

const bodySchema = z.object({
  name: z.string().min(1).max(64),
  description: z.string().max(500).default(''),
  allowedProtocols: z.array(z.enum(['vless', 'vmess', 'trojan'])).default([]),
});

const map = (g: typeof configGroups.$inferSelect): GroupDto => ({
  id: g.id, name: g.name, description: g.description,
  allowedProtocols: g.allowedProtocols as GroupDto['allowedProtocols'], createdAt: g.createdAt.toISOString(),
});

export async function registerGroupRoutes(app: FastifyInstance): Promise<void> {
  app.get('/groups', async (req) => {
    await requirePermission(req, 'groups.read');
    const rows = await db.select().from(configGroups);
    return { success: true, requestId: req.id, data: rows.map(map) };
  });

  app.post('/groups', async (req) => {
    const auth = await requirePermission(req, 'groups.create');
    assertCsrf(req, auth);
    const body = bodySchema.parse(req.body ?? {});
    const [row] = await db.insert(configGroups).values(body).returning();
    audit(req, { actorId: auth.accountId, actorName: auth.username, action: 'GROUP_CREATED', resourceType: 'group', resourceId: row.id });
    return { success: true, requestId: req.id, data: map(row) };
  });

  app.patch('/groups/:id', async (req) => {
    const auth = await requirePermission(req, 'groups.update');
    assertCsrf(req, auth);
    const body = bodySchema.partial().parse(req.body ?? {});
    const [row] = await db.update(configGroups).set(body).where(eq(configGroups.id, (req.params as { id: string }).id)).returning();
    if (!row) throw ApiError.notFound('Group not found');
    audit(req, { actorId: auth.accountId, actorName: auth.username, action: 'GROUP_UPDATED', resourceType: 'group', resourceId: row.id });
    return { success: true, requestId: req.id, data: map(row) };
  });

  app.delete('/groups/:id', async (req) => {
    const auth = await requirePermission(req, 'groups.delete');
    assertCsrf(req, auth);
    await db.delete(configGroups).where(eq(configGroups.id, (req.params as { id: string }).id));
    audit(req, { actorId: auth.accountId, actorName: auth.username, action: 'GROUP_DELETED', resourceType: 'group', resourceId: (req.params as { id: string }).id });
    return { success: true, requestId: req.id, data: null };
  });
}
