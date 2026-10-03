import { execSync } from 'node:child_process';
import { beforeAll } from 'vitest';

beforeAll(async () => {
  execSync('node scripts/migrate.mjs --reset', { stdio: 'pipe', env: { ...process.env } });
  const { db, roles, permissions, rolePermissions } = await import('@vira/db');
  const { ROLE_PERMISSIONS, PERMISSIONS } = await import('@vira/shared');
  const existing = await db.select().from(roles);
  if (existing.length === 0) {
    const permIds = new Map<string, string>();
    for (const key of PERMISSIONS) {
      const [p] = await db.insert(permissions).values({ key }).returning();
      permIds.set(key, p.id);
    }
    for (const [role, perms] of Object.entries(ROLE_PERMISSIONS)) {
      const [r] = await db.insert(roles).values({ name: role }).returning();
      for (const p of perms) {
        const id = permIds.get(p);
        if (id) await db.insert(rolePermissions).values({ roleId: r.id, permissionId: id });
      }
    }
  }
});
