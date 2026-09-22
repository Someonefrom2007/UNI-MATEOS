import { useState, useEffect, useCallback } from "react";
import { FileClock, RefreshCw, Search } from "lucide-react";

import { getAppRepo } from "@/lib/repo/select";
import { readAudit } from "@/lib/admin/probes";
import { filterAudit } from "@/lib/admin/auditLog";

const RESULT_BADGE = {
  success: "bg-teal-500/15 text-teal-300",
  failed: "bg-rose-500/15 text-rose-300",
  blocked: "bg-amber-500/15 text-amber-300",
  cancelled: "bg-white/10 text-slate-400",
};

export default function AdminAudit() {
  const repo = getAppRepo();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [q, setQ] = useState("");
  const [result, setResult] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const { entries: list } = await readAudit(repo, 500);
      setEntries(list);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [repo]);

  useEffect(() => { load(); }, [load]);

  const filtered = filterAudit(entries, { q: q.trim() || undefined, result: result || undefined });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-teal-400/80">system</div>
          <h1 className="font-display text-2xl font-semibold text-slate-50 mt-1 flex items-center gap-2">
            <FileClock className="w-6 h-6 text-teal-400" /> Audit log
          </h1>
          <p className="text-sm text-slate-400 mt-1">Append-only ledger of every sensitive console action. Entries are written, never edited.</p>
        </div>
        <button onClick={load} disabled={loading} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-sm text-slate-300 hover:text-slate-100 disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 bg-white/5 flex-1 min-w-[220px] max-w-sm">
          <Search className="w-4 h-4 text-slate-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter by action, target, actor…"
            aria-label="Filter audit entries"
            className="bg-transparent text-sm outline-none w-full placeholder:text-slate-600"
          />
        </div>
        <div className="flex rounded-lg border border-white/10 bg-white/5 overflow-hidden text-sm">
          {["", "success", "failed", "blocked"].map((r) => (
            <button key={r || "all"} onClick={() => setResult(r)} className={`px-3 py-1.5 ${result === r ? "bg-teal-500/15 text-teal-300" : "text-slate-400 hover:text-slate-200"}`}>
              {r || "all"}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-8 text-center text-sm text-slate-500">Reading ledger…</div>
      ) : failed ? (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-8 text-center text-sm text-rose-300">Couldn't read audit_log — in hosted mode this requires the admin schema (audit_recent RPC / admin read policy).</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-8 text-center text-sm text-slate-500">
          {entries.length === 0 ? "No audit entries yet — actions you take in the console will appear here." : "No entries match the filter."}
        </div>
      ) : (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] divide-y divide-white/5 max-h-[60vh] overflow-y-auto">
          {filtered.map((e) => (
            <div key={e.id ?? `${e.created_at}-${e.action}`} className="px-4 py-3 flex flex-wrap items-center gap-3 text-sm">
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase shrink-0 ${RESULT_BADGE[e.result] || "bg-white/10 text-slate-400"}`}>{e.result || "success"}</span>
              <span className="font-mono text-xs text-slate-200">{e.action}</span>
              <span className="text-[11px] text-slate-500 font-mono truncate">
                {e.target_type || "—"} {e.target_id ? `#${String(e.target_id).slice(0, 13)}` : ""}
              </span>
              {e.actor_id && <span className="text-[11px] text-slate-600 font-mono hidden sm:inline">by {String(e.actor_id).slice(0, 8)}…</span>}
              {e.meta && Object.keys(e.meta).length > 0 && (
                <span className="text-[11px] text-slate-600 font-mono truncate max-w-[240px] hidden md:inline">
                  {JSON.stringify(e.meta).slice(0, 120)}
                </span>
              )}
              <span className="ml-auto text-[11px] text-slate-600 font-mono shrink-0">{e.created_at ? String(e.created_at).slice(0, 19).replace("T", " ") : "—"}</span>
            </div>
          ))}
        </div>
      )}

      <p className="text-[11px] text-slate-600 font-mono">
        Hosted: read through SECURITY DEFINER audit_recent() (admin-checked) · Local: workspace ledger · up to 500 entries shown
      </p>
    </div>
  );
}