import { Redis } from 'ioredis';
import { emitLocalEvent, LOCAL_JOB_EVENT } from '@vira/shared';
import { env } from './env.js';

let redis: Redis | null = null;

/** Optional Redis: caching, pub/sub events and job queue. In-memory fallbacks keep dev Redis-less. */
export function getRedis(): Redis | null {
  if (!env.REDIS_URL) return null;
  if (!redis) {
    redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 2, lazyConnect: false });
    redis.on('error', (err) => console.error('[redis]', err.message));
  }
  return redis;
}

export const EVENTS_CHANNEL = 'vira:events';

export type RealtimeEvent =
  | { type: 'nodes-updated' }
  | { type: 'notifications' }
  | { type: 'dashboard' };

export async function publishEvent(event: RealtimeEvent): Promise<void> {
  const r = getRedis();
  if (r) await r.publish(EVENTS_CHANNEL, JSON.stringify(event)).catch(() => {});
  else emitLocalEvent({ ...event });
}

/** Enqueue a background job for the worker (Redis queue, or in-process bus fallback). */
export async function enqueueJob(job: { kind: string; payload?: Record<string, unknown> }): Promise<void> {
  const r = getRedis();
  if (r) await r.lpush('vira:jobs', JSON.stringify(job)).catch(() => {});
  else emitLocalEvent({ type: LOCAL_JOB_EVENT, kind: job.kind, payload: job.payload ?? {} });
}
