import type { FastifyInstance } from 'fastify';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { db, accounts, roles, sessions } from '@vira/db';
import { requirePermission, assertCsrf } from '../../plugins/auth.js';
import { ApiError } from '../../lib/errors.js';
import { audit } from '../../lib/audit.js';
import { hashPassword, newToken } from '../../lib/security.js';
import { ROLES } from '@vira/shared';

const createSchema = z.object({
  username: z.string().regex(/^[a-z0-9_.-]{3,32}$/),
  password: z.string().min(8).max(128),
  displayName: z.string().max(64).default(''),
  role: z.enum(['ADMIN', 'SUPPORT', 'VIEWER', 'RESELLER']),
  email: z.string().email().nullish(),
});

export async function registerAdminRoutes(app: FastifyInstance): Promise<void> {
  const roleIdMap = async () => {
    const rows = await db.select().from(roles);
    return new Map(rows.map((r) => [r.name, r.id]));
  };

  app.get('/admins', async (req) => {
    const auth = await requirePermission(req, 'admins.manage');
    const map = await roleIdMap();
    const staffRoleIds = [map.get('OWNER'), map.get('ADMIN'), map.get('SUPPORT'), map.get('VIEWER'), map.get('RESELLER')].filter(Boolean) as string[];
    const rows = await db.select({ account: accounts, roleName: roles.name }).from(accounts).innerJoin(roles, eq(accounts.roleId, roles.id)).where(inArray(accounts.roleId, staffRoleIds));
    return {
      success: true, requestId: req.id,
      data: rows.map((r) => ({ id: r.account.id, username: r.account.username, displayName: r.account.displayName, email: r.account.email, role: r.roleName, status: r.account.status, createdAt: r.account.createdAt.toISOString(), isSelf: r.account.id === auth.accountId })),
    };
  });

  app.post('/admins', async (req) => {
    const auth = await requirePermission(req, 'admins.manage');
    assertCsrf(req, auth);
    const body = createSchema.parse(req.body ?? {});
    const dup = (await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.username, body.username)).limit(1))[0];
    if (dup) throw ApiError.conflict('Username already exists');
    const map = await roleIdMap();
    const roleId = map.get(body.role);
    if (!roleId) throw ApiError.notFound('Role not found');
    const [row] = await db.insert(accounts).values({ username: body.username, displayName: body.displayName || body.username, email: body.email ?? null, passwordHash: hashPassword(body.password), roleId }).returning();
    audit(req, { actorId: auth.accountId, actorName: auth.username, action: 'ADMIN_CREATED', resourceType: 'account', resourceId: row.id, metadata: { role: body.role } });
    return { success: true, requestId: req.id, data: { id: row.id, username: row.username } };
  });

  app.patch('/admins/:id', async (req) => {
    const auth = await requirePermission(req, 'admins.manage');
    assertCsrf(req, auth);
    const { id } = req.params as { id: string };
    const body = z.object({ role: z.enum(ROLES).optional(), status: z.enum(['active', 'disabled']).optional(), displayName: z.string().max(64).optional() }).parse(req.body ?? {});
    if (id === auth.accountId && (body.status === 'disabled' || (body.role && body.role !== 'OWNER'))) {
      throw new ApiError('VALIDATION_ERROR', 'You cannot demote or disable your own account', 400);
    }
    const map = await roleIdMap();
    const roleId = body.role ? map.get(body.role) : undefined;
    await db.update(accounts).set({
      ...(roleId ? { roleId } : {}),
      ...(body.status ? { status: body.status } : {}),
      ...(body.displayName ? { displayName: body.displayName } : {}),
      updatedAt: new Date(),
    }).where(eq(accounts.id, id));
    audit(req, { actorId: auth.accountId, actorName: auth.username, action: 'ADMIN_UPDATED', resourceType: 'account', resourceId: id, metadata: body });
    return { success: true, requestId: req.id, data: null };
  });

  app.post('/admins/:id/reset-password', async (req) => {
    const auth = await requirePermission(req, 'admins.manage');
    assertCsrf(req, auth);
    const { id } = req.params as { id: string };
    const temp = `Temp-${newToken(8)}-1Aa`;
    await db.update(accounts).set({ passwordHash: hashPassword(temp), updatedAt: new Date() }).where(eq(accounts.id, id));
    await db.update(sessions).set({ revokedAt: new Date() }).where(and(eq(sessions.accountId, id), isNull(sessions.revokedAt)));
    audit(req, { actorId: auth.accountId, actorName: auth.username, action: 'ADMIN_PASSWORD_RESET', resourceType: 'account', resourceId: id });
    return { success: true, requestId: req.id, data: { temporaryPassword: temp } }; // operator hands it over securely
  });

  app.post('/admins/:id/revoke-sessions', async (req) => {
    const auth = await requirePermission(req, 'admins.manage');
    assertCsrf(req, auth);
    const { id } = req.params as { id: string };
    await db.update(sessions).set({ revokedAt: new Date() }).where(and(eq(sessions.accountId, id), isNull(sessions.revokedAt)));
    audit(req, { actorId: auth.accountId, actorName: auth.username, action: 'ADMIN_SESSIONS_REVOKED', resourceType: 'account', resourceId: id });
    return { success: true, requestId: req.id, data: null };
  });
}
