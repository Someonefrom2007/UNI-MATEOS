// UNI·MATE Control Center — React authorization layer.
//
// <AdminProvider> establishes the console principal from the RIGHT source:
//   hosted → SECURITY DEFINER RPCs on Supabase (is_admin()/current_admin_role()/
//            current_admin_permissions()). A missing schema is surfaced as an
//            explicit unconfigured state, never as an admin.
//   local  → localDevPrincipal(), clearly marked as NOT server-enforced.
// <RequireAdmin> gates the whole console; <RequirePermission> gates sections.

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { Outlet } from "react-router-dom";

import { supabase } from "@/lib/supabase";
import { hasSupabaseEnv, isLocalWorkspace } from "@/lib/repo/select";
import { can } from "@/lib/admin/permissions";
import { adminEnv, shapeHostedPrincipal, localDevPrincipal } from "@/lib/admin/principal";

const LOCAL = isLocalWorkspace();
const AdminContext = createContext(null);
export const useAdmin = () => {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdmin must be used within an <AdminProvider>");
  return ctx;
};

const fetchHosted = async () => {
  // A live session must exist first — every admin signal below is derived
  // from the authenticated principal's own rows, never from the URL/body.
  const { data: session } = await supabase.auth.getUser();
  if (!session?.user) return { state: "denied", principal: shapeHostedPrincipal({}) };
  const { data: role } = await supabase.rpc("current_admin_role");
  if (role == null || role === "") {
    // Schema check: is the admin schema applied at all?
    const { data: isAdmin, error } = await supabase.rpc("is_admin");
    if (error) return { state: "unconfigured", principal: shapeHostedPrincipal({}) };
    if (!isAdmin) return { state: "denied", principal: shapeHostedPrincipal({}) };
    return { state: "granted", principal: shapeHostedPrincipal({ role: "admin" }) };
  }
  const { data: permissions } = await supabase.rpc("current_admin_permissions");
  return { state: "granted", principal: shapeHostedPrincipal({ role, permissions }) };
};

export const AdminProvider = ({ children }) => {
  const [state, setState] = useState({ status: "loading", principal: null });
  const env = useMemo(() => adminEnv({ hosted: hasSupabaseEnv() }), []);

  const refresh = useCallback(async () => {
    if (LOCAL) {
      setState({ status: "granted", principal: localDevPrincipal() });
      return;
    }
    setState((s) => ({ ...s, status: "loading" }));
    try {
      const next = await fetchHosted();
      setState({ status: next.state, principal: next.principal });
    } catch {
      setState({ status: "unconfigured", principal: shapeHostedPrincipal({}) });
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({ ...state, env, refresh }),
    [state, env, refresh]
  );

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
};

/**
 * Layout route for /admin — provides the console context (principal + env)
 * to every nested route, then hands off to the gate → shell → pages chain.
 */
export const AdminLayout = () => (
  <AdminProvider>
    <Outlet />
  </AdminProvider>
);

const DeniedScreen = ({ mode, env }) => (
  <div className="min-h-screen flex items-center justify-center bg-[#0a1020] text-slate-100 px-6">
    <div className="max-w-md w-full text-center">
      <div className={`text-[10px] font-mono uppercase tracking-[0.35em] mb-3 ${mode === "unconfigured" ? "text-amber-400" : "text-rose-400"}`}>
        {mode === "unconfigured" ? "control center — not configured" : "access denied"}
      </div>
      <h1 className="font-display text-2xl font-semibold mb-3">
        {mode === "unconfigured" ? "The console schema isn't reachable." : "You don't have console access."}
      </h1>
      <p className="text-sm text-slate-400 leading-relaxed mb-6">
        {mode === "unconfigured"
          ? "The hosted project has no admin functions applied yet, or the workspace is unreachable. Apply supabase/schema.sql and grant yourself a row in admin_accounts before continuing — nothing is ever granted by default."
          : "This account isn't on the admin roster. Access is decided server-side (admin_accounts + RLS), never by the client."}
      </p>
      <div className="text-[11px] font-mono text-slate-500">{env.label}</div>
    </div>
  </div>
);

/**
 * Gate the console: must be running (any granted principal) or render the
 * honest denied/unconfigured screen. Children render as an Outlet route.
 */
export const RequireAdmin = () => {
  const { status, principal, env } = useAdmin();
  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a1020]">
        <div className="w-8 h-8 border-4 border-slate-700 border-t-teal-400 rounded-full animate-spin" />
      </div>
    );
  }
  if (status !== "granted" || !principal?.isAdmin) {
    return <DeniedScreen mode={status === "unconfigured" ? "unconfigured" : "denied"} env={env} />;
  }
  return <Outlet />;
};

/**
 * Permission-gated outlet/children: nested inside RequireAdmin. Renders
 * children (or the Outlet) only when the principal holds `permission`.
 */
export const RequirePermission = ({ permission, children }) => {
  const { principal, env } = useAdmin();
  if (principal?.isAdmin && can(principal, permission)) return children || <Outlet />;
  return (
    <div className="px-6 py-20 max-w-lg mx-auto text-center">
      <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-slate-400 mb-3">permission required</div>
      <p className="text-sm text-slate-400">This section needs <code className="font-mono text-teal-300">{permission}</code>, which your role doesn't grant.</p>
      <div className="mt-4 text-[11px] font-mono text-slate-500">{env.label}</div>
    </div>
  );
};