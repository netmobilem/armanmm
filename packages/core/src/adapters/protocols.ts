import type { ConfigSpec } from '../spec.js';
import type { ProtocolId } from '@vira/shared';
import { transports } from './transports.js';
import { securities } from './security.js';
import { toBase64UrlSafe } from '../encoding.js';

export interface ProtocolAdapter {
  id: ProtocolId;
  label: string;
  /** Credential kind used by this protocol (for generators and UI hints). */
  credentialKind: 'uuid' | 'password';
  /** Build the client import link for a resolved spec. */
  buildLink(spec: ConfigSpec): string;
}

function queryString(params: Record<string, string>): string {
  return Object.entries(params)
    .filter(([, v]) => v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
}

const vless: ProtocolAdapter = {
  id: 'vless',
  label: 'VLESS',
  credentialKind: 'uuid',
  buildLink(s) {
    const params: Record<string, string> = {
      encryption: 'none',
      ...transports[s.transport].params(s),
      ...securities[s.security].params(s),
    };
    return `vless://${s.credential}@${s.address}:${s.port}?${queryString(params)}#${encodeURIComponent(s.remark)}`;
  },
};

const vmess: ProtocolAdapter = {
  id: 'vmess',
  label: 'VMess',
  credentialKind: 'uuid',
  buildLink(s) {
    const payload = {
      v: '2',
      ps: s.remark,
      add: s.address,
      port: String(s.port),
      id: s.credential,
      aid: '0',
      scy: 'auto',
      type: 'none',
      ...transports[s.transport].vmessFields(s),
      ...securities[s.security].vmessFields(s),
    };
    return `vmess://${toBase64UrlSafe(JSON.stringify(payload))}`;
  },
};

const trojan: ProtocolAdapter = {
  id: 'trojan',
  label: 'Trojan',
  credentialKind: 'password',
  buildLink(s) {
    const params: Record<string, string> = {
      ...transports[s.transport].params(s),
      ...securities[s.security].params(s),
    };
    return `trojan://${encodeURIComponent(s.credential)}@${s.address}:${s.port}?${queryString(params)}#${encodeURIComponent(s.remark)}`;
  },
};

export const protocols: Record<ProtocolId, ProtocolAdapter> = { vless, vmess, trojan };
export const PROTOCOL_IDS = Object.keys(protocols) as ProtocolId[];
