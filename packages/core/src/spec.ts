import { z } from 'zod';
import type { ProtocolId, TransportId, SecurityId } from '@vira/shared';

/** A fully-resolved configuration specification — the unit the engine operates on. */
export interface ConfigSpec {
  remark: string;
  protocol: ProtocolId;
  transport: TransportId;
  security: SecurityId;
  address: string;
  port: number;
  credential: string;
  sni?: string | null;
  host?: string | null;
  path?: string | null;
  fingerprint?: string | null;
  /** reality-only extras */
  realityPublicKey?: string | null;
  realityShortId?: string | null;
  /** grpc-only */
  serviceName?: string | null;
}

export const configSpecSchema = z.object({
  remark: z.string().min(1).max(120),
  protocol: z.enum(['vless', 'vmess', 'trojan']),
  transport: z.enum(['ws', 'httpupgrade', 'tcp', 'grpc']),
  security: z.enum(['none', 'tls', 'reality']),
  address: z.string().min(1).max(255),
  port: z.number().int().min(1).max(65535),
  credential: z.string().min(8).max(128),
  sni: z.string().max(255).nullish(),
  host: z.string().max(255).nullish(),
  path: z.string().max(255).nullish(),
  fingerprint: z.string().max(64).nullish(),
  realityPublicKey: z.string().max(128).nullish(),
  realityShortId: z.string().max(32).nullish(),
  serviceName: z.string().max(128).nullish(),
});

export type ConfigSpecInput = z.input<typeof configSpecSchema>;
