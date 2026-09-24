import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate, Outlet } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { useAuth } from "@/lib/AuthContext";
import ErrorBoundary from "@/components/ErrorBoundary";
import EnvBanner from "@/components/admin/EnvBanner";
import AdminCommandPalette from "@/components/admin/AdminCommandPalette";
import { useAdmin } from "@/lib/admin/useAdmin";
import { SECTIONS, permittedSections } from "@/lib/admin/sections";
import { roleLabel } from "@/lib/admin/permissions";
import { loadPrefs } from "@/lib/admin/prefs";
import {
  LayoutDashboard, Users, CreditCard, MessageSquare, BarChart3, Sparkles, Plug,
  Flag, Megaphone, Activity, Bug, Shield, Terminal, Settings, FileClock,
  Search, LogOut, ExternalLink, Menu, X,
} from "lucide-react";

// Section id → icon. Registry stays pure; the shell owns the React icon map.
const ICONS = {
  "layout-dashboard": LayoutDashboard, users: Users, "credit-card": CreditCard,
  "message-square": MessageSquare, "bar-chart": BarChart3, sparkles: Sparkles,
  plug: Plug, flag: Flag, megaphone: Megaphone, activity: Activity, bug: Bug,
  shield: Shield, terminal: Terminal, settings: Settings, "file-clock": FileClock,
};

const GROUP_ORDER = ["Console", "Operations", "Insights", "Configure", "System"];

function NavItem({ section, active, onClick }) {
  const Icon = ICONS[section.icon] || Activity;
  return (
    <Link
      to={section.path}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`group flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
        active
          ? "bg-teal-500/10 text-teal-300 font-medium ring-1 ring-teal-400/30"
          : "text-slate-300 hover:bg-white/5 hover:text-slate-100"
      }`}
    >
      <Icon className={`w-[18px] h-[18px] shrink-0 ${active ? "text-teal-400" : "text-slate-500"}`} />
      <span>{section.label}</span>
      {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-teal-400 shadow-[0_0_8px_rgba(45,212,191,0.9)]" />}
    </Link>
  );
}

/**
 * UNI·MATE Control Center shell. Deliberately distinct from the student app:
 * operationally quiet, non-cyberpunk, env-anchored. Every nav item is
 * permission-filtered by the verified principal — a restricted section never
 * appears, even though RLS enforces it again server-side.
 */
