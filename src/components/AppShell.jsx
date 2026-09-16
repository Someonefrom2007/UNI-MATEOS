import { useState } from "react";
import { Link, useLocation, useNavigate, Outlet } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { useAuth } from "@/lib/AuthContext";
import { useI18n, LANGUAGES } from "@/lib/i18n";
import {
  LayoutDashboard, BookOpen, CalendarDays, CheckSquare, GraduationCap, FileText,
  FolderOpen, Timer, Target, Repeat, Gauge, Sparkles, BrainCircuit,
  User, Settings, CreditCard, Plus, Search, Menu, X, LogOut, StickyNote, Users,
} from "lucide-react";
import QuickAdd from "@/components/QuickAdd";
import CommandPalette from "@/components/CommandPalette";
import FloatingStickiesLayer from "@/components/FloatingStickiesLayer";
import Logo from "@/components/Logo";
import ErrorBoundary from "@/components/ErrorBoundary";

const NAV = [
  { sectionKey: "nav.overview", items: [{ labelKey: "nav.dashboard", to: "/dashboard", icon: LayoutDashboard }] },
  {
    sectionKey: "nav.academics",
    items: [
      { labelKey: "nav.courses", to: "/courses", icon: BookOpen },
      { labelKey: "nav.schedule", to: "/schedule", icon: CalendarDays },
      { labelKey: "nav.tasks", to: "/tasks", icon: CheckSquare },
      { labelKey: "nav.exams", to: "/exams", icon: GraduationCap },
      { labelKey: "nav.grades", to: "/grades", icon: FileText },
    ],
  },
  {
    sectionKey: "nav.productivity",
    items: [
      { labelKey: "nav.notes", to: "/notes", icon: FileText },
      { labelKey: "nav.stickies", to: "/stickies", icon: StickyNote },
      { labelKey: "nav.resources", to: "/resources", icon: FolderOpen },
      { labelKey: "nav.focus", to: "/focus", icon: Timer },
      { labelKey: "nav.goals", to: "/goals", icon: Target },
      { labelKey: "nav.habits", to: "/habits", icon: Repeat },
    ],
  },
  {
    sectionKey: "nav.community",
    items: [{ labelKey: "nav.community", to: "/community", icon: Users }],
  },
  {
    sectionKey: "nav.intelligence",
    items: [
      { labelKey: "nav.workload", to: "/workload", icon: Gauge },
      { labelKey: "nav.insights", to: "/insights", icon: Sparkles },
      { labelKey: "nav.ai", to: "/ai", icon: BrainCircuit },
    ],
  },
  {
    sectionKey: "nav.account",
    items: [
      { labelKey: "nav.profile", to: "/profile", icon: User },
      { labelKey: "nav.settings", to: "/settings", icon: Settings },
      { labelKey: "nav.plans", to: "/plans", icon: CreditCard },
    ],
  },
];

const MOBILE_NAV = [
  { labelKey: "nav.home", to: "/dashboard", icon: LayoutDashboard },
  { labelKey: "nav.schedule", to: "/schedule", icon: CalendarDays },
  { labelKey: "nav.tasks", to: "/tasks", icon: CheckSquare },
  { labelKey: "nav.ai", to: "/ai", icon: BrainCircuit },
  { labelKey: "nav.profile", to: "/profile", icon: User },
];

function NavItem({ item, active, onClick, t }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`group flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
        active
          ? "bg-sidebar-accent/30 text-cyan-300 font-medium glow-active"
          : "text-sidebar-foreground glow-hover hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
      }`}
    >
      <Icon className={`w-[18px] h-[18px] shrink-0 ${active ? "text-cyan-400" : "text-muted-foreground"}`} />
      <span>{t(item.labelKey)}</span>
      {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_hsl(190_100%_50%/0.9)]" />}
    </Link>
  );
}

