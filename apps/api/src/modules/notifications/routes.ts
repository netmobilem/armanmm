import type { FastifyInstance } from 'fastify';
import { desc, eq, isNull, or } from 'drizzle-orm';
import { db, notifications } from '@vira/db';
import { requireAuth, assertCsrf } from '../../plugins/auth.js';

export async function registerNotificationRoutes(app: FastifyInstance): Promise<void> {
  app.get('/notifications', async (req) => {
    const auth = await requireAuth(req);
    const rows = await db.select().from(notifications)
      .where(or(isNull(notifications.accountId), eq(notifications.accountId, auth.accountId))!)
      .orderBy(desc(notifications.createdAt)).limit(30);
    const unread = rows.filter((r) => !r.readAt).length;
    return { success: true, requestId: req.id, data: { unread, items: rows.map((n) => ({ id: n.id, type: n.type, title: n.title, body: n.body, readAt: n.readAt?.toISOString() ?? null, createdAt: n.createdAt.toISOString() })) } };
  });

  app.post('/notifications/read-all', async (req) => {
    const auth = await requireAuth(req);
    assertCsrf(req, auth);
    await db.update(notifications).set({ readAt: new Date() }).where(or(isNull(notifications.accountId), eq(notifications.accountId, auth.accountId))!);
    return { success: true, requestId: req.id, data: null };
  });
}
