import type { FastifyInstance } from 'fastify';
import { onLocalEvent, LOCAL_JOB_EVENT } from '@vira/shared';
import { requireAuth } from '../../plugins/auth.js';
import { getRedis, EVENTS_CHANNEL } from '../../lib/redis.js';

/** Server-Sent Events stream for live dashboard updates (node status, notifications…). */
export async function registerRealtimeRoutes(app: FastifyInstance): Promise<void> {
  app.get('/events', async (req, reply) => {
    await requireAuth(req);
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    reply.raw.write(': connected\n\n');

    const send = (data: string) => {
      if (!reply.raw.destroyed) reply.raw.write(`data: ${data}\n\n`);
    };

    const ping = setInterval(() => send(JSON.stringify({ type: 'ping' })), 25_000);
    const redis = getRedis();
    const sub = redis ? redis.duplicate() : null;
    if (sub) {
      sub.subscribe(EVENTS_CHANNEL).catch(() => {});
      sub.on('message', (_channel: string, message: string) => send(message));
    }
    // Redis-less fallback: deliver in-process events directly.
    const offLocal = sub ? undefined : onLocalEvent((event) => {
      if (event.type !== LOCAL_JOB_EVENT) send(JSON.stringify(event));
    });

    req.raw.on('close', () => {
      clearInterval(ping);
      sub?.unsubscribe().catch(() => {});
      sub?.disconnect();
      offLocal?.();
      reply.raw.end();
    });
  });
}
