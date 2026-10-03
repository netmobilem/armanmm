import { describe, expect, it } from 'vitest';
import { getApp, login, createAccount } from './helpers.js';

describe('authentication', () => {
  it('rejects unknown users with a generic message', async () => {
    const app = await getApp();
    const res = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { username: 'ghost', password: 'nope-nope' } });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('INVALID_CREDENTIALS');
  });

  it('logs in with valid credentials and sets httpOnly session + csrf cookies', async () => {
    await createAccount('auth-ok', 'ADMIN');
    const app = await getApp();
    const res = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { username: 'auth-ok', password: 'Pass@12345' } });
    expect(res.statusCode).toBe(200);
    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies.find((c) => c.startsWith('vira_sid='))).toMatch(/httponly/i);
    expect(res.json().data.user.role).toBe('ADMIN');
  });

  it('locks the account after repeated failures', async () => {
    await createAccount('auth-lock', 'VIEWER');
    const app = await getApp();
    for (let i = 0; i < 5; i++) {
      await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { username: 'auth-lock', password: 'wrong-pass-1' } });
    }
    const locked = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { username: 'auth-lock', password: 'Pass@12345' } });
    expect(locked.statusCode).toBe(423);
    expect(locked.json().error.code).toBe('ACCOUNT_LOCKED');
  });

  it('requires authentication for protected routes', async () => {
    const app = await getApp();
    const res = await app.inject({ method: 'GET', url: '/api/v1/users' });
    expect(res.statusCode).toBe(401);
  });

  it('enforces CSRF on session mutations', async () => {
    await createAccount('auth-csrf', 'OWNER');
    const { session } = await login('auth-csrf', 'Pass@12345');
    const app = await getApp();
    const res = await app.inject({
      method: 'POST', url: '/api/v1/users',
      headers: { cookie: session.cookie },
      payload: { username: 'csrf-victim' },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('CSRF_INVALID');
  });

  it('change password revokes other sessions', async () => {
    await createAccount('auth-chpw', 'ADMIN');
    const { session } = await login('auth-chpw', 'Pass@12345');
    const app = await getApp();
    const res = await app.inject({
      method: 'POST', url: '/api/v1/auth/change-password',
      headers: { cookie: session.cookie, 'x-csrf-token': session.csrf },
      payload: { current: 'Pass@12345', next: 'NewPass@12345' },
    });
    expect(res.statusCode).toBe(200);
    const me = await app.inject({ method: 'GET', url: '/api/v1/auth/me', headers: { cookie: session.cookie } });
    expect(me.statusCode).toBe(401);
  });
});
