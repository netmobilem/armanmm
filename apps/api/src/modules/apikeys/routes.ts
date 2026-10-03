import type { FastifyInstance } from 'fastify';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { randomBytes } from 'node:crypto';
import { db, apiKeys } from '@vira/db';
import { requirePermission, assertCsrf } from '../../plugins/auth.js';
import { ApiError } from '../../lib/errors.js';
import { audit } from '../../lib/audit.js';
import { sha256 } from '../../lib/security.js';
import { PERMISSIONS } from '@vira/shared';

const createSchema = z.object({
  name: z.string().min(1).max(64),
  scopes: z.array(z.string()).default(['*']),
  ipAllowlist: z.array(z.string().ip()).default([]),
  rateLimit: z.number().int().min(1).max(1000).default(60),
  expiresDays: z.number().int().min(1).max(365).nullish(),
});

export async function registerApiKeyRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api-keys', async (req) => {
    const auth = await requirePermission(req, 'apikeys.read');
    const rows = await db.select().from(apiKeys).where(and(eq(apiKeys.accountId, auth.accountId), isNull(apiKeys.revokedAt)));
    return {
      success: true, requestId: req.id,
      data: rows.map((k) => ({ id: k.id, name: k.name, prefix: k.prefix, scopes: k.scopes, ipAllowlist: k.ipAllowlist, rateLimit: k.rateLimit, lastUsedAt: k.lastUsedAt?.toISOString() ?? null, expiresAt: k.expiresAt?.toISOString() ?? null, createdAt: k.createdAt.toISOString() })),
    };
  });

  app.post('/api-keys', async (req) => {
    const auth = await requirePermission(req, 'apikeys.create');
    assertCsrf(req, auth);
    const body = createSchema.parse(req.body ?? {});
    for (const s of body.scopes) {
      if (s !== '*' && !(PERMISSIONS as readonly string[]).includes(s)) throw new ApiError('VALIDATION_ERROR', `Unknown scope: ${s}`, 400);
    }
    const raw = `vira_${randomBytes(24).toString('hex')}`;
    const [row] = await db.insert(apiKeys).values({
      accountId: auth.accountId, name: body.name, prefix: raw.slice(0, 12), keyHash: sha256(raw),
      scopes: body.scopes, ipAllowlist: body.ipAllowlist, rateLimit: body.rateLimit,
      expiresAt: body.expiresDays ? new Date(Date.now() + body.expiresDays * 86_400_000) : null,
    }).returning();
    audit(req, { actorId: auth.accountId, actorName: auth.username, action: 'API_KEY_CREATED', resourceType: 'apikey', resourceId: row.id });
    return { success: true, requestId: req.id, data: { id: row.id, prefix: row.prefix, secret: raw } }; // secret shown once
  });

  app.post('/api-keys/:id/rotate', async (req) => {
    const auth = await requirePermission(req, 'apikeys.create');
    assertCsrf(req, auth);
    const { id } = req.params as { id: string };
    const existing = (await db.select().from(apiKeys).where(and(eq(apiKeys.id, id), eq(apiKeys.accountId, auth.accountId))).limit(1))[0];
    if (!existing) throw ApiError.notFound('API key not found');
    const raw = `vira_${randomBytes(24).toString('hex')}`;
    await db.update(apiKeys).set({ keyHash: sha256(raw), prefix: raw.slice(0, 12) }).where(eq(apiKeys.id, id));
    audit(req, { actorId: auth.accountId, actorName: auth.username, action: 'API_KEY_ROTATED', resourceType: 'apikey', resourceId: id });
    return { success: true, requestId: req.id, data: { secret: raw } };
  });

  app.delete('/api-keys/:id', async (req) => {
    const auth = await requirePermission(req, 'apikeys.revoke');
    assertCsrf(req, auth);
    const { id } = req.params as { id: string };
    await db.update(apiKeys).set({ revokedAt: new Date() }).where(and(eq(apiKeys.id, id), eq(apiKeys.accountId, auth.accountId)));
    audit(req, { actorId: auth.accountId, actorName: auth.username, action: 'API_KEY_REVOKED', resourceType: 'apikey', resourceId: id });
    return { success: true, requestId: req.id, data: null };
  });
}
