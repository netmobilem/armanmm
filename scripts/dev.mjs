#!/usr/bin/env node
/** Dev orchestrator: packages build → api (with embedded worker) + web in parallel. */
import { spawn } from 'node:child_process';

const procs = [];
const run = (name, cmd, args, color) => {
  const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], shell: false });
  const tag = (l) => console.log(`\x1b[${color}m[${name}]\x1b[0m ${l}`);
  p.stdout.on('data', (d) => d.toString().split('\n').filter(Boolean).forEach(tag));
  p.stderr.on('data', (d) => d.toString().split('\n').filter(Boolean).forEach(tag));
  procs.push(p);
};

run('api', 'npx', ['tsx', 'watch', 'apps/api/src/main.ts'], '35');
run('web', 'npx', ['vite', '--host', '0.0.0.0', '--config', 'apps/web/vite.config.ts', 'apps/web'], '36');

process.on('SIGINT', () => { procs.forEach((p) => p.kill('SIGTERM')); process.exit(0); });
