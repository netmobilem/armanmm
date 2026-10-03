import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

function loadDotEnv(): void {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    const candidate = join(dir, '.env');
    if (existsSync(candidate)) {
      for (const line of readFileSync(candidate, 'utf8').split('\n')) {
        const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
        if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
      }
      return;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
}
loadDotEnv();

export const env = {
  DATABASE_PATH: process.env.DATABASE_PATH ?? './data/vira.db',
  REDIS_URL: process.env.REDIS_URL,
  WORKER_POLL_MS: Number(process.env.WORKER_POLL_MS ?? 5000),
  NODE_ENV: process.env.NODE_ENV ?? 'development',
};
