import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, plans } from '@vira/db';
import { requirePermission, assertCsrf } from '../../plugins/auth.js';
import { ApiError } from '../../lib/errors.js';
import { audit } from '../../lib/audit.js';
import type { PlanDto } from '@vira/shared';

const bodySchema = z.object({
  name: z.string().min(1).max(64),
  description: z.string().max(500).default(''),
  trafficBytes: z.number().int().min(0).default(0),
  durationDays: z.number().int().min(1).max(3650).default(30),
  price: z.number().int().min(0).default(0),
  active: z.boolean().default(true),
});

const map = (p: typeof plans.$inferSelect): PlanDto => ({
  id: p.id, name: p.name, description: p.description, trafficBytes: p.trafficBytes,
  durationDays: p.durationDays, price: p.price, active: p.active, createdAt: p.createdAt.toISOString(),
});

export async function registerPlanRoutes(app: FastifyInstance): Promise<void> {
  app.get('/plans', async (req) => {
    await requirePermission(req, 'plans.read');
    const rows = await db.select().from(plans);
    return { success: true, requestId: req.id, data: rows.map(map) };
  });

  app.post('/plans', async (req) => {
    const auth = await requirePermission(req, 'plans.create');
    assertCsrf(req, auth);
    const body = bodySchema.parse(req.body ?? {});
    const [row] = await db.insert(plans).values(body).returning();
    audit(req, { actorId: auth.accountId, actorName: auth.username, action: 'PLAN_CREATED', resourceType: 'plan', resourceId: row.id });
    return { success: true, requestId: req.id, data: map(row) };
  });

  app.patch('/plans/:id', async (req) => {
    const auth = await requirePermission(req, 'plans.update');
    assertCsrf(req, auth);
    const body = bodySchema.partial().parse(req.body ?? {});
    const [row] = await db.update(plans).set(body).where(eq(plans.id, (req.params as { id: string }).id)).returning();
    if (!row) throw ApiError.notFound('Plan not found');
    audit(req, { actorId: auth.accountId, actorName: auth.username, action: 'PLAN_UPDATED', resourceType: 'plan', resourceId: row.id });
    return { success: true, requestId: req.id, data: map(row) };
  });

  app.delete('/plans/:id', async (req) => {
    const auth = await requirePermission(req, 'plans.delete');
    assertCsrf(req, auth);
    await db.delete(plans).where(eq(plans.id, (req.params as { id: string }).id));
    audit(req, { actorId: auth.accountId, actorName: auth.username, action: 'PLAN_DELETED', resourceType: 'plan', resourceId: (req.params as { id: string }).id });
    return { success: true, requestId: req.id, data: null };
  });
}
