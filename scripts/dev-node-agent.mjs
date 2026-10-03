#!/usr/bin/env node
/**
 * Development node-agent simulator.
 * Speaks the REAL agent protocol (POST /api/v1/agent/heartbeat with a node token),
 * so dashboards/monitoring are exercised end-to-end without a VPS.
 * Usage: node scripts/dev-node-agent.mjs <node-agent-token> [api-base-url]
 */
const token = process.argv[2] ?? process.env.AGENT_TOKEN;
const base = process.argv[3] ?? process.env.API_BASE ?? 'http://localhost:8080';
if (!token) {
  console.error('usage: dev-node-agent.mjs <token>');
  process.exit(1);
}

let cpu = 22, mem = 38, conn = 60;
const walk = (v, min, max, step) => Math.min(max, Math.max(min, v + (Math.random() - 0.5) * step));

async function beat() {
  cpu = walk(cpu, 4, 96, 14);
  mem = walk(mem, 10, 92, 8);
  conn = Math.round(walk(conn, 5, 400, 40));
  const body = {
    cpu: Math.round(cpu), memory: Math.round(mem), disk: 31,
    connections: conn,
    trafficIn: Math.round(Math.random() * 5e7), trafficOut: Math.round(Math.random() * 9e7),
    latencyMs: Math.round(5 + Math.random() * 20),
    version: 'vira-agent/0.1.0',
    usage: [],
  };
  try {
    const res = await fetch(`${base}/api/v1/agent/heartbeat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    console.log(`[agent] heartbeat → ${res.status}`);
  } catch (err) {
    console.error('[agent] heartbeat failed:', err.message);
  }
}

await beat();
setInterval(beat, 15_000);
console.log(`[agent] simulating node against ${base} every 15s`);
