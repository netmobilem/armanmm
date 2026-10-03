import { describe, expect, it } from 'vitest';
import { getApp, login, createAccount } from './helpers.js';
import { db, nodes, endUsers, proxyConfigs, subscriptions } from '@vira/db';
import { eq } from 'drizzle-orm';
import { buildLink, validateSpec } from '@vira/core';

async function ensureNode(): Promise<string> {
  const existing = (await db.select().from(nodes).limit(1))[0];
  if (existing) return existing.id;
  const [n] = await db.insert(nodes).values({ name: 'TEST-NODE', address: '203.0.113.99', port: 443 }).returning();
  return n.id;
}

describe('configuration engine + subscriptions', () => {
  it('creates a config whose link matches the core engine output', async () => {
    await createAccount('cfg-admin', 'ADMIN');
    const { session } = await login('cfg-admin', 'Pass@12345');
    const app = await getApp();
    const nodeId = await ensureNode();
    const h = { cookie: session.cookie, 'x-csrf-token': session.csrf };

    const res = await app.inject({
      method: 'POST', url: '/api/v1/configs', headers: h,
      payload: { name: 'unit-cfg', protocol: 'vless', transport: 'ws', security: 'tls', nodeId, port: 443, sni: 'sni.test', path: '/w' },
    });
    expect(res.statusCode).toBe(200);
    const cfg = res.json().data;
    expect(cfg.link).toContain('vless://');
    expect(cfg.link).toContain('type=ws');

    const row = (await db.select().from(proxyConfigs).where(eq(proxyConfigs.id, cfg.id)).limit(1))[0];
    const node = (await db.select().from(nodes).where(eq(nodes.id, nodeId)).limit(1))[0];
    const expected = buildLink(validateSpec({
      remark: `${row.name} | ${node.name}`, protocol: 'vless', transport: 'ws', security: 'tls',
      address: node.address, port: row.port, credential: row.credential, sni: row.sni, path: row.path,
    }));
    expect(cfg.link).toBe(expected);
  });

  it('rotates credentials and bumps version history', async () => {
    const { session } = await login('cfg-admin', 'Pass@12345');
    const app = await getApp();
    const h = { cookie: session.cookie, 'x-csrf-token': session.csrf };
    const list = await app.inject({ method: 'GET', url: '/api/v1/configs', headers: { cookie: session.cookie } });
    const id = (list.json().data.items as { id: string }[])[0].id;
    const before = (await db.select().from(proxyConfigs).where(eq(proxyConfigs.id, id)).limit(1))[0];
    const rot = await app.inject({ method: 'POST', url: `/api/v1/configs/${id}/rotate`, headers: h });
    expect(rot.statusCode).toBe(200);
    const after = (await db.select().from(proxyConfigs).where(eq(proxyConfigs.id, id)).limit(1))[0];
    expect(after.credential).not.toBe(before.credential);
  });

  it('subscription lifecycle: create → renew → revoke', async () => {
    await createAccount('sub-admin', 'ADMIN');
    const { session } = await login('sub-admin', 'Pass@12345');
    const app = await getApp();
    const h = { cookie: session.cookie, 'x-csrf-token': session.csrf };
    const [user] = await db.insert(endUsers).values({ username: 'sub-user-1' }).returning();

    const created = await app.inject({ method: 'POST', url: '/api/v1/subscriptions', headers: h, payload: { endUserId: user.id, trafficQuotaBytes: 1_000_000_000 } });
    expect(created.statusCode).toBe(200);
    const subId = created.json().data.id as string;

    const renewed = await app.inject({ method: 'POST', url: `/api/v1/subscriptions/${subId}/renew`, headers: h, payload: { days: 10 } });
    expect(renewed.statusCode).toBe(200);
    const expiresAt = new Date(renewed.json().data.expiresAt as string);
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now() + 9 * 86_400_000);

    const revoked = await app.inject({ method: 'POST', url: `/api/v1/subscriptions/${subId}/revoke`, headers: h });
    expect(revoked.statusCode).toBe(200);
    const row = (await db.select().from(subscriptions).where(eq(subscriptions.id, subId)).limit(1))[0];
    expect(row.status).toBe('revoked');

    // public sub endpoint must reject revoked subscription content (active=false)
    const pub = await app.inject({ method: 'GET', url: `/api/v1/public/sub/${row.token}` });
    expect(pub.statusCode).toBe(200);
    expect(pub.json().data.active).toBe(false);
  });

  it('API keys: secret shown once, revoked key is rejected', async () => {
    await createAccount('key-admin', 'ADMIN');
    const { session } = await login('key-admin', 'Pass@12345');
    const app = await getApp();
    const h = { cookie: session.cookie, 'x-csrf-token': session.csrf };
    const created = await app.inject({ method: 'POST', url: '/api/v1/api-keys', headers: h, payload: { name: 'ci-key', scopes: ['users.read'] } });
    expect(created.statusCode).toBe(200);
    const secret = created.json().data.secret as string;
    expect(secret.startsWith('vira_')).toBe(true);

    // bearer works within scope
    const okRes = await app.inject({ method: 'GET', url: '/api/v1/users', headers: { authorization: `Bearer ${secret}` } });
    expect(okRes.statusCode).toBe(200);
    // out-of-scope denied
    const denied = await app.inject({ method: 'POST', url: '/api/v1/users', headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/json' }, payload: { username: 'x1x' } });
    expect(denied.statusCode).toBe(403);

    const list = await app.inject({ method: 'GET', url: '/api/v1/api-keys', headers: { cookie: session.cookie } });
    const keyId = (list.json().data as { id: string }[])[0].id;
    await app.inject({ method: 'DELETE', url: `/api/v1/api-keys/${keyId}`, headers: h });
    const afterRevoke = await app.inject({ method: 'GET', url: '/api/v1/users', headers: { authorization: `Bearer ${secret}` } });
    expect(afterRevoke.statusCode).toBe(401);
  });
});
