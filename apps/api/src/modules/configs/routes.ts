import type { FastifyInstance } from 'fastify';
import { and, count, desc, eq, like, inArray, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { db, proxyConfigs, nodes, configVersions, endUsers, configGroups } from '@vira/db';
import { requirePermission, assertCsrf, type AuthContext } from '../../plugins/auth.js';
import { ApiError } from '../../lib/errors.js';
import { audit } from '../../lib/audit.js';
import { parsePage, paginated } from '../../lib/pagination.js';
import { validateSpec, buildLink, newCredential, type ConfigSpec } from '@vira/core';
import type { ConfigDto } from '@vira/shared';

const bodySchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(500).default(''),
  protocol: z.enum(['vless', 'vmess', 'trojan']),
  transport: z.enum(['ws', 'httpupgrade', 'tcp', 'grpc']),
  security: z.enum(['none', 'tls', 'reality']),
  nodeId: z.string().uuid(),
  port: z.number().int().min(1).max(65535),
  credential: z.string().min(8).max(128).optional(),
  sni: z.string().max(255).nullish(),
  host: z.string().max(255).nullish(),
  path: z.string().max(255).nullish(),
  fingerprint: z.string().max(64).nullish(),
  realityPublicKey: z.string().max(128).nullish(),
  realityShortId: z.string().max(32).nullish(),
  serviceName: z.string().max(128).nullish(),
  groupId: z.string().uuid().nullish(),
  endUserId: z.string().uuid().nullish(),
});

function specFromRow(row: typeof proxyConfigs.$inferSelect, nodeName: string): ConfigSpec {
  const meta = row.metadata as Record<string, string>;
  return {
    remark: `${row.name} | ${nodeName}`,
    protocol: row.protocol as ConfigSpec['protocol'],
    transport: row.transport as ConfigSpec['transport'],
    security: row.security as ConfigSpec['security'],
    address: nodeName, // replaced by caller with node address
    port: row.port,
    credential: row.credential,
    sni: row.sni, host: row.host, path: row.path, fingerprint: row.fingerprint,
    realityPublicKey: meta.realityPublicKey, realityShortId: meta.realityShortId, serviceName: meta.serviceName,
  };
}

export function configLink(row: typeof proxyConfigs.$inferSelect, nodeAddress: string, nodeName: string): string {
  const spec = specFromRow(row, nodeName);
  spec.address = nodeAddress;
  return buildLink(validateSpec(spec));
}

function mapConfig(row: typeof proxyConfigs.$inferSelect, nodeName: string, nodeAddress: string, includeLink: boolean): ConfigDto {
  return {
    id: row.id, name: row.name, description: row.description,
    protocol: row.protocol as ConfigDto['protocol'],
    transport: row.transport as ConfigDto['transport'],
    security: row.security as ConfigDto['security'],
    nodeId: row.nodeId, nodeName, port: row.port,
    sni: row.sni, host: row.host, path: row.path,
    status: row.status as ConfigDto['status'],
    groupId: row.groupId, endUserId: row.endUserId,
    createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
    ...(includeLink && row.status === 'active' ? { link: configLink(row, nodeAddress, nodeName) } : {}),
  };
}

async function scopedConfigQuery(auth: AuthContext) {
  if (auth.role !== 'RESELLER') return null;
  // resellers see configs assigned to their own users only
  const mine = await db.select({ id: endUsers.id }).from(endUsers).where(eq(endUsers.ownerId, auth.accountId));
  return mine.map((u) => u.id);
}

