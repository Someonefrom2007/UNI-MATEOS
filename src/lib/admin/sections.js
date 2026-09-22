// UNI·MATE Control Center — section registry.
//
// Single source of truth for console navigation, ⌘K search and route
// permissions. Pure (no React) so tests prove the map is closed: every section
// has a unique path, a known permission, and nothing beyond the catalog.

import { PERMISSIONS, can } from "@/lib/admin/permissions";

// base path prefix for every console route
export const ADMIN_BASE = "/admin";

export const SECTIONS = Object.freeze([
  {
    id: "overview",
    label: "Overview",
    path: `${ADMIN_BASE}/`,
    icon: "layout-dashboard",
    permission: PERMISSIONS.SYSTEM_READ,
    group: "Console",
    description: "System pulse, attention list and key metrics.",
    keywords: ["overview", "dashboard", "pulse", "mission", "attention"],
    actions: [
      { label: "System pulse", to: "#pulse", keywords: ["health", "status", "check"], quick: true },
      { label: "New announcement", to: "#announcement", keywords: ["message", "notify"], quick: false },
    ],
  },
  {
    id: "users",
    label: "Users",
    path: `${ADMIN_BASE}/users`,
    icon: "users",
    permission: PERMISSIONS.USERS_READ,
    group: "Operations",
    description: "Accounts, status, plans and lifecycle.",
    keywords: ["users", "accounts", "members", "suspend", "delete"],
    actions: [
      { label: "Create user note", to: "#new-note", keywords: ["annotate", "memo"], quick: false },
    ],
  },
  {
    id: "billing",
    label: "Billing",
    path: `${ADMIN_BASE}/billing`,
    icon: "credit-card",
    permission: PERMISSIONS.BILLING_READ,
    group: "Operations",
    description: "Subscriptions, webhooks and reconciliation.",
    keywords: ["billing", "subscriptions", "webhooks", "lemon squeezy", "reconcile", "revenue"],
    actions: [
      { label: "Run reconciliation", to: "#reconcile", keywords: ["diff", "compare"], quick: false },
    ],
  },
  {
    id: "community",
    label: "Community",
    path: `${ADMIN_BASE}/community`,
    icon: "message-square",
    permission: PERMISSIONS.COMMUNITY_MODERATE,
    group: "Operations",
    description: "Moderation queue, content and blocked users.",
    keywords: ["community", "posts", "reports", "moderation", "abuse"],
  },
  {
    id: "analytics",
    label: "Analytics",
    path: `${ADMIN_BASE}/analytics`,
    icon: "bar-chart",
    permission: PERMISSIONS.ANALYTICS_READ,
    group: "Insights",
    description: "Real product usage, plans and activity.",
    keywords: ["analytics", "usage", "activity", "charts", "retention"],
  },
  {
    id: "ai",
    label: "AI Control Center",
    path: `${ADMIN_BASE}/ai`,
    icon: "sparkles",
    permission: PERMISSIONS.AI_MANAGE,
    group: "Insights",
    description: "AI provider health, limits and safelist.",
    keywords: ["ai", "assistant", "openai", "model", "limits"],
  },
  {
    id: "integrations",
    label: "Integrations",
    path: `${ADMIN_BASE}/integrations`,
    icon: "plug",
    permission: PERMISSIONS.SYSTEM_READ,
    group: "Insights",
    description: "Connector health. Secret values are never displayed.",
    keywords: ["integrations", "google calendar", "google drive", "connectors", "oauth"],
  },
  {
    id: "flags",
    label: "Feature Flags",
    path: `${ADMIN_BASE}/flags`,
    icon: "flag",
    permission: PERMISSIONS.FEATURE_FLAGS_MANAGE,
    group: "Configure",
    description: "Toggle features by environment, plan or rollout. Never authorization.",
    keywords: ["feature flags", "flags", "rollouts", "experiments"],
    actions: [
      { label: "Create feature flag", to: "#new", keywords: ["add", "rollout"], quick: true },
    ],
  },
  {
    id: "announcements",
    label: "Announcements",
    path: `${ADMIN_BASE}/announcements`,
    icon: "megaphone",
    permission: PERMISSIONS.SETTINGS_MANAGE,
    group: "Configure",
    description: "Targeted operational messages to users.",
    keywords: ["announcements", "messages", "notices", "maintenance"],
  },
  {
    id: "system",
    label: "System Health",
    path: `${ADMIN_BASE}/system`,
    icon: "activity",
    permission: PERMISSIONS.SYSTEM_READ,
    group: "System",
    description: "Service status, latency and versions.",
    keywords: ["system", "health", "services", "uptime", "status"],
  },
  {
    id: "errors",
    label: "Error Center",
    path: `${ADMIN_BASE}/errors`,
    icon: "bug",
    permission: PERMISSIONS.SYSTEM_READ,
    group: "System",
    description: "Error logs and exception analytics.",
    keywords: ["errors", "exceptions", "logs", "bugs"],
  },
  {
    id: "security",
    label: "Security",
    path: `${ADMIN_BASE}/security`,
    icon: "shield",
    permission: PERMISSIONS.SYSTEM_READ,
    group: "System",
    description: "Audit trail, admin roster and access review.",
    keywords: ["security", "audit", "roster", "access", "review"],
  },
  {
    id: "dev",
    label: "Developer Tools",
    path: `${ADMIN_BASE}/dev`,
    icon: "terminal",
    permission: PERMISSIONS.SYSTEM_MANAGE,
    group: "System",
    description: "Environment-safe operations. No raw SQL console.",
    keywords: ["developer", "tools", "environment", "seeds", "ops"],
  },
  {
    id: "settings",
    label: "Admin Settings",
    path: `${ADMIN_BASE}/settings`,
    icon: "settings",
    permission: PERMISSIONS.SETTINGS_MANAGE,
    group: "Configure",
    description: "Console preferences and defaults.",
    keywords: ["settings", "preferences", "console"],
  },
  {
    id: "audit",
    label: "Audit Log",
    path: `${ADMIN_BASE}/audit`,
    icon: "file-clock",
    permission: PERMISSIONS.SYSTEM_READ,
    group: "System",
    description: "Every sensitive console action, append-only.",
    keywords: ["audit", "log", "history", "trail"],
  },
]);

// Guard: the registry is closed and stable (used by tests).
export const sectionIds = () => SECTIONS.map((s) => s.id);
export const sectionByPath = (path) => SECTIONS.find((s) => s.path === path || `${ADMIN_BASE}/${s.id}` === path);

/** Permission cap helper: side nav items the principal may open. */
export const permittedSections = (principal) =>
  SECTIONS.filter((s) => can(principal, s.permission));