/** Standalone worker entry point. The API can also embed the worker (EMBED_WORKER=true by default). */
import { startWorker } from './worker.js';

const stop = () => process.exit(0);
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

startWorker();
