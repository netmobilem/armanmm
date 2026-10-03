import { describe, expect, it } from 'vitest';
import { buildLink, buildSubscriptionBody, newCredential, validateSpec, ConfigEngineError } from '../src/index.js';

const base = {
  remark: 'tehran-ws',
  protocol: 'vless' as const,
  transport: 'ws' as const,
  security: 'tls' as const,
  address: 'edge1.example.com',
  port: 443,
  credential: '1d4d7a1e-2b6f-4c3a-9d2e-8f7a6b5c4d3e',
  sni: 'edge1.example.com',
  path: '/vira',
  host: 'edge1.example.com',
};

describe('config engine', () => {
  it('builds deterministic vless+ws+tls links', () => {
    const spec = validateSpec(base);
    const link = buildLink(spec);
    expect(link).toBe(buildLink(validateSpec({ ...base })));
    expect(link.startsWith('vless://1d4d7a1e-2b6f-4c3a-9d2e-8f7a6b5c4d3e@edge1.example.com:443?')).toBe(true);
    expect(link).toContain('type=ws');
    expect(link).toContain('security=tls');
    expect(link).toContain(`path=${encodeURIComponent('/vira')}`);
    expect(link.endsWith('#tehran-ws')).toBe(true);
  });

  it('builds trojan links with encoded password', () => {
    const spec = validateSpec({ ...base, protocol: 'trojan', credential: 'p@ss/w0rd!x', security: 'none' });
    const link = buildLink(spec);
    expect(link.startsWith('trojan://p%40ss%2Fw0rd!x@')).toBe(true);
  });

  it('builds vmess base64 payloads', () => {
    const spec = validateSpec({ ...base, protocol: 'vmess' });
    const link = buildLink(spec);
    expect(link.startsWith('vmess://')).toBe(true);
    const json = JSON.parse(Buffer.from(link.slice(8), 'base64url').toString('utf8'));
    expect(json.add).toBe('edge1.example.com');
    expect(json.net).toBe('ws');
    expect(json.tls).toBe('tls');
  });

  it('rejects invalid specs with field issues', () => {
    expect(() => validateSpec({ ...base, port: 0 })).toThrow(ConfigEngineError);
    expect(() => validateSpec({ ...base, credential: 'not-a-uuid' })).toThrow(ConfigEngineError);
    expect(() => validateSpec({ ...base, protocol: 'vmess', security: 'reality' })).toThrow(ConfigEngineError);
  });

  it('generates protocol-appropriate credentials', () => {
    expect(newCredential('vless')).toMatch(/^[0-9a-f-]{36}$/);
    expect(newCredential('trojan')).toMatch(/^[0-9a-f]{32}$/);
  });

  it('builds subscription bodies (plain + base64 roundtrip)', () => {
    const links = [buildLink(validateSpec(base)), buildLink(validateSpec({ ...base, remark: 'b' }))];
    const b64 = buildSubscriptionBody(links, 'base64');
    expect(Buffer.from(b64, 'base64').toString('utf8')).toBe(links.join('\n'));
    expect(buildSubscriptionBody(links, 'plain')).toBe(links.join('\n'));
  });
});
