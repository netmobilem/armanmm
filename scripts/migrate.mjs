#!/usr/bin/env node
/** Sequential SQL migration runner for the SQLite volume store. */
import { readFileSync, readdirSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname, resolve } from 'node:path';
import Database from 'better-sqlite3';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dbPath = resolve(process.env.DATABASE_PATH ?? './data/vira.db');
mkdirSync(dirname(dbPath), { recursive: true });

const reset = process.argv.includes('--reset');

// Open first so we can drop in-place: deleting the file would orphan any
// connection already holding it (e.g. test runners that import the client early).
const sqlite = new Database(dbPath);
sqlite.pragma('journal_mode = WAL');

if (reset) {
  console.log('[migrate] resetting schema in place…');
  const tables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
  sqlite.pragma('foreign_keys = OFF');
  for (const t of tables) sqlite.exec(`DROP TABLE IF EXISTS "${t.name}"`);
  sqlite.pragma('foreign_keys = ON');
}
sqlite.exec(`CREATE TABLE IF NOT EXISTS _migrations (
  name TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
)`);

const applied = new Set(sqlite.prepare('SELECT name FROM _migrations').all().map((r) => r.name));
const files = readdirSync(join(root, 'packages/db/migrations'))
  .filter((f) => f.endsWith('.sql'))
  .sort();

let ran = 0;
for (const file of files) {
  if (applied.has(file)) continue;
  const body = readFileSync(join(root, 'packages/db/migrations', file), 'utf8');
  sqlite.exec('BEGIN');
  try {
    sqlite.exec(body);
    sqlite.prepare('INSERT INTO _migrations(name) VALUES (?)').run(file);
    sqlite.exec('COMMIT');
  } catch (err) {
    sqlite.exec('ROLLBACK');
    throw err;
  }
  console.log(`[migrate] applied ${file}`);
  ran++;
}
console.log(ran === 0 ? '[migrate] up to date' : `[migrate] ${ran} migration(s) applied → ${dbPath}`);
sqlite.close();
