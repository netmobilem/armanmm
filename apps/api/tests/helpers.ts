import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';

let app: FastifyInstance | null = null;

export async function getApp(): Promise<FastifyInstance> {
  if (!app) {
    app = await buildApp();
    await app.ready();
  }
  return app;
}

export interface CookieSession { cookie: string; csrf: string }

export async function login(username: string, password: string): Promise<{ session: CookieSession; userId: string }> {
  const a = await getApp();
  const res = await a.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { username, password } });
  if (res.statusCode !== 200) throw new Error(`login failed: ${res.statusCode} ${res.body}`);
  const setCookies = res.headers['set-cookie'] as unknown as string[];
  const sid = setCookies.find((c) => c.startsWith('vira_sid='))?.split(';')[0] ?? '';
  const csrfCookie = setCookies.find((c) => c.startsWith('vira_csrf='))?.split(';')[0] ?? '';
  const body = res.json() as { data: { csrf: string; user: { id: string } } };
  return { session: { cookie: `${sid}; ${csrfCookie}`, csrf: body.data.csrf }, userId: body.data.user.id };
}

export async function createAccount(username: string, role: 'OWNER' | 'ADMIN' | 'RESELLER' | 'SUPPORT' | 'VIEWER', password = 'Pass@12345'): Promise<string> {
  const { db, accounts, roles } = await import('@vira/db');
  const { hashPassword } = await import('../src/lib/security.js');
  const roleMap = new Map((await db.select().from(roles)).map((x) => [x.name, x.id]));
  const roleId = roleMap.get(role);
  if (!roleId) throw new Error(`role ${role} missing`);
  const [acc] = await db.insert(accounts).values({ username, displayName: username, passwordHash: hashPassword(password), roleId }).returning();
  return acc.id;
}
