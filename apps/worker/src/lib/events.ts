import { Redis } from 'ioredis';
import { emitLocalEvent } from '@vira/shared';
import { env } from './env.js';

let redis: Redis | null = null;
export function getRedis(): Redis | null {
  if (!env.REDIS_URL) return null;
  if (!redis) redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 2 });
  return redis;
}

export const EVENTS_CHANNEL = 'vira:events';
export async function publishEvent(event: { type: string }): Promise<void> {
  const r = getRedis();
  if (r) await r.publish(EVENTS_CHANNEL, JSON.stringify(event)).catch(() => {});
  else emitLocalEvent({ ...event });
}
