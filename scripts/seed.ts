/**
 * Development seed. Clearly marks demo data. NEVER run against production
 * with default credentials (guarded by NODE_ENV + explicit flag).
 */
import { randomUUID } from 'node:crypto';
process.env.DATABASE_PATH ??= './data/vira.db';
const { db, accounts, roles, permissions, rolePermissions, endUsers, nodes, nodeMetrics, configGroups, plans, proxyConfigs, subscriptions, auditLogs, notifications, trafficRecords, systemSettings } = await import('@vira/db');
const { ROLE_PERMISSIONS, PERMISSIONS } = await import('@vira/shared');
const { hashPassword } = await import('../apps/api/src/lib/security.js');
const { newCredential } = await import('@vira/core');
import { eq, count } from 'drizzle-orm';

if (process.env.NODE_ENV === 'production' && !process.argv.includes('--force')) {
  console.error('[seed] refusing to seed a production database without --force');
  process.exit(1);
}

const existing = (await db.select({ n: count() }).from(accounts))[0]?.n ?? 0;
if (existing > 0) {
  console.log('[seed] database already seeded — skipping');
  process.exit(0);
}
console.log('[seed] creating development demo data…');

// --- roles & permissions ---
const roleIds: Record<string, string> = {};
for (const [role, perms] of Object.entries(ROLE_PERMISSIONS)) {
  const [r] = await db.insert(roles).values({ name: role, description: `Built-in ${role} role` }).returning();
  roleIds[role] = r.id;
  const permRows = [];
  for (const key of PERMISSIONS) {
    const found = (await db.select().from(permissions).where(eq(permissions.key, key)).limit(1))[0];
    permRows.push(found ?? (await db.insert(permissions).values({ key }).returning())[0]);
  }
  const wanted = new Set(perms);
  for (const p of permRows) {
    if (role === 'OWNER' || wanted.has(p.key as never)) {
      await db.insert(rolePermissions).values({ roleId: r.id, permissionId: p.id });
    }
  }
}

// --- accounts (DEV credentials — documented, never for production) ---
const mkAccount = async (username: string, password: string, role: string, displayName: string) =>
  (await db.insert(accounts).values({ username, displayName, passwordHash: hashPassword(password), roleId: roleIds[role] }).returning())[0];

const owner = await mkAccount('owner', 'Owner@12345', 'OWNER', 'مالک سامانه');
await mkAccount('admin', 'Admin@12345', 'ADMIN', 'مدیر سیستم');
const reseller = await mkAccount('reseller', 'Reseller@12345', 'RESELLER', 'نمایندگی فروش');
await mkAccount('support', 'Support@12345', 'SUPPORT', 'پشتیبانی');

// --- groups & plans ---
const [groupBasic] = await db.insert(configGroups).values({ name: 'Basic', description: 'Default group', allowedProtocols: ['vless', 'vmess', 'trojan'] }).returning();
const [groupPremium] = await db.insert(configGroups).values({ name: 'Premium', description: 'Premium routing', allowedProtocols: ['vless', 'trojan'] }).returning();
const [planStarter] = await db.insert(plans).values({ name: 'Starter', description: 'DEMO plan — 100GB / 30 days', trafficBytes: 100 * 1e9, durationDays: 30, price: 150_000 }).returning();
const [planPro] = await db.insert(plans).values({ name: 'Pro', description: 'DEMO plan — 300GB / 90 days', trafficBytes: 300 * 1e9, durationDays: 90, price: 390_000 }).returning();

// --- nodes ---
const [nodeUs] = await db.insert(nodes).values({ name: 'US - California', location: 'United States', address: '127.0.0.1', port: 2083, core: 'xray', status: 'online', latencyMs: 8 }).returning();
const [nodeDe] = await db.insert(nodes).values({ name: 'DE - Frankfurt', location: 'Germany', address: '127.0.0.1', port: 2084, core: 'xray', status: 'starting', latencyMs: 15 }).returning();

// node metric history (last 24h, hourly) for realistic monitoring cards
for (const [node, base] of [[nodeUs, 24], [nodeDe, 12]] as const) {
  for (let h = 24; h >= 1; h--) {
    await db.insert(nodeMetrics).values({
      nodeId: node.id,
      cpu: Math.max(2, base + Math.round(18 * Math.sin(h / 4) + Math.random() * 8)),
      memory: Math.max(5, base + 14 + Math.round(Math.random() * 9)),
      disk: 31,
      connections: 40 + Math.round(Math.random() * 60),
      trafficIn: 1_000_000 * (20 + Math.round(Math.random() * 40)),
      trafficOut: 1_000_000 * (40 + Math.round(Math.random() * 80)),
      createdAt: new Date(Date.now() - h * 3_600_000),
    });
  }
}

