// Environment-based adapter selection (Mission 1 — local-first data layer).
// Supabase env vars present  -> hosted backend, exactly today's behavior.
// Supabase env vars absent   -> fully local workspace (on-device storage).
import { getDefaultStorage } from "@/lib/repo/storage";
import { createLocalRepo } from "@/lib/repo/localRepo";
import { createSupabaseRepo } from "@/lib/repo/supabaseRepo";
import { supabase } from "@/lib/supabase";

export const hasSupabaseEnv = () =>
  Boolean(
    typeof import.meta !== "undefined" &&
      import.meta.env &&
      import.meta.env.VITE_SUPABASE_URL &&
      import.meta.env.VITE_SUPABASE_ANON_KEY
  );

export const isLocalWorkspace = () => !hasSupabaseEnv();

// Environment-aware repository factory. Both modes expose the same repository
// interface, so data code (useUserData, tables, engines) never branches on the
// backend. Everything is injectable for tests: storage (local), client + userId
// (hosted), now/idFactory (row identity).
/**
 * @param {object} [options={}]
 * @param {object} [options.storage] - local storage adapter (local mode only)
 * @param {object} [options.client]  - supabase-js client (hosted mode only)
 * @param {string|(() => Promise<?string>)} [options.userId] - row owner id (RLS
 *   scope) or a lazy resolver for it (hosted mode only)
 * @param {() => string} [options.now]       - timestamp factory
 * @param {() => string} [options.idFactory] - row id factory
 * @param {"local"|"hosted"} [options.environment] - defaults from env availability
 */
export const createRepo = ({
  storage,
  client,
  userId,
  now,
  idFactory,
  environment = isLocalWorkspace() ? "local" : "hosted",
} = {}) => {
  if (environment === "hosted") {
    if (!client) throw new Error("createRepo: hosted mode requires a supabase client");
    return createSupabaseRepo({ client, userId, now, idFactory });
  }
  // Local rows always carry a plain owner id — a hosted lazy resolver doesn't
  // apply here (local workspace identity is a fixed string).
  return createLocalRepo({
    storage,
    userId: typeof userId === "string" ? userId : undefined,
    now,
    idFactory,
  });
};

// Lazy hosted-owner resolver for the shared repo: once a session exists, rows
// carry the authenticated uid so RLS scopes them to the owner; before that the
// resolver yields null and writes omit user_id, letting the database default
// auth.uid() — the same semantics the pre-repository call sites relied on.
let cachedOwner = null;
const resolveHostedOwner = async () => {
  if (cachedOwner !== null) return cachedOwner;
  try {
    const { data } = await supabase.auth.getUser();
    cachedOwner = data?.user?.id || null;
  } catch {
    cachedOwner = null;
  }
  return cachedOwner;
};

// Shared application repository — the single persistence surface every module
// talks to (useUserData, QuickAdd, ICS import, onboarding, demo seed, ...).
// Module-level singleton so local-mode storage is shared and hosted writes all
// resolve through the same owner resolver; fresh module loads (tests, reloads)
// get a fresh instance.
let appRepo = null;
export const getAppRepo = () => {
  if (!appRepo) {
    appRepo = createRepo({
      environment: isLocalWorkspace() ? "local" : "hosted",
      client: supabase,
      ...(isLocalWorkspace() ? {} : { userId: resolveHostedOwner }),
    });
  }
  return appRepo;
};

// Synthetic identity for local mode: lets ProtectedRoute and user-scoped UIs
// flow through unchanged while the real profile is persisted separately.
export const LOCAL_WORKSPACE_USER = Object.freeze({
  id: "local-workspace",
  email: "local@unimate.local",
  full_name: "Local Student",
  role: "user",
  is_local_workspace: true,
});

const PROFILE_KEY = "local-profile";

export const loadLocalProfile = () => {
  try {
    const raw = getDefaultStorage().getItem(PROFILE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const saveLocalProfile = (profile) => {
  const storage = getDefaultStorage();
  if (profile == null) storage.removeItem(PROFILE_KEY);
  else storage.setItem(PROFILE_KEY, JSON.stringify(profile));
};