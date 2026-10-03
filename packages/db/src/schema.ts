import { randomUUID } from 'node:crypto';
import { sqliteTable, text, integer, real, primaryKey, index, unique } from 'drizzle-orm/sqlite-core';

/** SQLite storage: single file on a mounted volume. Timestamps = epoch-ms integers. */
const id = () => text('id').primaryKey().$defaultFn(() => randomUUID());
const now = () => integer('created_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date());
const ts = (name: string) => integer(name, { mode: 'timestamp_ms' });
const json = <T>(name: string, init: () => T) => text(name, { mode: 'json' }).$type<T>().notNull().$defaultFn(init);

export const roles = sqliteTable('roles', {
  id: id(),
  name: text('name').notNull().unique(),
  description: text('description').notNull().default(''),
  createdAt: now(),
});

export const permissions = sqliteTable('permissions', {
  id: id(),
  key: text('key').notNull().unique(),
  description: text('description').notNull().default(''),
});

export const rolePermissions = sqliteTable('role_permissions', {
  roleId: text('role_id').notNull().references(() => roles.id, { onDelete: 'cascade' }),
  permissionId: text('permission_id').notNull().references(() => permissions.id, { onDelete: 'cascade' }),
}, (t) => ({ pk: primaryKey({ columns: [t.roleId, t.permissionId] }) }));

export const accounts = sqliteTable('accounts', {
  id: id(),
  username: text('username').notNull().unique(),
  email: text('email').unique(),
  passwordHash: text('password_hash').notNull(),
  displayName: text('display_name').notNull(),
  roleId: text('role_id').notNull().references(() => roles.id),
  status: text('status').notNull().default('active'), // active | disabled | locked
  failedLogins: integer('failed_logins').notNull().default(0),
  lockedUntil: ts('locked_until'),
  totpSecret: text('totp_secret'), // 2FA-ready
  createdAt: now(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
});

export const sessions = sqliteTable('sessions', {
  id: id(),
  accountId: text('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  ip: text('ip').notNull().default(''),
  userAgent: text('user_agent').notNull().default(''),
  createdAt: now(),
  expiresAt: ts('expires_at').notNull(),
  lastSeenAt: ts('last_seen_at').notNull().$defaultFn(() => new Date()),
  revokedAt: ts('revoked_at'),
}, (t) => ({ accountIdx: index('sessions_account_idx').on(t.accountId), tokenIdx: index('sessions_token_idx').on(t.tokenHash) }));

export const configGroups = sqliteTable('config_groups', {
  id: id(),
  name: text('name').notNull().unique(),
  description: text('description').notNull().default(''),
  allowedProtocols: json<string[]>('allowed_protocols', () => []),
  createdAt: now(),
});

export const plans = sqliteTable('plans', {
  id: id(),
  name: text('name').notNull().unique(),
  description: text('description').notNull().default(''),
  trafficBytes: integer('traffic_bytes').notNull().default(0),
  durationDays: integer('duration_days').notNull().default(30),
  price: integer('price').notNull().default(0),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  createdAt: now(),
});

export const endUsers = sqliteTable('end_users', {
  id: id(),
  username: text('username').notNull().unique(),
  displayName: text('display_name').notNull().default(''),
  status: text('status').notNull().default('active'), // active | suspended | expired
  ownerId: text('owner_id').references(() => accounts.id, { onDelete: 'set null' }),
  groupId: text('group_id').references(() => configGroups.id, { onDelete: 'set null' }),
  planId: text('plan_id').references(() => plans.id, { onDelete: 'set null' }),
  trafficQuotaBytes: integer('traffic_quota_bytes').notNull().default(0),
  trafficUsedBytes: integer('traffic_used_bytes').notNull().default(0),
  expireAt: ts('expire_at'),
  notes: text('notes').notNull().default(''),
  tags: json<string[]>('tags', () => []),
  lastActiveAt: ts('last_active_at'),
  createdAt: now(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
  deletedAt: ts('deleted_at'),
}, (t) => ({ ownerIdx: index('end_users_owner_idx').on(t.ownerId), statusIdx: index('end_users_status_idx').on(t.status) }));

export const nodes = sqliteTable('nodes', {
  id: id(),
  name: text('name').notNull().unique(),
  location: text('location').notNull().default(''),
  address: text('address').notNull(),
  port: integer('port').notNull().default(443),
  core: text('core').notNull().default('xray'),
  status: text('status').notNull().default('offline'), // online|offline|degraded|starting|maintenance
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  agentTokenHash: text('agent_token_hash').unique(),
  lastHeartbeatAt: ts('last_heartbeat_at'),
  latencyMs: integer('latency_ms'),
  version: text('version'),
  createdAt: now(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
});

export const nodeMetrics = sqliteTable('node_metrics', {
  id: id(),
  nodeId: text('node_id').notNull().references(() => nodes.id, { onDelete: 'cascade' }),
  cpu: real('cpu').notNull().default(0),
  memory: real('memory').notNull().default(0),
  disk: real('disk').notNull().default(0),
  connections: integer('connections').notNull().default(0),
  trafficIn: integer('traffic_in').notNull().default(0),
  trafficOut: integer('traffic_out').notNull().default(0),
  createdAt: now(),
}, (t) => ({ nodeTimeIdx: index('node_metrics_node_time_idx').on(t.nodeId, t.createdAt) }));

export const proxyConfigs = sqliteTable('proxy_configs', {
  id: id(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  protocol: text('protocol').notNull(), // vless | vmess | trojan
  transport: text('transport').notNull(), // ws | httpupgrade | tcp | grpc
  security: text('security').notNull().default('none'), // none | tls | reality
  nodeId: text('node_id').notNull().references(() => nodes.id, { onDelete: 'cascade' }),
  port: integer('port').notNull(),
  credential: text('credential').notNull(),
  sni: text('sni'),
  host: text('host'),
  path: text('path'),
  fingerprint: text('fingerprint'),
  status: text('status').notNull().default('active'), // active | disabled | revoked
  groupId: text('group_id').references(() => configGroups.id, { onDelete: 'set null' }),
  endUserId: text('end_user_id').references(() => endUsers.id, { onDelete: 'set null' }),
  metadata: json<Record<string, string>>('metadata', () => ({})),
  createdAt: now(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
  deletedAt: ts('deleted_at'),
}, (t) => ({ userIdx: index('proxy_configs_user_idx').on(t.endUserId), nodeIdx: index('proxy_configs_node_idx').on(t.nodeId) }));

export const configVersions = sqliteTable('config_versions', {
  id: id(),
  configId: text('config_id').notNull().references(() => proxyConfigs.id, { onDelete: 'cascade' }),
  version: integer('version').notNull(),
  snapshot: json<Record<string, unknown>>('snapshot', () => ({})),
  createdAt: now(),
}, (t) => ({ versionUnique: unique('config_version_unique').on(t.configId, t.version) }));

export const subscriptions = sqliteTable('subscriptions', {
  id: id(),
  endUserId: text('end_user_id').notNull().references(() => endUsers.id, { onDelete: 'cascade' }),
  planId: text('plan_id').references(() => plans.id, { onDelete: 'set null' }),
  token: text('token').notNull().unique(),
  status: text('status').notNull().default('active'), // active | revoked | expired
  startedAt: ts('started_at').notNull().$defaultFn(() => new Date()),
  expiresAt: ts('expires_at'),
  trafficQuotaBytes: integer('traffic_quota_bytes').notNull().default(0),
  trafficUsedBytes: integer('traffic_used_bytes').notNull().default(0),
  groupId: text('group_id').references(() => configGroups.id, { onDelete: 'set null' }),
  createdAt: now(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
}, (t) => ({ userIdx: index('subscriptions_user_idx').on(t.endUserId), statusIdx: index('subscriptions_status_idx').on(t.status) }));

export const apiKeys = sqliteTable('api_keys', {
  id: id(),
  accountId: text('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  prefix: text('prefix').notNull(),
  keyHash: text('key_hash').notNull().unique(),
  scopes: json<string[]>('scopes', () => []),
  ipAllowlist: json<string[]>('ip_allowlist', () => []),
  rateLimit: integer('rate_limit').notNull().default(60),
  lastUsedAt: ts('last_used_at'),
  expiresAt: ts('expires_at'),
  revokedAt: ts('revoked_at'),
  createdAt: now(),
}, (t) => ({ accountIdx: index('api_keys_account_idx').on(t.accountId) }));

export const auditLogs = sqliteTable('audit_logs', {
  id: id(),
  actorId: text('actor_id'),
  actorName: text('actor_name').notNull().default('system'),
  action: text('action').notNull(),
  resourceType: text('resource_type').notNull().default(''),
  resourceId: text('resource_id'),
  result: text('result').notNull().default('success'), // success | denied | error
  ip: text('ip').notNull().default(''),
  userAgent: text('user_agent').notNull().default(''),
  metadata: json<Record<string, unknown>>('metadata', () => ({})),
  createdAt: now(),
}, (t) => ({ timeIdx: index('audit_time_idx').on(t.createdAt), actionIdx: index('audit_action_idx').on(t.action) }));

export const notifications = sqliteTable('notifications', {
  id: id(),
  accountId: text('account_id'),
  type: text('type').notNull().default('system'),
  title: text('title').notNull(),
  body: text('body').notNull().default(''),
  readAt: ts('read_at'),
  createdAt: now(),
});

export const trafficRecords = sqliteTable('traffic_records', {
  id: id(),
  subscriptionId: text('subscription_id').notNull().references(() => subscriptions.id, { onDelete: 'cascade' }),
  nodeId: text('node_id').notNull().references(() => nodes.id, { onDelete: 'cascade' }),
  bytes: integer('bytes').notNull().default(0),
  periodStart: ts('period_start').notNull(),
}, (t) => ({ subTimeIdx: index('traffic_sub_time_idx').on(t.subscriptionId, t.periodStart), nodeTimeIdx: index('traffic_node_time_idx').on(t.nodeId, t.periodStart) }));

export const systemSettings = sqliteTable('system_settings', {
  key: text('key').primaryKey(),
  value: json<Record<string, unknown>>('value', () => ({})),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
});

export const resetTokens = sqliteTable('reset_tokens', {
  id: id(),
  accountId: text('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: ts('expires_at').notNull(),
  usedAt: ts('used_at'),
  createdAt: now(),
});
