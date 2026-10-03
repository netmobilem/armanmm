import type { ConfigSpec } from '../spec.js';
import type { TransportId } from '@vira/shared';

export interface TransportAdapter {
  id: TransportId;
  label: string;
  /** URI query parameters contributed by the transport layer. */
  params(spec: ConfigSpec): Record<string, string>;
  /** vmess JSON fields contributed by the transport layer. */
  vmessFields(spec: ConfigSpec): Record<string, string>;
}

const wsLike = (type: string): Pick<TransportAdapter, 'params' | 'vmessFields'> => ({
  params: (s) => {
    const p: Record<string, string> = { type };
    if (s.path) p.path = s.path;
    if (s.host) p.host = s.host;
    return p;
  },
  vmessFields: (s) => ({
    net: type,
    path: s.path ?? '/',
    host: s.host ?? '',
  }),
});

export const transports: Record<TransportId, TransportAdapter> = {
  ws: { id: 'ws', label: 'WebSocket', ...wsLike('ws') },
  httpupgrade: { id: 'httpupgrade', label: 'HTTP Upgrade', ...wsLike('httpupgrade') },
  tcp: {
    id: 'tcp',
    label: 'TCP',
    params: () => ({ type: 'tcp' }),
    vmessFields: () => ({ net: 'tcp', path: '', host: '' }),
  },
  grpc: {
    id: 'grpc',
    label: 'gRPC',
    params: (s) => ({ type: 'grpc', serviceName: s.serviceName ?? 'ViraService' }),
    vmessFields: (s) => ({ net: 'grpc', path: s.serviceName ?? 'ViraService', host: '' }),
  },
};

export const TRANSPORT_IDS = Object.keys(transports) as TransportId[];
