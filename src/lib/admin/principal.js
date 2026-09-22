// UNI·MATE Control Center — principal identity.
//
// Shapes who is operating the console and HOW that identity was established.
// The source determines what the UI is allowed to claim:
//   hosted  → the server (admin_accounts + SECURITY DEFINER is_admin()/role
//             reads) verified this person. Trusted for enforcement.
//   local   → the local workspace. This is a DEVELOPMENT identity: it proves
//             nothing about a deployed environment and the UI must say so.
// Security note: the console never promotes a client-supplied role to 'admin'.
// Even in hosted mode a role that did not come from current_admin_role()/the
// admin_accounts row is rejected below.

import { ROLES, PERMISSIONS, principalFrom } from "@/lib/admin/permissions";

/**
 * Map the server-provided admin signals into a principal. `role`/`permissions`
 * must be what the SECURITY DEFINER functions returned — never user input.
 * @param {{ role?: string|null, permissions?: string[]|null }} [server={}]
 * @returns {object} principal (see principalFrom)
 */
export const shapeHostedPrincipal = ({ role, permissions } = {}) => {
  const known = role === ROLES.ADMIN || role === ROLES.SUPER_ADMIN;
  if (!known) {
    return principalFrom({ role: "", source: "hosted" });
  }
  return principalFrom({ role, permissions: Array.isArray(permissions) ? permissions : [], source: "hosted" });
};

/**
 * Local-workspace identity: the founder operates the console on-device. This is
 * a super-admin here ONLY because there is no server to enforce access — the
 * banner must surface that it is not server-enforced.
 * @returns {object} principal (source local)
 */
export const localDevPrincipal = () =>
  principalFrom({ role: ROLES.SUPER_ADMIN, permissions: [], source: "local" });

/**
 * Resolve whether the console can enforce anything given the runtime env.
 * @param {{ hosted?: boolean, envName?: string }} [info={}]
 * @returns {{ name: 'development'|'preview'|'production'|'local', hosted: boolean, enforced: boolean, label: string }}
 */
export const adminEnv = ({ hosted = false, envName = "" } = {}) => {
  if (!hosted) {
    return {
      name: "local",
      hosted: false,
      enforced: false,
      label: "Development — local workspace (no server enforcement)",
    };
  }
  const name = envName === "development" || envName === "preview" || envName === "production"
    ? envName
    : "production";
  return {
    name,
    hosted: true,
    enforced: true,
    label: name === "production" ? "Production" : `${name[0].toUpperCase()}${name.slice(1)}`,
  };
};

/**
 * Action weight — used to gate how hard a confirm must be. Production drives
 * heavier guards. Not authorization: just UX weight.
 * @param {object} env - adminEnv() output
 * @returns {'light'|'normal'|'heavy'}
 */
export const confirmWeight = (env) => {
  if (!env?.hosted) return "light";
  if (env.name === "production") return "heavy";
  return "normal";
};

export const ADMIN_ACCESS_LABELS = Object.freeze({
  USERS: PERMISSIONS.USERS_MANAGE,
  BILLING: PERMISSIONS.BILLING_MANAGE,
  COMMUNITY: PERMISSIONS.COMMUNITY_MODERATE,
  FLAGS: PERMISSIONS.FEATURE_FLAGS_MANAGE,
  AI: PERMISSIONS.AI_MANAGE,
  SYSTEM: PERMISSIONS.SYSTEM_MANAGE,
});