import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import Database, { type Database as DatabaseType } from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';

/**
 * Storage: a single SQLite file on a mounted volume (zero external services).
 * Path from DATABASE_PATH (default ./data/vira.db). WAL mode for concurrency.
 */
export const dbPath = resolve(process.env.DATABASE_PATH ?? './data/vira.db');
mkdirSync(dirname(dbPath), { recursive: true });

export const sqlite: DatabaseType = new Database(dbPath);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');
sqlite.pragma('busy_timeout = 5000');

export const db = drizzle(sqlite, { schema });
export { schema };

export async function closeDb(): Promise<void> {
  sqlite.close();
}
