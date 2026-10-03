import { buildApp } from './app.js';
import { env } from './lib/env.js';

// Single-process deployment: the worker runs inside the API unless opted out.
if (env.EMBED_WORKER !== 'false') {
  const { startWorker } = await import('@vira/worker');
  startWorker();
}

const app = await buildApp();

const shutdown = async (signal: string) => {
  app.log.info(`received ${signal}, shutting down`);
  await app.close();
  process.exit(0);
};
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

await app.listen({ port: env.PORT, host: '0.0.0.0' });
app.log.info(`ViraPanel API listening on :${env.PORT}`);
