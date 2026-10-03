import { and, eq, lt, sql, isNull } from 'drizzle-orm';
import { db, nodes, subscriptions, endUsers, nodeMetrics, trafficRecords, notifications } from '@vira/db';
import { publishEvent } from './lib/events.js';

const log = (msg: string, extra?: unknown) => console.info(`[worker] ${msg}`, extra ?? '');

/** Mark nodes offline/degraded when heartbeats go stale. Idempotent. */
export async function nodeHealthSweep(offlineSeconds: number): Promise<void> {
  const threshold = new Date(Date.now() - offlineSeconds * 1000);
  const stale = await db
    .update(nodes)
    .set({ status: 'offline', latencyMs: null, updatedAt: new Date() })
    .where(and(eq(nodes.enabled, true), sql`${nodes.lastHeartbeatAt} IS NOT NULL`, lt(nodes.lastHeartbeatAt, threshold), sql`${nodes.status} IN ('online','degraded','starting')`))
    .returning({ id: nodes.id, name: nodes.name });
  if (stale.length > 0) {
    log(`node-health: ${stale.length} node(s) marked offline`);
    for (const n of stale) {
      await db.insert(notifications).values({ type: 'node', title: 'Node offline', body: `Node ${n.name} stopped sending heartbeats` }).catch(() => {});
    }
    await publishEvent({ type: 'nodes-updated' });
  }
}

/** Expire subscriptions & users past their expiry. State-transition based → idempotent. */
export async function subscriptionExpirySweep(): Promise<void> {
  const now = new Date();
  const expiredSubs = await db
    .update(subscriptions)
    .set({ status: 'expired', updatedAt: now })
    .where(and(eq(subscriptions.status, 'active'), sql`${subscriptions.expiresAt} IS NOT NULL`, lt(subscriptions.expiresAt, now)))
    .returning({ id: subscriptions.id, endUserId: subscriptions.endUserId });
  if (expiredSubs.length > 0) {
    log(`expiry: ${expiredSubs.length} subscription(s) expired`);
    for (const s of expiredSubs) {
      await db.insert(notifications).values({ type: 'subscription', title: 'Subscription expired', body: `A subscription for user ${s.endUserId.slice(0, 8)}… expired` }).catch(() => {});
    }
  }
  const expiredUsers = await db
    .update(endUsers)
    .set({ status: 'expired', updatedAt: now })
    .where(and(eq(endUsers.status, 'active'), sql`${endUsers.expireAt} IS NOT NULL`, lt(endUsers.expireAt, now), isNull(endUsers.deletedAt)));
  void expiredUsers;
  // Quota exhaustion → suspend-like marker via status 'expired' is wrong; keep active and let sub page show 0 remaining.
}

/** Retention cleanup for high-volume telemetry tables. */
export async function cleanupSweep(): Promise<void> {
  const metricCutoff = new Date(Date.now() - 7 * 86_400_000);
  const trafficCutoff = new Date(Date.now() - 90 * 86_400_000);
  const m = await db.delete(nodeMetrics).where(lt(nodeMetrics.createdAt, metricCutoff));
  const t = await db.delete(trafficRecords).where(lt(trafficRecords.periodStart, trafficCutoff));
  log(`cleanup: metrics=${Array.isArray(m) ? m.length : '?'}, traffic=${Array.isArray(t) ? t.length : '?'}`);
}

export type JobPayload = { kind: string; payload?: Record<string, unknown>; attempt?: number };

/** Registry for on-demand jobs pushed onto the queue by the API. */
export const jobHandlers: Record<string, (payload: Record<string, unknown>) => Promise<void>> = {
  'notify': async (p) => {
    await db.insert(notifications).values({ type: String(p.type ?? 'system'), title: String(p.title ?? 'Notification'), body: String(p.body ?? '') });
  },
  'ping': async () => { /* liveness probe job */ },
};
