// UNI·MATE Control Center — centralized authorization layer.
//
// Roles + permissions are defined here and nowhere else. UI components never
// hard-code "is it an admin?"; they call can(principal, permission). The
// permission catalog is designed to be extended (universities.read, referrals,
// support… ) without touching the rest of the console.
//
// SECURITY NOTE: this module decides what the UI MAY OFFER. It is NOT the
// enforcement point — every real action is still enforced server-side by the
// RLS policies built on public.is_admin() / admin_accounts, and by the
// admin-gateway edge function. Feature flags never map to permissions.

export const ROLES = Object.freeze({
  ADMIN: "admin",
  SUPER_ADMIN: "super_admin",
});

export const PERMISSIONS = Object.freeze({
  USERS_READ: "users.read",
  USERS_MANAGE: "users.manage",
  BILLING_READ: "billing.read",
  BILLING_MANAGE: "billing.manage",
  COMMUNITY_MODERATE: "community.moderate",
  ANALYTICS_READ: "analytics.read",
  SETTINGS_MANAGE: "settings.manage",
  FEATURE_FLAGS_MANAGE: "feature_flags.manage",
  AI_MANAGE: "ai.manage",
  SYSTEM_READ: "system.read",
  SYSTEM_MANAGE: "system.manage",
});

export const PERMISSION_LABELS = Object.freeze({
  [PERMISSIONS.USERS_READ]: "View user accounts",
  [PERMISSIONS.USERS_MANAGE]: "Suspend, restore and delete users",
  [PERMISSIONS.BILLING_READ]: "View subscriptions and webhooks",
  [PERMISSIONS.BILLING_MANAGE]: "Reconcile entitlements and retry webhooks",
  [PERMISSIONS.COMMUNITY_MODERATE]: "Moderate community content and reports",
  [PERMISSIONS.ANALYTICS_READ]: "View product analytics",
  [PERMISSIONS.SETTINGS_MANAGE]: "Change console settings",
  [PERMISSIONS.FEATURE_FLAGS_MANAGE]: "Manage feature flags",
  [PERMISSIONS.AI_MANAGE]: "Manage AI configuration",
  [PERMISSIONS.SYSTEM_READ]: "View system health and errors",
  [PERMISSIONS.SYSTEM_MANAGE]: "Run system operations (seeds, cleanup)",
});

// Every permission except the super-admin-only escalation path.
export const DEFAULT_ADMIN_PERMISSIONS = Object.freeze([
  PERMISSIONS.USERS_READ,
  PERMISSIONS.USERS_MANAGE,
  PERMISSIONS.BILLING_READ,
  PERMISSIONS.BILLING_MANAGE,
  PERMISSIONS.COMMUNITY_MODERATE,
  PERMISSIONS.ANALYTICS_READ,
  PERMISSIONS.SETTINGS_MANAGE,
  PERMISSIONS.FEATURE_FLAGS_MANAGE,
  PERMISSIONS.AI_MANAGE,
  PERMISSIONS.SYSTEM_READ,
]);

// SYSTEM_MANAGE is reserved for super admins (rollouts, destructive tooling).
/** @type {ReadonlyArray<string>} */
export const ALL_PERMISSIONS = Object.freeze(
  [...DEFAULT_ADMIN_PERMISSIONS, PERMISSIONS.SYSTEM_MANAGE]
);

/**
 * Effective permission set for a role/membership. super_admin always gets
 * everything; a plain admin with an explicit set uses it, and one with no
 * explicit set gets the default admin set. Unknown roles get nothing.
 * @param {{ role?: string, permissions?: string[], isSuper?: boolean }} [membership={}]
 * @returns {string[]}
 */
export const permissionsFor = (membership = {}) => {
  const role = membership.role || "";
  const granted = Array.isArray(membership.permissions)
    ? membership.permissions.filter(Boolean)
    : [];
  if (role === ROLES.SUPER_ADMIN || membership.isSuper) return [...ALL_PERMISSIONS];
  if (role !== ROLES.ADMIN) return [];
  return granted.length > 0 ? [...new Set(granted)] : [...DEFAULT_ADMIN_PERMISSIONS];
};

/**
 * Authorization check: does this principal hold the permission?
 * @param {{ role?: string, permissions?: string[], isAdmin?: boolean }} principal
 * @param {string} permission
 * @returns {boolean}
 */
export const can = (principal = {}, permission) => {
  const membership = {
    role: principal?.role,
    permissions: principal?.permissions,
    isSuper: principal?.role === ROLES.SUPER_ADMIN,
  };
  return permissionsFor(membership).includes(permission);
};

/**
 * True when something is a known permission key (for validation/user tests).
 * @param {string} permission
 * @returns {boolean}
 */
export const isKnownPermission = (permission) => ALL_PERMISSIONS.includes(permission);

/**
 * Principal derived from a membership row or plain context. `source` records
 * where the identity came from: "hosted" (server-checked admin_accounts),
 * "local" (dev-only, not server-enforced) or "none".
 * @param {{ role?: string, permissions?: string[], source?: 'hosted'|'local'|'none', isAdmin?: boolean }} [membership={}]
 * @returns {{ isAdmin: boolean, role: string, permissions: string[], source: 'hosted'|'local'|'none' }}
 */
export const principalFrom = (membership = {}) => {
  const source = membership.source || "none";
  const role = membership.role || "";
  if (source === "none") {
    return { isAdmin: false, role: "user", permissions: [], source };
  }
  const isAdmin = source === "hosted" ? role === ROLES.ADMIN || role === ROLES.SUPER_ADMIN
    : Boolean(membership.isAdmin || role === ROLES.ADMIN || role === ROLES.SUPER_ADMIN);
  return {
    isAdmin,
    role: isAdmin ? role : "user",
    permissions: isAdmin ? permissionsFor(membership) : [],
    source,
  };
};