function LangSwitcher({ lang, setLang }) {
  return (
    <div className="flex items-center gap-1 p-1 rounded-lg border border-sidebar-border bg-sidebar/60">
      {LANGUAGES.map((l) => (
        <button
          key={l.code}
          onClick={() => setLang(l.code)}
          className={`flex-1 px-1.5 py-1 text-[10px] font-mono uppercase tracking-wider rounded-md transition-all ${
            lang === l.code ? "bg-cyan-500/15 text-cyan-300 glow-active" : "text-sidebar-foreground/70 hover:text-foreground"
          }`}
          title={l.name}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}

export default function AppShell() {
  const { user, logout, localWorkspace } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const { lang, setLang, t } = useI18n();
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);

  const togglePalette = () => window.dispatchEvent(new CustomEvent("unimate:palette"));

  const isActive = (to) => (to === "/" ? location.pathname === "/" : location.pathname.startsWith(to));

  const handleLogout = () => {
    logout(false);
    navigate("/login");
  };

  return (
    <div className="min-h-screen space-bg">
      {/* Atmospheric depth — faint, fixed, never distracting */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
        <div className="absolute -top-40 left-1/3 w-[560px] h-[380px] rounded-full bg-primary/[0.05] blur-[120px]" />
        <div className="absolute top-1/3 -right-24 w-[420px] h-[420px] rounded-full bg-cyan-500/[0.04] blur-[120px]" />
      </div>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 flex-col border-r border-sidebar-border bg-sidebar/85 backdrop-blur-md">
        <div className="px-5 pt-6 pb-5">
          <Link to="/dashboard">
            <Logo size={34} />
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-4 space-y-5">
          {NAV.map((group) => (
            <div key={group.sectionKey}>
              <div className="um-label px-3 mb-1.5 text-sidebar-foreground/70">{t(group.sectionKey)}</div>
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <NavItem key={item.to} item={item} t={t} active={isActive(item.to)} />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* HUD telemetry strip */}
        <div className="flex items-center justify-between px-5 pt-3 pb-1">
          {localWorkspace ? (
            <span className="hud-mono text-muted-foreground flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              Local workspace
            </span>
          ) : (
            <span className="hud-mono text-muted-foreground flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.9)]" />
              {t("shell.sysOnline")}
            </span>
          )}
          <span className="hud-mono text-muted-foreground/80">v1 · {new Date().getFullYear()}</span>
        </div>

        <div className="px-3 pb-2">
          <LangSwitcher lang={lang} setLang={setLang} />
        </div>

        <div className="border-t border-sidebar-border p-3">
          <Link to="/profile" className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-sidebar-accent/50 transition-colors">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-xs font-semibold text-white">
              {(user?.full_name || user?.email || "U").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
<div className="text-sm font-medium truncate">{user?.full_name || t("shell.student")}</div>
            <div className="text-xs text-muted-foreground truncate">{user?.email}</div>
          </div>
          {!localWorkspace && (
            <button onClick={handleLogout} className="text-muted-foreground hover:text-foreground" title={t("shell.logout")}>
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </Link>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-4 h-14 border-b border-border bg-background/80 backdrop-blur">
        <Link to="/dashboard">
          <Logo size={26} subtext={false} />
        </Link>
        <div className="flex items-center gap-1">
          <button onClick={togglePalette} aria-label="Search" className="p-2 rounded-lg hover:bg-muted"><Search className="w-5 h-5" /></button>
          <button onClick={() => setQuickAddOpen(true)} aria-label="Quick add" className="p-2 rounded-lg hover:bg-muted"><Plus className="w-5 h-5" /></button>
          <button onClick={() => setMobileMenu(true)} aria-label="Open menu" className="p-2 rounded-lg hover:bg-muted"><Menu className="w-5 h-5" /></button>
        </div>
      </header>

      {/* Mobile drawer */}
      {mobileMenu && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileMenu(false)} aria-hidden="true" />
          <div className="absolute inset-y-0 right-0 w-72 bg-sidebar border-l border-sidebar-border overflow-y-auto p-4">
            <div className="flex items-center justify-between mb-4">
              <span className="font-display font-semibold">{t("shell.menu")}</span>
              <button onClick={() => setMobileMenu(false)} aria-label="Close menu"><X className="w-5 h-5" /></button>
            </div>
            {NAV.map((group) => (
              <div key={group.sectionKey} className="mb-4">
                <div className="um-label mb-1.5">{t(group.sectionKey)}</div>
                <div className="space-y-0.5">
                  {group.items.map((item) => (
                    <NavItem key={item.to} item={item} t={t} active={isActive(item.to)} onClick={() => setMobileMenu(false)} />
                  ))}
                </div>
              </div>
            ))}
            <div className="mb-4">
              <LangSwitcher lang={lang} setLang={setLang} />
            </div>
            {!localWorkspace && (
  <button onClick={handleLogout} className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground">
    <LogOut className="w-4 h-4" /> {t("shell.logout")}
  </button>
)}
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Desktop top bar */}
        <header className="hidden lg:flex sticky top-0 z-20 items-center justify-between px-8 h-16 border-b border-border bg-background/80 backdrop-blur">
          <button
            onClick={togglePalette}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-card text-sm text-muted-foreground glow-hover w-72"
          >
            <Search className="w-4 h-4" />
            <span>{t("shell.search")}</span>
            <kbd className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-muted border border-border font-mono">⌘K</kbd>
          </button>
          <div className="flex items-center gap-1">
            <button onClick={() => setQuickAddOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
              <Plus className="w-4 h-4" /> {t("shell.quickAdd")}
            </button>
          </div>
        </header>

        <motion.main
          key={location.pathname}
          initial={{ opacity: 0, y: reduceMotion ? 0 : 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.21, 0.47, 0.32, 0.98] }}
          className="px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-10 max-w-[1400px] mx-auto"
        >
          <ErrorBoundary key={location.pathname}>
            <Outlet />
          </ErrorBoundary>
        </motion.main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 flex items-center justify-around border-t border-border bg-background/95 backdrop-blur h-16">
        {MOBILE_NAV.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.to);
          return (
            <Link key={item.to} to={item.to} aria-current={active ? "page" : undefined} className={`flex flex-col items-center gap-0.5 px-3 py-1.5 ${active ? "text-primary" : "text-muted-foreground"}`}>
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{t(item.labelKey)}</span>
            </Link>
          );
        })}
      </nav>

      {/* Mobile quick add FAB */}
      <button
        onClick={() => setQuickAddOpen(true)}
        aria-label="Quick add"
        className="lg:hidden fixed bottom-20 right-4 z-30 w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 flex items-center justify-center"
      >
        <Plus className="w-6 h-6" />
      </button>

      <QuickAdd open={quickAddOpen} onClose={() => setQuickAddOpen(false)} />
      <CommandPalette />
      <FloatingStickiesLayer />
    </div>
  );
}