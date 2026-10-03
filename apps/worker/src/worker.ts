import type { Redis } from 'ioredis';
import { onLocalEvent, LOCAL_JOB_EVENT } from '@vira/shared';
import { env } from './lib/env.js';
import { getRedis } from './lib/events.js';
import { nodeHealthSweep, subscriptionExpirySweep, cleanupSweep, jobHandlers, type JobPayload } from './jobs.js';

/** Live status of the worker (module singleton — lets the API detect an embedded worker without Redis). */
export const workerStatus = { running: false, lastTickAt: 0 };

export interface WorkerHandle {
  stop(): Promise<void>;
}

const WORKER_ID = `worker-${process.pid}`;
const MAX_ATTEMPTS = 3;

let handle: WorkerHandle | null = null;

/**
 * Start the background worker: scheduled sweeps (node health, subscription expiry,
 * retention cleanup) plus an on-demand job consumer (Redis queue, or in-process bus).
 * Idempotent — calling it twice returns the same handle.
 */
export function startWorker(): WorkerHandle {
  if (handle) return handle;

  process.env.DATABASE_PATH = env.DATABASE_PATH;
  const redis = getRedis();
  console.info(`[worker] ${WORKER_ID} starting (redis=${redis ? 'on' : 'off — in-process bus + internal timers'})`);

  let stopping = false;
  const timers: Array<ReturnType<typeof setInterval | typeof setTimeout>> = [];
  let offJobs: (() => void) | undefined;
  let consumer: Redis | null = null;

  const tick = () => {
    workerStatus.lastTickAt = Date.now();
  };
  workerStatus.running = true;
  tick();

  const withLock = async (name: string, ttlSec: number, fn: () => Promise<void>): Promise<void> => {
    if (redis) {
      const acquired = await redis.set(`vira:lock:${name}`, WORKER_ID, 'EX', ttlSec, 'NX').catch(() => null);
      if (acquired !== 'OK') return; // another worker holds the lock
    }
    tick();
    try {
      await fn();
    } catch (err) {
      console.error(`[worker] job ${name} failed`, err);
    }
  };

  const runJob = async (job: JobPayload): Promise<void> => {
    const handler = jobHandlers[job.kind];
    const attempt = job.attempt ?? 0;
    if (!handler) {
      console.warn(`[worker] unknown job kind: ${job.kind}`);
      return;
    }
    tick();
    try {
      await handler(job.payload ?? {});
    } catch (err) {
      if (attempt + 1 >= MAX_ATTEMPTS) {
        console.error(`[worker] job ${job.kind} failed after ${MAX_ATTEMPTS} attempts`, err);
        return;
      }
      const delay = 2 ** attempt * 2000;
      console.warn(`[worker] job ${job.kind} failed, retrying in ${delay}ms`);
      timers.push(setTimeout(() => { void runJob({ ...job, attempt: attempt + 1 }); }, delay));
    }
  };

  // --- scheduled sweeps (leader-locked so multiple workers stay safe) ---
  timers.push(setInterval(() => { void withLock('node-health', 25, async () => nodeHealthSweep(90)); }, 30_000));
  timers.push(setInterval(() => { void withLock('expiry', 50, subscriptionExpirySweep); }, 60_000));
  timers.push(setInterval(() => { void withLock('cleanup', 300, cleanupSweep); }, 6 * 3600_000));
  timers.push(setInterval(() => { void (redis?.set('vira:worker:heartbeat', String(Date.now()), 'EX', 30).catch(() => {})); }, 15_000));

  // initial sweeps shortly after boot
  timers.push(setTimeout(() => { void withLock('node-health', 25, async () => nodeHealthSweep(90)); }, 5_000));
  timers.push(setTimeout(() => { void withLock('expiry', 50, subscriptionExpirySweep); }, 8_000));

  // --- on-demand queue consumer ---
  if (redis) {
    const c = redis.duplicate();
    consumer = c;
    const loop = async () => {
      while (!stopping) {
        try {
          const item = await c.brpop('vira:jobs', 5);
          if (item) {
            const job = JSON.parse(item[1]) as JobPayload;
            console.info(`[worker] job received: ${job.kind}`);
            await runJob(job);
          }
        } catch (err) {
          if (!stopping) {
            console.error('[worker] queue loop error', err);
            await new Promise((r) => setTimeout(r, 2000));
          }
        }
      }
    };
    void loop();
  } else {
    // Redis-less fallback: jobs arrive over the in-process bus.
    offJobs = onLocalEvent((event) => {
      if (event.type !== LOCAL_JOB_EVENT) return;
      const job: JobPayload = { kind: String(event.kind), payload: (event.payload as Record<string, unknown>) ?? {} };
      console.info(`[worker] local job received: ${job.kind}`);
      void runJob(job);
    });
  }

  console.info('[worker] ready');

  handle = {
    async stop() {
      if (stopping) return;
      stopping = true;
      workerStatus.running = false;
      for (const t of timers) clearInterval(t as ReturnType<typeof setInterval>);
      offJobs?.();
      if (consumer) await consumer.quit().catch(() => {});
      console.info(`[worker] ${WORKER_ID} stopped`);
    },
  };
  return handle;
}
