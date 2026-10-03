import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { z } from 'zod';

/** Load .env from the nearest ancestor directory that contains it (repo root). */
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

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(8080),
  PUBLIC_URL: z.string().default('http://localhost:8080'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  DATABASE_PATH: z.string().min(1).default('./data/vira.db'),
  REDIS_URL: z.string().optional(),
  /** Run the background worker inside the API process (default on; set "false" for a standalone worker). */
  EMBED_WORKER: z.string().optional(),
  SESSION_SECRET: z.string().min(16).default('dev-insecure-session-secret-change-me'),
  ENCRYPTION_KEY: z.string().min(16).default('dev-insecure-encryption-key!'),
  SESSION_TTL_HOURS: z.coerce.number().default(24 * 7),
});

export const env = schema.parse(process.env);
export const isProd = env.NODE_ENV === 'production';
export const repoRoot = resolve(process.cwd());
