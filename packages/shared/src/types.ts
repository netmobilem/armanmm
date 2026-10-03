/** Cross-app DTO types (API responses consumed by the web app and worker). */

export type UserStatus = 'active' | 'suspended' | 'expired';
export type NodeStatus = 'online' | 'offline' | 'degraded' | 'starting' | 'maintenance';
export type ConfigStatus = 'active' | 'disabled' | 'revoked';
export type SubscriptionStatus = 'active' | 'revoked' | 'expired';
export type ProtocolId = 'vless' | 'vmess' | 'trojan';
export type TransportId = 'ws' | 'httpupgrade' | 'tcp' | 'grpc';
export type SecurityId = 'none' | 'tls' | 'reality';

export interface SessionUser {
  id: string;
  username: string;
  displayName: string;
  role: string;
  permissions: string[];
}

export interface EndUserDto {
  id: string;
  username: string;
  displayName: string;
  status: UserStatus;
  ownerId: string | null;
  groupId: string | null;
  planId: string | null;
  trafficQuotaBytes: number;
  trafficUsedBytes: number;
  expireAt: string | null;
  tags: string[];
  notes: string;
  lastActiveAt: string | null;
  createdAt: string;
  online: boolean;
}

export interface NodeDto {
  id: string;
  name: string;
  location: string;
  address: string;
  port: number;
  core: string;
  status: NodeStatus;
  enabled: boolean;
  latencyMs: number | null;
  lastHeartbeatAt: string | null;
  version: string | null;
  metrics: { cpu: number; memory: number; disk: number; connections: number; trafficIn: number; trafficOut: number } | null;
  createdAt: string;
}

export interface ConfigDto {
  id: string;
  name: string;
  description: string;
  protocol: ProtocolId;
  transport: TransportId;
  security: SecurityId;
  nodeId: string;
  nodeName: string;
  port: number;
  sni: string | null;
  host: string | null;
  path: string | null;
  status: ConfigStatus;
  groupId: string | null;
  endUserId: string | null;
  createdAt: string;
  updatedAt: string;
  link?: string;
}

export interface SubscriptionDto {
  id: string;
  endUserId: string;
  endUserUsername: string;
  planName: string | null;
  token: string;
  status: SubscriptionStatus;
  startedAt: string;
  expiresAt: string | null;
  trafficQuotaBytes: number;
  trafficUsedBytes: number;
  groupId: string | null;
  createdAt: string;
}

export interface PlanDto {
  id: string;
  name: string;
  description: string;
  trafficBytes: number;
  durationDays: number;
  price: number;
  active: boolean;
  createdAt: string;
}

export interface GroupDto {
  id: string;
  name: string;
  description: string;
  allowedProtocols: ProtocolId[];
  createdAt: string;
}

export interface AuditDto {
  id: string;
  actorName: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  result: 'success' | 'denied' | 'error';
  ip: string;
  createdAt: string;
}

export interface NotificationDto {
  id: string;
  type: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

export interface DashboardDto {
  stats: {
    activeUsers: number;
    activeConfigs: number;
    totalTrafficBytes: number;
    activeSubscriptions: number;
    onlineNodes: number;
    totalNodes: number;
    expiringSoon: number;
  };
  trafficSeries: { label: string; bytes: number }[];
  nodes: NodeDto[];
  recentUsers: EndUserDto[];
  recentActivity: AuditDto[];
  configStats: { protocol: ProtocolId; count: number }[];
  subscriptionStats: { status: SubscriptionStatus; count: number }[];
  systemHealth: { component: string; status: 'healthy' | 'warning' | 'critical' | 'unknown'; latencyMs: number | null }[];
}
