import { describe, expect, it } from 'vitest';
import { getApp, login, createAccount } from './helpers.js';
import { db, endUsers } from '@vira/db';
import { eq } from 'drizzle-orm';

describe('RBAC + user management', () => {
  it('VIEWER cannot create users', async () => {
    await createAccount('rbac-viewer', 'VIEWER');
    const { session } = await login('rbac-viewer', 'Pass@12345');
    const app = await getApp();
    const res = await app.inject({
      method: 'POST', url: '/api/v1/users',
      headers: { cookie: session.cookie, 'x-csrf-token': session.csrf },
      payload: { username: 'nope' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('creates, suspends and soft-deletes a user (with audit trail)', async () => {
    await createAccount('rbac-admin', 'ADMIN');
    const { session } = await login('rbac-admin', 'Pass@12345');
    const app = await getApp();
    const h = { cookie: session.cookie, 'x-csrf-token': session.csrf };

    const created = await app.inject({ method: 'POST', url: '/api/v1/users', headers: h, payload: { username: 'unit-user-1', trafficQuotaBytes: 5_000_000_000 } });
    expect(created.statusCode).toBe(200);
    const id = created.json().data.id as string;

    const susp = await app.inject({ method: 'POST', url: `/api/v1/users/${id}/suspend`, headers: h });
    expect(susp.statusCode).toBe(200);
    const row = (await db.select().from(endUsers).where(eq(endUsers.id, id)).limit(1))[0];
    expect(row.status).toBe('suspended');

    const del = await app.inject({ method: 'DELETE', url: `/api/v1/users/${id}`, headers: h });
    expect(del.statusCode).toBe(200);
    const after = (await db.select().from(endUsers).where(eq(endUsers.id, id)).limit(1))[0];
    expect(after.deletedAt).not.toBeNull();

    const auditRes = await app.inject({ method: 'GET', url: '/api/v1/audit?search=USER_CREATED', headers: { cookie: session.cookie } });
    expect(auditRes.statusCode).toBe(200);
    expect(auditRes.json().data.total).toBeGreaterThan(0);
  });

  it('isolates reseller data at the backend level', async () => {
    const resellerId = await createAccount('rbac-reseller', 'RESELLER');
    await createAccount('rbac-owner2', 'OWNER');
    const { db: d, endUsers: eu } = await import('@vira/db');
    await d.insert(eu).values({ username: 'reseller-owned', ownerId: resellerId });
    await d.insert(eu).values({ username: 'globally-owned' });

    const { session } = await login('rbac-reseller', 'Pass@12345');
    const app = await getApp();
    const res = await app.inject({ method: 'GET', url: '/api/v1/users?pageSize=100', headers: { cookie: session.cookie } });
    const names = (res.json().data.items as { username: string }[]).map((u) => u.username);
    expect(names).toContain('reseller-owned');
    expect(names).not.toContain('globally-owned');

    // direct fetch of a foreign user must 404
    const foreign = await d.select().from(eu).where(eq(eu.username, 'globally-owned')).limit(1);
    const one = await app.inject({ method: 'GET', url: `/api/v1/users/${foreign[0].id}`, headers: { cookie: session.cookie } });
    expect(one.statusCode).toBe(404);
  });
});
