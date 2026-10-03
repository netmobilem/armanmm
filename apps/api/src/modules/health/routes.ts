import type { FastifyInstance } from 'fastify';
import { sql as drizzleSql } from 'drizzle-orm';
import { db } from '@vira/db';
import { getRedis } from '../../lib/redis.js';

export async function registerHealthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async () => ({ status: 'ok', uptime: process.uptime() }));

  app.get('/ready', async (_req, reply) => {
    const checks: Record<string, 'ok' | 'fail'> = {};
    try {
      await db.all(drizzleSql`SELECT 1`);
      checks.database = 'ok';
    } catch {
      checks.database = 'fail';
    }
    const redis = getRedis();
    if (redis) {
      try {
        await redis.ping();
        checks.redis = 'ok';
      } catch {
        checks.redis = 'fail';
      }
    } else {
      checks.redis = 'ok'; // optional component
    }
    const ready = Object.values(checks).every((c) => c === 'ok');
    reply.status(ready ? 200 : 503).send({ status: ready ? 'ready' : 'not-ready', checks });
  });

  app.get('/metrics', async () => ({
    memory: process.memoryUsage(),
    uptime: process.uptime(),
    pid: process.pid,
  }));
}