export default function AdminShell() {
  const { user, logout, localWorkspace } = useAuth();
  const { principal, env } = useAdmin();
  const location = useLocation();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [prefs] = useState(loadPrefs);

  const landingPath = prefs.landing && prefs.landing !== "overview" ? `/admin/${prefs.landing}` : "/admin/";
  const atRoot = location.pathname === "/admin" || location.pathname === "/admin/";

  useEffect(() => {
    if (atRoot && landingPath !== "/admin/") navigate(landingPath, { replace: true });
  }, [atRoot, landingPath, navigate]);

  const sections = permittedSections(principal);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      } else if (e.key === "Escape") {
        setPaletteOpen(false);
        setMobileNav(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const isActive = (path) =>
    path === "/admin/" ? location.pathname === "/admin" || location.pathname === "/admin/"
      : location.pathname.startsWith(path);

  const grouped = GROUP_ORDER
    .map((group) => ({ group, items: sections.filter((s) => s.group === group) }))
    .filter((g) => g.items.length > 0);

  const handleLogout = () => {
    logout(false);
    navigate("/login");
  };

  const nav = (closeMobile) => grouped.map((g) => (
    <div key={g.group} className="mb-5">
      <div className="px-3 mb-1.5 text-[10px] font-mono uppercase tracking-[0.25em] text-slate-500">{g.group}</div>
      <div className="space-y-0.5">
        {g.items.map((s) => (
          <NavItem key={s.id} section={s} active={isActive(s.path)} onClick={closeMobile ? () => setMobileNav(false) : undefined} />
        ))}
      </div>
    </div>
  ));

  return (
    <div className="min-h-screen bg-[#0a1020] text-slate-100">
      <EnvBanner env={env} />

      <div className="flex">
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex fixed top-0 bottom-0 left-0 w-64 flex-col border-r border-white/10 bg-[#0c1426] pt-11">
          <div className="px-5 pt-5 pb-4 border-b border-white/10">
            <Link to={landingPath} className="block">
              <div className="font-display text-sm font-semibold tracking-wide text-slate-100">
                {prefs.displayName || "UNI·MATE"} <span className="text-teal-400">CONTROL CENTER</span>
              </div>
              <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-slate-500 mt-1">mission operations</div>
            </Link>
          </div>

          <nav className="flex-1 overflow-y-auto px-3 py-4">{nav()}</nav>

          <div className="border-t border-white/10 px-3 py-3 space-y-1">
            <Link
              to="/dashboard"
              className="flex items-center gap-2 px-2 py-2 rounded-lg text-sm text-slate-400 hover:text-slate-100 hover:bg-white/5 transition-colors"
            >
              <ExternalLink className="w-4 h-4" /> Back to student app
            </Link>
            {!localWorkspace && (
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-sm text-slate-400 hover:text-slate-100 hover:bg-white/5 transition-colors"
              >
                <LogOut className="w-4 h-4" /> Sign out
              </button>
            )}
            <div className="px-2 pt-1 text-[10px] font-mono text-slate-600 truncate">
              {principal?.source === "hosted" ? "server-verified" : "dev identity (local)"} · {roleLabel(principal?.role)}
            </div>
          </div>
        </aside>

        {/* Mobile drawer */}
        {mobileNav && (
          <div className="lg:hidden fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/60" onClick={() => setMobileNav(false)} aria-hidden="true" />
            <div className="absolute inset-y-0 left-0 w-72 bg-[#0c1426] border-r border-white/10 overflow-y-auto pt-11">
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                <span className="font-display font-semibold text-sm">Control Center</span>
                <button onClick={() => setMobileNav(false)} aria-label="Close menu"><X className="w-5 h-5" /></button>
              </div>
              <nav className="px-3 py-4">{nav(true)}</nav>
              <div className="px-3 pb-6 border-t border-white/10 pt-3">
                <Link to="/dashboard" onClick={() => setMobileNav(false)} className="flex items-center gap-2 px-2 py-2 text-sm text-slate-400">
                  <ExternalLink className="w-4 h-4" /> Back to student app
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Main column */}
        <div className="flex-1 lg:pl-64 min-w-0">
          <header className="sticky top-0 z-30 flex items-center justify-between gap-3 px-4 lg:px-8 h-14 border-b border-white/10 bg-[#0a1020]/90 backdrop-blur">
            <div className="flex items-center gap-3 min-w-0">
              <button onClick={() => setMobileNav(true)} aria-label="Open menu" className="lg:hidden p-2 rounded-lg hover:bg-white/5">
                <Menu className="w-5 h-5" />
              </button>
              <button
                onClick={() => setPaletteOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-sm text-slate-400 hover:text-slate-200 w-56 lg:w-72"
              >
                <Search className="w-4 h-4" />
                <span>Search console…</span>
                <kbd className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-white/10 border border-white/10 font-mono">⌘K</kbd>
              </button>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className="hidden sm:flex flex-col items-end leading-tight">
                <span className="text-sm text-slate-200 truncate max-w-[180px]">{user?.full_name || "Operator"}</span>
                <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-teal-400">{roleLabel(principal?.role)}</span>
              </div>
              <div className="w-8 h-8 rounded-lg bg-teal-500/15 ring-1 ring-teal-400/30 flex items-center justify-center text-teal-300 text-xs font-semibold">
                {(user?.full_name || user?.email || "A").charAt(0).toUpperCase()}
              </div>
            </div>
          </header>

          <motion.main
            key={location.pathname}
            initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.21, 0.47, 0.32, 0.98] }}
            className="px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-10 max-w-[1400px] mx-auto"
          >
            <ErrorBoundary key={location.pathname}>
              <Outlet />
            </ErrorBoundary>
          </motion.main>
        </div>
      </div>

      <AdminCommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        principal={principal}
        sections={SECTIONS}
      />
    </div>
  );
}