// --- end users + subscriptions + configs ---
const demoUsers = [
  { u: 'alice', name: 'Alice Demo', group: groupBasic, plan: planStarter, owner: null },
  { u: 'bob', name: 'Bob Demo', group: groupPremium, plan: planPro, owner: null },
  { u: 'carol', name: 'Carol Demo', group: groupBasic, plan: planStarter, owner: reseller.id },
  { u: 'dave', name: 'Dave Demo', group: groupBasic, plan: planStarter, owner: reseller.id },
  { u: 'erin', name: 'Erin Demo', group: groupPremium, plan: planPro, owner: null },
  { u: 'frank', name: 'Frank Demo', group: groupBasic, plan: planStarter, owner: null },
];

for (const [i, du] of demoUsers.entries()) {
  const [user] = await db.insert(endUsers).values({
    username: du.u,
    displayName: du.name,
    groupId: du.group.id,
    planId: du.plan.id,
    ownerId: du.owner,
    trafficQuotaBytes: du.plan.trafficBytes,
    trafficUsedBytes: Math.round(du.plan.trafficBytes * (0.1 + 0.13 * i)),
    expireAt: new Date(Date.now() + (i === 4 ? 3 : 20 + i * 9) * 86_400_000),
    tags: i % 2 === 0 ? ['demo'] : ['demo', 'vip'],
    lastActiveAt: i < 3 ? new Date(Date.now() - i * 60_000) : new Date(Date.now() - 26 * 3_600_000),
    status: i === 5 ? 'suspended' : 'active',
  }).returning();

  const [sub] = await db.insert(subscriptions).values({
    endUserId: user.id,
    planId: du.plan.id,
    token: randomUUID().replace(/-/g, '').slice(0, 24),
    expiresAt: user.expireAt,
    trafficQuotaBytes: user.trafficQuotaBytes,
    trafficUsedBytes: user.trafficUsedBytes,
    groupId: du.group.id,
    status: i === 5 ? 'revoked' : 'active',
  }).returning();

  const variants = [
    { protocol: 'vless', transport: 'ws', security: 'tls', node: nodeUs, path: '/vira-ws' },
    { protocol: 'vmess', transport: 'ws', security: 'none', node: nodeDe, path: '/vira-vm' },
    { protocol: 'trojan', transport: 'tcp', security: 'tls', node: nodeUs, path: null },
  ] as const;
  for (const [j, v] of variants.entries()) {
    if (i === 5 && j > 0) continue;
    await db.insert(proxyConfigs).values({
      name: `${du.u}-${v.protocol}-${v.node.name.split(' ')[0].toLowerCase()}`,
      description: 'DEMO config',
      protocol: v.protocol, transport: v.transport, security: v.security,
      nodeId: v.node.id, port: v.node.port,
      credential: v.protocol === 'trojan' ? newCredential('trojan') : newCredential('vless'),
      sni: v.security !== 'none' ? 'demo.vira.dev' : null,
      host: v.transport === 'ws' ? 'demo.vira.dev' : null,
      path: v.path,
      groupId: du.group.id,
      endUserId: user.id,
      status: sub.status === 'revoked' ? 'revoked' : 'active',
    });
  }

  // 7-day traffic history for charts
  for (let d = 6; d >= 0; d--) {
    await db.insert(trafficRecords).values({
      subscriptionId: sub.id,
      nodeId: (d % 2 === 0 ? nodeUs : nodeDe).id,
      bytes: Math.round((0.4 + Math.random() * 2.2) * 1e9),
      periodStart: new Date(Date.now() - d * 86_400_000),
    });
  }
}

// --- audit + notifications samples ---
for (const [action, resource] of [['LOGIN_SUCCESS', 'auth'], ['USER_CREATED', 'user'], ['CONFIG_CREATED', 'config'], ['SUBSCRIPTION_CREATED', 'subscription'], ['NODE_ADDED', 'node'], ['SETTINGS_UPDATED', 'settings']] as const) {
  await db.insert(auditLogs).values({ actorId: owner.id, actorName: owner.username, action, resourceType: resource, result: 'success', ip: '127.0.0.1', userAgent: 'seed', createdAt: new Date(Date.now() - Math.random() * 3 * 3_600_000) });
}
await db.insert(notifications).values([
  { type: 'system', title: 'به ویراپنل خوش آمدید', body: 'این داده‌ها نمونه توسعه (DEMO) هستند' },
  { type: 'node', title: 'Node DE - Frankfurt starting', body: 'Awaiting first agent heartbeat' },
]);
await db.insert(systemSettings).values({ key: 'panel', value: { general: { productName: 'ViraPanel', announcement: 'نسخه توسعه — داده نمونه' } } });

console.log('[seed] done.');
console.log('[seed] DEV login → owner / Owner@12345 · admin / Admin@12345 · reseller / Reseller@12345');
process.exit(0);
