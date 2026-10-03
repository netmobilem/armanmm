import type { ConfigSpec } from '../spec.js';
import type { SecurityId } from '@vira/shared';

export interface SecurityAdapter {
  id: SecurityId;
  label: string;
  params(spec: ConfigSpec): Record<string, string>;
  vmessFields(spec: ConfigSpec): Record<string, string>;
}

export const securities: Record<SecurityId, SecurityAdapter> = {
  none: {
    id: 'none',
    label: 'None',
    params: () => ({}),
    vmessFields: () => ({ tls: '' }),
  },
  tls: {
    id: 'tls',
    label: 'TLS',
    params: (s) => {
      const p: Record<string, string> = { security: 'tls' };
      if (s.sni) p.sni = s.sni;
      if (s.fingerprint) p.fp = s.fingerprint;
      if (s.host) p.alpn = 'h2,http/1.1';
      return p;
    },
    vmessFields: (s) => ({ tls: 'tls', sni: s.sni ?? '' }),
  },
  reality: {
    id: 'reality',
    label: 'Reality',
    params: (s) => {
      const p: Record<string, string> = { security: 'reality' };
      if (s.sni) p.sni = s.sni;
      if (s.fingerprint) p.fp = s.fingerprint;
      if (s.realityPublicKey) p.pbk = s.realityPublicKey;
      if (s.realityShortId) p.sid = s.realityShortId;
      p.spx = '/';
      return p;
    },
    vmessFields: () => ({}),
  },
};

export const SECURITY_IDS = Object.keys(securities) as SecurityId[];