export async function registerConfigRoutes(app: FastifyInstance): Promise<void> {
  app.get('/configs', async (req) => {
    const auth = await requirePermission(req, 'configs.read');
    const q = parsePage(req);
    const protocol = (req.query as Record<string, string>).protocol;
    const resellerIds = await scopedConfigQuery(auth);
    const where = and(
      isNull(proxyConfigs.deletedAt),
      protocol ? eq(proxyConfigs.protocol, protocol) : undefined,
      q.search ? like(proxyConfigs.name, `%${q.search}%`) : undefined,
      resellerIds ? (resellerIds.length ? inArray(proxyConfigs.endUserId, resellerIds) : eq(proxyConfigs.endUserId, '00000000-0000-0000-0000-000000000000')) : undefined,
    ) as never;
    const base = db.select({ row: proxyConfigs, node: nodes }).from(proxyConfigs).innerJoin(nodes, eq(proxyConfigs.nodeId, nodes.id));
    const joined = resellerIds ? base.leftJoin(endUsers, eq(proxyConfigs.endUserId, endUsers.id)) : base.leftJoin(endUsers, eq(proxyConfigs.endUserId, endUsers.id));
    const rows = await joined.where(where).orderBy(desc(proxyConfigs.createdAt)).limit(q.pageSize).offset((q.page - 1) * q.pageSize);
    const total = (await db.select({ n: count() }).from(proxyConfigs).where(and(isNull(proxyConfigs.deletedAt), protocol ? eq(proxyConfigs.protocol, protocol) : undefined) as never))[0]?.n ?? 0;
    return {
      success: true, requestId: req.id,
      data: paginated(rows.map((r) => mapConfig(r.row, r.node.name, r.node.address, false)), total, q),
    };
  });

  app.post('/configs', async (req) => {
    const auth = await requirePermission(req, 'configs.create');
    assertCsrf(req, auth);
    const body = bodySchema.parse(req.body ?? {});
    const node = (await db.select().from(nodes).where(eq(nodes.id, body.nodeId)).limit(1))[0];
    if (!node) throw ApiError.notFound('Node not found');
    if (body.groupId) {
      const group = (await db.select().from(configGroups).where(eq(configGroups.id, body.groupId)).limit(1))[0];
      if (group && group.allowedProtocols.length > 0 && !group.allowedProtocols.includes(body.protocol)) {
        throw new ApiError('VALIDATION_ERROR', `Protocol ${body.protocol} not allowed in group ${group.name}`, 400);
      }
    }
    const credential = body.credential ?? newCredential(body.protocol);
    const spec: ConfigSpec = {
      remark: body.name, protocol: body.protocol, transport: body.transport, security: body.security,
      address: node.address, port: body.port, credential,
      sni: body.sni, host: body.host, path: body.path, fingerprint: body.fingerprint,
      realityPublicKey: body.realityPublicKey, realityShortId: body.realityShortId, serviceName: body.serviceName,
    };
    validateSpec(spec); // throws ConfigEngineError → mapped below
    const meta: Record<string, string> = {};
    if (body.realityPublicKey) meta.realityPublicKey = body.realityPublicKey;
    if (body.realityShortId) meta.realityShortId = body.realityShortId;
    if (body.serviceName) meta.serviceName = body.serviceName;
    const [row] = await db.insert(proxyConfigs).values({
      name: body.name, description: body.description, protocol: body.protocol, transport: body.transport,
      security: body.security, nodeId: body.nodeId, port: body.port, credential,
      sni: body.sni ?? null, host: body.host ?? null, path: body.path ?? null, fingerprint: body.fingerprint ?? null,
      groupId: body.groupId ?? null, endUserId: body.endUserId ?? null, metadata: meta,
    }).returning();
    await db.insert(configVersions).values({ configId: row.id, version: 1, snapshot: { ...body, credential } });
    audit(req, { actorId: auth.accountId, actorName: auth.username, action: 'CONFIG_CREATED', resourceType: 'config', resourceId: row.id });
    return { success: true, requestId: req.id, data: mapConfig(row, node.name, node.address, true) };
  });

  app.get('/configs/:id', async (req) => {
    await requirePermission(req, 'configs.read');
    const { id } = req.params as { id: string };
    const row = (await db.select({ row: proxyConfigs, node: nodes }).from(proxyConfigs).innerJoin(nodes, eq(proxyConfigs.nodeId, nodes.id)).where(and(eq(proxyConfigs.id, id), isNull(proxyConfigs.deletedAt))).limit(1))[0];
    if (!row) throw ApiError.notFound('Config not found');
    const versions = await db.select().from(configVersions).where(eq(configVersions.configId, id)).orderBy(desc(configVersions.version));
    return { success: true, requestId: req.id, data: { config: mapConfig(row.row, row.node.name, row.node.address, true), versions: versions.map((v) => ({ version: v.version, createdAt: v.createdAt.toISOString() })) } };
  });

  app.patch('/configs/:id', async (req) => {
    const auth = await requirePermission(req, 'configs.update');
    assertCsrf(req, auth);
    const { id } = req.params as { id: string };
    const existing = (await db.select().from(proxyConfigs).where(eq(proxyConfigs.id, id)).limit(1))[0];
    if (!existing) throw ApiError.notFound('Config not found');
    const body = bodySchema.partial().parse(req.body ?? {});
    const merged = { ...existing, ...body, sni: body.sni ?? existing.sni, host: body.host ?? existing.host, path: body.path ?? existing.path };
    const node = (await db.select().from(nodes).where(eq(nodes.id, (body.nodeId ?? existing.nodeId))).limit(1))[0];
    if (!node) throw ApiError.notFound('Node not found');
    validateSpec({
      remark: merged.name, protocol: merged.protocol as ConfigSpec['protocol'], transport: merged.transport as ConfigSpec['transport'],
      security: merged.security as ConfigSpec['security'], address: node.address, port: merged.port, credential: merged.credential,
      sni: merged.sni, host: merged.host, path: merged.path, fingerprint: merged.fingerprint,
    });
    const [row] = await db.update(proxyConfigs).set({
      name: body.name ?? existing.name, description: body.description ?? existing.description,
      protocol: body.protocol ?? existing.protocol, transport: body.transport ?? existing.transport,
      security: body.security ?? existing.security, nodeId: body.nodeId ?? existing.nodeId,
      port: body.port ?? existing.port, sni: body.sni ?? existing.sni, host: body.host ?? existing.host,
      path: body.path ?? existing.path, fingerprint: body.fingerprint ?? existing.fingerprint,
      groupId: body.groupId !== undefined ? body.groupId : existing.groupId,
      endUserId: body.endUserId !== undefined ? body.endUserId : existing.endUserId,
      updatedAt: new Date(),
    }).where(eq(proxyConfigs.id, id)).returning();
    const nextVersion = (await db.select({ v: count() }).from(configVersions).where(eq(configVersions.configId, id)))[0]?.v ?? 0;
    await db.insert(configVersions).values({ configId: id, version: Number(nextVersion) + 1, snapshot: { ...merged } });
    audit(req, { actorId: auth.accountId, actorName: auth.username, action: 'CONFIG_UPDATED', resourceType: 'config', resourceId: id });
    return { success: true, requestId: req.id, data: mapConfig(row, node.name, node.address, true) };
  });

  app.delete('/configs/:id', async (req) => {
    const auth = await requirePermission(req, 'configs.delete');
    assertCsrf(req, auth);
    const { id } = req.params as { id: string };
    await db.update(proxyConfigs).set({ deletedAt: new Date(), status: 'revoked', updatedAt: new Date() }).where(eq(proxyConfigs.id, id));
    audit(req, { actorId: auth.accountId, actorName: auth.username, action: 'CONFIG_DELETED', resourceType: 'config', resourceId: id });
    return { success: true, requestId: req.id, data: null };
  });

  app.post('/configs/:id/revoke', async (req) => {
    const auth = await requirePermission(req, 'configs.update');
    assertCsrf(req, auth);
    const { id } = req.params as { id: string };
    await db.update(proxyConfigs).set({ status: 'revoked', updatedAt: new Date() }).where(eq(proxyConfigs.id, id));
    audit(req, { actorId: auth.accountId, actorName: auth.username, action: 'CONFIG_REVOKED', resourceType: 'config', resourceId: id });
    return { success: true, requestId: req.id, data: null };
  });

  app.post('/configs/:id/rotate', async (req) => {
    const auth = await requirePermission(req, 'configs.update');
    assertCsrf(req, auth);
    const { id } = req.params as { id: string };
    const existing = (await db.select().from(proxyConfigs).where(eq(proxyConfigs.id, id)).limit(1))[0];
    if (!existing) throw ApiError.notFound('Config not found');
    const credential = newCredential(existing.protocol as 'vless' | 'vmess' | 'trojan');
    const [row] = await db.update(proxyConfigs).set({ credential, status: 'active', updatedAt: new Date() }).where(eq(proxyConfigs.id, id)).returning();
    const v = Number((await db.select({ v: count() }).from(configVersions).where(eq(configVersions.configId, id)))[0]?.v ?? 0) + 1;
    await db.insert(configVersions).values({ configId: id, version: v, snapshot: { rotated: true, credential } });
    audit(req, { actorId: auth.accountId, actorName: auth.username, action: 'CONFIG_CREDENTIAL_ROTATED', resourceType: 'config', resourceId: id });
    const node = (await db.select().from(nodes).where(eq(nodes.id, row.nodeId)).limit(1))[0];
    return { success: true, requestId: req.id, data: mapConfig(row, node?.name ?? '', node?.address ?? '', true) };
  });
}
