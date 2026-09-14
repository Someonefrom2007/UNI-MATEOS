// Environment-based adapter selection (Mission 1 — local-first data layer).
// Supabase env vars present  -> hosted backend, exactly today's behavior.
// Supabase env vars absent   -> fully local workspace (on-device storage).
import { getDefaultStorage } from "@/lib/repo/storage";

export const hasSupabaseEnv = () =>
  Boolean(
    typeof import.meta !== "undefined" &&
      import.meta.env &&
      import.meta.env.VITE_SUPABASE_URL &&
      import.meta.env.VITE_SUPABASE_ANON_KEY
  );

export const isLocalWorkspace = () => !hasSupabaseEnv();

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