import { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  Activity, Users, CreditCard, Flag, Megaphone, ShieldAlert, ShieldCheck,
  CircleAlert, CircleCheck, CircleHelp, CircleMinus, ArrowRight, RefreshCw,
} from "lucide-react";

import { getAppRepo } from "@/lib/repo/select";
import { useAdmin } from "@/lib/admin/useAdmin";
import { planDistribution } from "@/lib/admin/metrics";
import { normalizeFlag } from "@/lib/admin/featureFlags";
import { PULSE, PULSE_LABELS, worstOf, overallLabel } from "@/lib/admin/pulse";
import { runSystemProbes, readAudit } from "@/lib/admin/probes";

const PULSE_ICON = {
  [PULSE.OPERATIONAL]: CircleCheck,
  [PULSE.DEGRADED]: CircleMinus,
  [PULSE.UNAVAILABLE]: CircleAlert,
  [PULSE.NOT_CONFIGURED]: CircleMinus,
  [PULSE.UNKNOWN]: CircleHelp,
};

const PULSE_COLOR = {
  [PULSE.OPERATIONAL]: "text-teal-400",
  [PULSE.DEGRADED]: "text-amber-400",
  [PULSE.UNAVAILABLE]: "text-rose-400",
  [PULSE.NOT_CONFIGURED]: "text-slate-500",
  [PULSE.UNKNOWN]: "text-slate-500",
};

const KNOWN_STATUS = new Set(["active", "on_trial"]);
const isSubscriptionActive = (s) => KNOWN_STATUS.has(String(s.status || "").toLowerCase());

const safeList = async (repo, table) => {
  try {
    const rows = await repo.list(table);
    return { rows: Array.isArray(rows) ? rows : [], failed: false };
  } catch {
    return { rows: null, failed: true };
  }
};

// ── Attention (real, verifiable signals only) ────────────────────────────────
const deriveAttention = ({ reports, subscriptions, webhooks, flags, pulse }) => {
  const items = [];
  if (reports?.rows) {
    const open = reports.rows.filter((r) => (r.status || "open") === "open").length;
    if (open > 0) items.push({ severity: "important", title: `${open} open moderation report${open === 1 ? "" : "s"}`, detail: "Review before they stack up.", href: "/admin/community" });
  }
  if (webhooks?.rows) {
    const failed = webhooks.rows.filter((r) => String(r.status || "").toLowerCase() === "failed" || r.error).length;
    if (failed > 0) items.push({ severity: "important", title: `${failed} webhook event${failed === 1 ? "" : "s"} failed`, detail: "Inspect from the billing center.", href: "/admin/billing" });
    else if (failed === 0 && webhooks.rows.length > 0) items.push({ severity: "ok", title: "All webhook events processed", detail: `${webhooks.rows.length} events, no failures.`, href: "/admin/billing" });
  }
  if (subscriptions?.rows) {
    const inactive = subscriptions.rows.filter((s) => !isSubscriptionActive(s)).length;
    if (inactive > 0) items.push({ severity: "notice", title: `${inactive} subscription${inactive === 1 ? "" : "s"} not active`, detail: "Churn, cancellation or unpaid state.", href: "/admin/billing" });
  }
  if (flags?.rows) {
    const rolledOut = flags.rows.filter((f) => { const n = normalizeFlag(f); return n.rolloutPct > 0 && n.rolloutPct < 100; }).length;
    if (rolledOut > 0) items.push({ severity: "info", title: `${rolledOut} flag${rolledOut === 1 ? "" : "s"} at partial rollout`, detail: "Percentage-gated experiment in progress.", href: "/admin/flags" });
  }
  pulse.forEach((c) => {
    if (c.status === PULSE.UNAVAILABLE) items.push({ severity: "important", title: `${c.label} unavailable`, detail: c.detail, href: "/admin/system" });
  });
  return items;
};

