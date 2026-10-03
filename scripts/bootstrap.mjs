#!/usr/bin/env node
/**
 * Production-safe first-boot bootstrap (idempotent):
 *  1. creates the RBAC catalog (roles + permissions) if missing,
 *  2. creates the initial OWNER account ONLY when OWNER_USERNAME and a strong
 *     OWNER_PASSWORD are explicitly provided via environment.
 * Never creates default credentials. Safe to run on every boot.
 */
process.env.DATABASE_PATH ??= './data/vira.db';

const { db, roles, permissions, rolePermissions, accounts } = await import('@vira/db');
const { ROLE_PERMISSIONS, PERMISSIONS } = await import('@vira/shared');
const { hashPassword } = await import('../apps/api/dist/lib/security.js');
const { eq } = await import('drizzle-orm');

// --- 1) RBAC catalog ---
const existingRoles = await db.select().from(roles);
if (existingRoles.length === 0) {
  const permIds = new Map();
  for (const key of PERMISSIONS) {
    const [p] = await db.insert(permissions).values({ key, description: '' }).returning();
    permIds.set(key, p.id);
  }
  for (const [role, perms] of Object.entries(ROLE_PERMISSIONS)) {
    const [r] = await db.insert(roles).values({ name: role, description: `Built-in ${role} role` }).returning();
    for (const p of perms) {
      const id = permIds.get(p);
      if (id) await db.insert(rolePermissions).values({ roleId: r.id, permissionId: id });
    }
  }
  console.log('[bootstrap] RBAC catalog created (5 roles, 36 permissions)');
} else {
  console.log('[bootstrap] RBAC catalog already present — skipped');
}

// --- 2) initial owner (explicit env only) ---
const username = process.env.OWNER_USERNAME;
const password = process.env.OWNER_PASSWORD;
if (!username || !password) {
  console.log('[bootstrap] OWNER_USERNAME/OWNER_PASSWORD not set — skipping owner creation');
} else {
  if (password.length < 12) {
    console.error('[bootstrap] OWNER_PASSWORD too weak (minimum 12 characters) — aborting owner creation');
    process.exit(1);
  }
  const exists = await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.username, username)).limit(1);
  if (exists.length > 0) {
    console.log(`[bootstrap] owner "${username}" already exists — skipped`);
  } else {
    const ownerRole = (await db.select().from(roles).where(eq(roles.name, 'OWNER')).limit(1))[0];
    await db.insert(accounts).values({
      username,
      displayName: process.env.OWNER_DISPLAY_NAME || username,
      passwordHash: hashPassword(password),
      roleId: ownerRole.id,
    });
    console.log(`[bootstrap] owner account "${username}" created`);
  }
}
process.exit(0);
