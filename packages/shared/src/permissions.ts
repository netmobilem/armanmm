/** Granular permission catalog: `<resource>.<action>`. */
export const PERMISSIONS = [
  'users.read', 'users.create', 'users.update', 'users.delete',
  'configs.read', 'configs.create', 'configs.update', 'configs.delete',
  'nodes.read', 'nodes.create', 'nodes.update', 'nodes.delete',
  'subscriptions.read', 'subscriptions.create', 'subscriptions.update', 'subscriptions.revoke',
  'groups.read', 'groups.create', 'groups.update', 'groups.delete',
  'plans.read', 'plans.create', 'plans.update', 'plans.delete',
  'resellers.read', 'resellers.create', 'resellers.update', 'resellers.delete',
  'apikeys.read', 'apikeys.create', 'apikeys.revoke',
  'settings.read', 'settings.update',
  'audit.read',
  'admins.manage',
  'system.manage',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLES = ['OWNER', 'ADMIN', 'RESELLER', 'SUPPORT', 'VIEWER'] as const;
export type Role = (typeof ROLES)[number];

const ALL: Permission[] = [...PERMISSIONS];
const READ_ONLY = PERMISSIONS.filter((p) => p.endsWith('.read'));

const RESELLER_PERMS: Permission[] = [
  'users.read', 'users.create', 'users.update', 'users.delete',
  'configs.read', 'configs.create', 'configs.update',
  'subscriptions.read', 'subscriptions.create', 'subscriptions.update', 'subscriptions.revoke',
  'plans.read', 'groups.read', 'apikeys.read', 'apikeys.create', 'apikeys.revoke',
];

const SUPPORT_PERMS: Permission[] = [
  'users.read', 'users.update',
  'configs.read',
  'nodes.read',
  'subscriptions.read', 'subscriptions.update',
  'groups.read', 'plans.read',
];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  OWNER: ALL,
  ADMIN: ALL.filter((p) => p !== 'admins.manage'),
  RESELLER: RESELLER_PERMS,
  SUPPORT: SUPPORT_PERMS,
  VIEWER: READ_ONLY,
};

export function rolePermissions(role: Role): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}
