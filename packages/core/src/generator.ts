import { randomUUID, randomBytes } from 'node:crypto';
import { configSpecSchema, type ConfigSpec } from './spec.js';
import { protocols, PROTOCOL_IDS } from './adapters/protocols.js';
import { toBase64 } from './encoding.js';

export class ConfigEngineError extends Error {
  constructor(public readonly issues: { path: string; message: string }[]) {
    super('Invalid configuration spec');
    this.name = 'ConfigEngineError';
  }
}

/** Validate a raw spec object; throws ConfigEngineError with field issues. */
export function validateSpec(input: unknown): ConfigSpec {
  const parsed = configSpecSchema.safeParse(input);
  if (!parsed.success) {
    throw new ConfigEngineError(
      parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    );
  }
  const spec = parsed.data as ConfigSpec;
  const adapter = protocols[spec.protocol];
  if (adapter.credentialKind === 'uuid' && !UUID_RE.test(spec.credential)) {
    throw new ConfigEngineError([{ path: 'credential', message: `${spec.protocol} requires a UUID credential` }]);
  }
  if (spec.security === 'reality' && spec.protocol === 'vmess') {
    throw new ConfigEngineError([{ path: 'security', message: 'vmess does not support reality' }]);
  }
  return spec;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Deterministic link generation: pure function of the validated spec. */
export function buildLink(spec: ConfigSpec): string {
  return protocols[spec.protocol].buildLink(spec);
}

/** Generate a fresh credential appropriate for the protocol. */
export function newCredential(protocol: (typeof PROTOCOL_IDS)[number]): string {
  if (protocols[protocol].credentialKind === 'uuid') return randomUUID();
  return randomBytes(16).toString('hex');
}

/** Build a client subscription body: newline-joined links, optionally base64. */
export function buildSubscriptionBody(links: string[], format: 'base64' | 'plain' = 'base64'): string {
  const joined = links.join('\n');
  return format === 'base64' ? toBase64(joined) : joined;
}

export { PROTOCOL_IDS };