const StatCard = ({ label, value, sub, href, icon: Icon }) => (
  <Link to={href} className="block rounded-xl border border-white/10 bg-white/[0.03] p-4 hover:bg-white/[0.05] transition-colors">
    <div className="flex items-center justify-between mb-2">
      <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-500">{label}</span>
      {Icon && <Icon className="w-4 h-4 text-slate-600" />}
    </div>
    <div className="text-2xl font-display font-semibold text-slate-100">{value}</div>
    {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
  </Link>
);

const fmt = (n) => (n == null ? "—" : n.toLocaleString());
const timeAgo = (iso) => {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

export default function AdminOverview() {
  const { env } = useAdmin();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [pulse, setPulse] = useState([]);
  const [activity, setActivity] = useState({ entries: [] });

  const load = useCallback(async () => {
    setLoading(true);
    const repo = getAppRepo();
    try {
      const [users, reports, subscriptions, webhooks, flags, announcements, checks, audit] = await Promise.all([
        safeList(repo, "User"),
        safeList(repo, "CommunityReport"),
        safeList(repo, "Subscription"),
        safeList(repo, "WebhookEvent"),
        safeList(repo, "FeatureFlag"),
        safeList(repo, "Announcement"),
        runSystemProbes(),
        readAudit(repo, 8),
      ]);
      setData({ users, reports, subscriptions, webhooks, flags, announcements });
      setPulse(checks);
      setActivity(audit);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const overall = useMemo(() => (pulse.length ? worstOf(pulse.map((p) => p.status)) : PULSE.UNKNOWN), [pulse]);
  const plans = useMemo(() => planDistribution(data?.users?.rows || []), [data]);
  const attention = useMemo(
    () => (data ? deriveAttention({ ...data, pulse }) : []),
    [data, pulse]
  );
  const activeSubs = data?.subscriptions?.rows?.filter(isSubscriptionActive).length ?? null;
  const activeAnnouncements = data?.announcements?.rows?.filter((a) => {
    const now = new Date().toISOString();
    const start = a.start_at || a.startAt;
    const end = a.end_at || a.endAt;
    return (!start || now >= start) && (!end || now <= end);
  }).length ?? null;
  const enabledFlags = data?.flags?.rows?.filter((f) => normalizeFlag(f).enabled).length ?? null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-teal-400/80">control center</div>
          <h1 className="font-display text-2xl font-semibold text-slate-50 mt-1">Mission overview</h1>
          <p className="text-sm text-slate-400 mt-1">{env.label}</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-sm text-slate-300 hover:text-slate-100 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {/* System pulse */}
      <section aria-label="System pulse" className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-teal-400" />
            <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-slate-400">system pulse</span>
          </div>
          <span className={`text-[11px] font-mono uppercase tracking-widest ${PULSE_COLOR[overall]}`}>
            {overallLabel(overall)}
          </span>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {(loading && pulse.length === 0
            ? Array.from({ length: 5 }, (_, i) => ({ id: `s${i}`, label: "probing…", status: PULSE.UNKNOWN, detail: "running checks" }))
            : pulse
          ).map((c) => {
            const Icon = PULSE_ICON[c.status] || CircleHelp;
            return (
              <div key={c.id} className="rounded-lg border border-white/10 bg-[#0c1426] p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <Icon className={`w-4 h-4 ${PULSE_COLOR[c.status]}`} />
                  <span className="text-sm text-slate-200 truncate">{c.label}</span>
                </div>
                <div className={`text-[10px] font-mono uppercase tracking-wider ${PULSE_COLOR[c.status]}`}>{PULSE_LABELS[c.status]}</div>
                <div className="text-[11px] text-slate-500 mt-1 line-clamp-2">{c.detail}</div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Stats */}
      <section aria-label="Key metrics" className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="users"
          icon={Users}
          value={loading ? "…" : fmt(data?.users?.rows?.length)}
          sub={loading ? "loading" : data?.users?.failed ? "couldn't load" : `free ${plans.free} · pro ${plans.pro} · ultimate ${plans.ultimate}`}
          href="/admin/users"
        />
        <StatCard
          label="active subscriptions"
          icon={CreditCard}
          value={loading ? "…" : fmt(activeSubs)}
          sub={loading ? "loading" : data?.subscriptions?.failed ? "couldn't load" : `${data?.subscriptions?.rows?.length ?? 0} subscription records`}
          href="/admin/billing"
        />
        <StatCard
          label="flags enabled"
          icon={Flag}
          value={loading ? "…" : fmt(enabledFlags)}
          sub={loading ? "loading" : data?.flags?.failed ? "couldn't load" : `${data?.flags?.rows?.length ?? 0} flags defined`}
          href="/admin/flags"
        />
        <StatCard
          label="active announcements"
          icon={Megaphone}
          value={loading ? "…" : fmt(activeAnnouncements)}
          sub={loading ? "loading" : data?.announcements?.failed ? "couldn't load" : `${data?.announcements?.rows?.length ?? 0} announcements`}
          href="/admin/announcements"
        />
      </section>

      {/* Attention + activity */}
      <div className="grid lg:grid-cols-2 gap-4">
        <section aria-label="Attention" className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center gap-2 mb-4">
            <ShieldAlert className="w-4 h-4 text-amber-400" />
            <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-slate-400">needs attention</span>
            <span className="ml-auto text-[11px] font-mono text-slate-500">{attention.filter((a) => a.severity !== "ok").length}</span>
          </div>
          {loading ? (
            <div className="text-sm text-slate-500">Deriving from live data…</div>
          ) : attention.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-teal-400/90">
              <ShieldCheck className="w-4 h-4" /> Nothing needs attention right now.
            </div>
          ) : (
            <ul className="space-y-2">
              {attention.map((a, i) => (
                <li key={`${a.title}-${i}`}>
                  <Link
                    to={a.href}
                    className="flex items-start gap-3 rounded-lg border border-white/10 bg-[#0c1426] p-3 hover:bg-white/[0.04] transition-colors group"
                  >
                    <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${
                      a.severity === "important" ? "bg-rose-400" : a.severity === "notice" ? "bg-amber-400" : a.severity === "ok" ? "bg-teal-400" : "bg-sky-400"
                    }`} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-slate-200">{a.title}</div>
                      <div className="text-xs text-slate-500">{a.detail}</div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-label="Recent console activity" className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck className="w-4 h-4 text-teal-400" />
            <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-slate-400">recent activity</span>
            <Link to="/admin/audit" className="ml-auto text-[11px] font-mono text-teal-400/80 hover:text-teal-300 flex items-center gap-1">
              full log <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {loading ? (
            <div className="text-sm text-slate-500">Reading audit log…</div>
          ) : activity.entries.length === 0 ? (
            <div className="text-sm text-slate-500">No console activity recorded yet.</div>
          ) : (
            <ul className="space-y-2">
              {activity.entries.map((e, i) => (
                <li key={`${e.id || e.created_at || i}`} className="flex items-center gap-3 text-sm">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono uppercase ${
                    e.result === "failed" ? "bg-rose-500/15 text-rose-300" : "bg-teal-500/15 text-teal-300"
                  }`}>{e.result || "ok"}</span>
                  <span className="font-mono text-slate-300 truncate">{e.action}</span>
                  <span className="ml-auto text-[11px] text-slate-500 shrink-0">{timeAgo(e.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Quick actions */}
      <section aria-label="Quick actions" className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
        <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-slate-400 mb-3">quick actions</div>
        <div className="flex flex-wrap gap-2">
          {[
            { label: "Review reports", href: "/admin/community" },
            { label: "Manage feature flags", href: "/admin/flags" },
            { label: "Billing reconciliation", href: "/admin/billing" },
            { label: "Audit log", href: "/admin/audit" },
          ].map((q) => (
            <Link
              key={q.href}
              to={q.href}
              className="px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-sm text-slate-300 hover:text-slate-100 hover:bg-white/10 transition-colors"
            >
              {q.label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}