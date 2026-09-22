import { useState, useEffect, useMemo } from "react";
import { BarChart3, RefreshCw, Info } from "lucide-react";

import { getAppRepo } from "@/lib/repo/select";
import { countsByDay, planDistribution, usageBars, newUsers, onboarding } from "@/lib/admin/metrics";

const USAGE_LABELS = {
  Course: "Courses", Task: "Tasks", Exam: "Exams", Note: "Notes", Grade: "Grades",
  Resource: "Resources", FocusSession: "Focus sessions", CommunityPost: "Community posts",
  FlashcardDeck: "Flashcard decks", Goal: "Goals", Habit: "Habits",
};

// Entities we measure. AI has no telemetry table today → reported as null
// ("no telemetry"), never as a fabricated zero.
const MEASURE = ["User", "Course", "Task", "Exam", "Note", "Grade", "Resource", "FocusSession", "CommunityPost", "FlashcardDeck", "Goal", "Habit", "Subscription"];

const safeList = async (repo, table) => {
  try {
    const rows = await repo.list(table);
    return { rows: Array.isArray(rows) ? rows : [], failed: false };
  } catch {
    return { rows: null, failed: true };
  }
};

const Bar = ({ label, count, max }) => {
  const pct = max > 0 ? Math.max(2, Math.round((count / max) * 100)) : 2;
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-36 shrink-0 text-slate-400 truncate">{label}</span>
      <div className="flex-1 h-2.5 rounded-full bg-white/5 overflow-hidden">
        <div className="h-full rounded-full bg-teal-500/60" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-12 text-right font-mono text-xs text-slate-300">{count}</span>
    </div>
  );
};

export default function AdminAnalytics() {
  const repo = getAppRepo();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const out = {};
    for (const table of MEASURE) out[table] = await safeList(repo, table);
    setData(out);
    setLoading(false);
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const counts = /** @type {Record<string, number|null>} */ (
    useMemo(() => {
      if (!data) return {};
      const out = {};
      MEASURE.forEach((t) => { out[t] = data[t].failed ? null : data[t].rows.length; });
      out.AI = null; // no telemetry source — honest null
      return out;
    }, [data])
  );

  const bars = useMemo(() => usageBars(counts, USAGE_LABELS), [counts]);
  const max = bars[0]?.count || 1;
  const userRows = data?.User?.rows || [];
  const plans = planDistribution(userRows);
  const dailySignups = countsByDay(userRows, "created_at", 14);
  const onb = onboarding(userRows);
  const anyFailed = data && MEASURE.some((t) => data[t].failed);
  const signups7 = newUsers(userRows, 7);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-teal-400/80">insights</div>
          <h1 className="font-display text-2xl font-semibold text-slate-50 mt-1 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-teal-400" /> Analytics
          </h1>
          <p className="text-sm text-slate-400 mt-1">Aggregated from real rows in your access scope. Missing sources show "—", never a guessed number.</p>
        </div>
        <button onClick={load} disabled={loading} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-sm text-slate-300 hover:text-slate-100 disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {anyFailed && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-300">
          Some sources couldn't be read (admin RLS policies not applied?) — their numbers show "—".
        </div>
      )}

      <div className="grid sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-500">accounts</div>
          <div className="text-2xl font-display font-semibold text-slate-100 mt-1">{loading ? "…" : counts.User == null ? "—" : counts.User}</div>
          <div className="text-xs text-slate-500 mt-1">{loading ? "loading" : `free ${plans.free} · pro ${plans.pro} · ultimate ${plans.ultimate}`}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-500">new this week</div>
          <div className="text-2xl font-display font-semibold text-slate-100 mt-1">{loading ? "…" : signups7}</div>
          <div className="text-xs text-slate-500 mt-1">profiles created in the last 7 days</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-500">onboarding</div>
          <div className="text-2xl font-display font-semibold text-slate-100 mt-1">{loading ? "…" : onb.completed}/{onb.total}</div>
          <div className="text-xs text-slate-500 mt-1">profiles marked onboarded</div>
        </div>
      </div>

      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
        <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-slate-400 mb-4">entity volume</div>
        {loading ? (
          <div className="text-sm text-slate-500">Aggregating…</div>
        ) : (
          <div className="space-y-2.5">
            {bars.map((b) => <Bar key={b.label} label={b.label} count={b.count} max={max} />)}
            <div className="flex items-center gap-3 text-sm">
              <span className="w-36 shrink-0 text-slate-500 truncate">AI requests</span>
              <span className="font-mono text-xs text-slate-500">no telemetry table</span>
            </div>
            <p className="text-[11px] text-slate-600 font-mono flex items-center gap-1.5 pt-1">
              <Info className="w-3.5 h-3.5" /> AI has no telemetry table yet — shown as no data, not zero.
            </p>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
        <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-slate-400 mb-4">daily signups · last 14 days</div>
        {loading ? (
          <div className="text-sm text-slate-500">Bucketing…</div>
        ) : (
          <div className="flex items-end gap-1.5 h-28">
            {dailySignups.map((d) => {
              const peak = Math.max(...dailySignups.map((x) => x.count), 1);
              return (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group" title={`${d.date}: ${d.count}`}>
                  <span className="text-[10px] font-mono text-slate-500 opacity-0 group-hover:opacity-100">{d.count}</span>
                  <div className="w-full rounded-t bg-teal-500/50 hover:bg-teal-400/70 transition-all" style={{ height: `${Math.max(3, (d.count / peak) * 72)}px` }} />
                  <span className="text-[9px] font-mono text-slate-600">{d.date.slice(5)}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}