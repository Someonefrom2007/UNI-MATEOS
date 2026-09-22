import { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import { Users as UsersIcon, Search, ShieldOff, ShieldCheck, Ban, Trash2, RefreshCw, ChevronDown } from "lucide-react";

import { getAppRepo } from "@/lib/repo/select";
import { useAdmin } from "@/lib/admin/useAdmin";
import { can, PERMISSIONS } from "@/lib/admin/permissions";
import { ACCOUNT_STATUS, ACCOUNT_TRANSITIONS, ACTION_PHRASES, deleteConsequences, confirmPhrase, applyStatus } from "@/lib/admin/users";
import { withAudit } from "@/lib/admin/auditLog";
import { planOf } from "@/lib/plans";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";

// Tables whose rows are owned by a user — deleted with the account (hosted
// rows carry user_id; the console runs this under RLS).
const OWNED_TABLES = ["Course", "Task", "Exam", "Note", "Grade", "Resource", "FocusSession", "Goal", "Habit", "CommunityPost", "CommunityReply"];

const statusColor = (s) =>
  s === "active" ? "text-teal-400 bg-teal-500/10" : s === "suspended" ? "text-amber-400 bg-amber-500/10" : "text-rose-400 bg-rose-500/10";

const planColor = (p) => (p === "ultimate" ? "text-violet-300 bg-violet-500/10" : p === "pro" ? "text-teal-300 bg-teal-500/10" : "text-slate-400 bg-white/5");

export default function AdminUsers() {
  const { principal, env } = useAdmin();
  const { toast } = useToast();
  const repo = getAppRepo();
  const mayManage = can(principal, PERMISSIONS.USERS_MANAGE);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [busyId, setBusyId] = useState(null);
  const [deleting, setDeleting] = useState(null); // { row, counts, phrase }
  const [typed, setTyped] = useState("");
  const [menuId, setMenuId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const list = await repo.list("User");
      setRows(Array.isArray(list) ? list : []);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [repo]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all" && (r.status || "active") !== statusFilter) return false;
      if (!needle) return true;
      return `${r.email || ""} ${r.full_name || ""} ${r.id || ""}`.toLowerCase().includes(needle);
    });
  }, [rows, q, statusFilter]);

  const setStatus = async (row, next) => {
    if (!mayManage) return;
    setBusyId(row.id);
    const res = await applyStatus({ repo }, row.id, next);
    if (res.ok) {
      await withAudit({ repo }, {
        action: `account.${next}`,
        targetType: "UserProfile",
        targetId: row.id,
        actor: principal?.userId || principal?.id || null,
        meta: { env: env.name, email: row.email },
      }, async () => ({ ok: true }));
      toast({ title: `Account ${next}`, description: row.email });
      await load();
    } else {
      toast({ title: "Not allowed", description: res.error instanceof Error ? res.error.message : String(res.error || "transition rejected") });
    }
    setBusyId(null);
    setMenuId(null);
  };

  const prepareDelete = async (row) => {
    setMenuId(null);
    setTyped("");
    setDeleting({ row, counts: null });
    const counts = {};
    for (const table of OWNED_TABLES) {
      try {
        const list = await repo.list(table);
        counts[table] = (list || []).filter((r) => String(r.user_id) === String(row.id)).length;
      } catch { /* leave unknown */ }
    }
    setDeleting({ row, counts });
  };

  const runDelete = async () => {
    if (!deleting || !confirmPhrase(typed, ACTION_PHRASES.DELETE)) return;
    const { row } = deleting;
    setBusyId(row.id);
    let removed = 0;
    let failedRows = 0;
    for (const table of OWNED_TABLES) {
      try {
        const list = await repo.list(table);
        const mine = (list || []).filter((r) => String(r.user_id) === String(row.id));
        for (const r of mine) {
          const ok = await repo.delete(table, r.id);
          if (ok !== false) removed += 1;
          else failedRows += 1;
        }
      } catch { failedRows += 1; }
    }
    let profileRemoved = false;
    try { profileRemoved = await repo.delete("User", row.id) !== false; } catch { profileRemoved = false; }

    await withAudit({ repo }, {
      action: "account.delete",
      targetType: "UserProfile",
      targetId: row.id,
      actor: principal?.userId || principal?.id || null,
      meta: { env: env.name, email: row.email, removed, failed: failedRows, profileRemoved },
    }, async () => ({ ok: profileRemoved }));

    toast({
      title: profileRemoved ? "Account removed" : "Partial removal",
      description: `${removed} content rows deleted${failedRows ? `, ${failedRows} failed` : ""}. Auth identity must be purged server-side.`,
    });
    setDeleting(null);
    setTyped("");
    setBusyId(null);
    await load();
  };

  const allowedNext = (row) => ACCOUNT_TRANSITIONS[row.status || "active"] || [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-teal-400/80">operations</div>
          <h1 className="font-display text-2xl font-semibold text-slate-50 mt-1 flex items-center gap-2">
            <UsersIcon className="w-6 h-6 text-teal-400" /> Users
          </h1>
          <p className="text-sm text-slate-400 mt-1">{rows.length} account{rows.length === 1 ? "" : "s"} visible under your access scope.</p>
        </div>
        <button onClick={load} disabled={loading} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-sm text-slate-300 hover:text-slate-100 disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 bg-white/5 flex-1 min-w-[220px] max-w-sm">
          <Search className="w-4 h-4 text-slate-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search email, name or id…"
            aria-label="Search users"
            className="bg-transparent text-sm outline-none w-full placeholder:text-slate-600"
          />
        </div>
        <div className="flex rounded-lg border border-white/10 bg-white/5 overflow-hidden text-sm">
          {["all", ...ACCOUNT_STATUS].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 capitalize ${statusFilter === s ? "bg-teal-500/15 text-teal-300" : "text-slate-400 hover:text-slate-200"}`}
            >{s}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-8 text-center text-sm text-slate-500">Loading accounts…</div>
      ) : failed ? (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-8 text-center text-sm text-rose-300">Couldn't read user_profiles — check RLS admin policies are applied.</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-8 text-center text-sm text-slate-500">
          {rows.length === 0 ? "No account rows are visible from this workspace." : "No accounts match the filter."}
        </div>
      ) : (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] divide-y divide-white/5 overflow-visible">
          {filtered.map((row) => {
            const status = row.status || "active";
            const plan = planOf(row.plan || row.user_metadata?.plan || "free");
            const nexts = allowedNext(row);
            return (
              <div key={row.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="w-9 h-9 rounded-lg bg-slate-700/50 ring-1 ring-white/10 flex items-center justify-center text-xs font-semibold text-slate-300 shrink-0">
                  {(row.full_name || row.email || "?").charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-slate-200 truncate">{row.full_name || "—"}</div>
                  <div className="text-xs text-slate-500 font-mono truncate">{row.email || row.id}</div>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase ${planColor(plan)}`}>{plan}</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase ${statusColor(status)}`}>{status}</span>
                <div className="text-[11px] text-slate-600 font-mono hidden sm:block">{row.created_at ? String(row.created_at).slice(0, 10) : "—"}</div>

                {mayManage && (
                  <div className="relative">
                    <button
                      onClick={() => setMenuId(menuId === row.id ? null : row.id)}
                      disabled={busyId === row.id || nexts.length === 0}
                      aria-label={`Actions for ${row.email || row.id}`}
                      className="p-1.5 rounded-lg border border-white/10 text-slate-400 hover:text-slate-200 disabled:opacity-40"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                    {menuId === row.id && (
                      <div className="absolute right-0 z-20 mt-1 w-56 rounded-lg border border-white/10 bg-[#0c1426] p-1 shadow-xl">
                        {nexts.includes("suspended") && (
                          <button onClick={() => setStatus(row, "suspended")} className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-slate-300 hover:bg-white/5">
                            <Ban className="w-4 h-4 text-amber-400" /> Suspend
                          </button>
                        )}
                        {nexts.includes("active") && (
                          <button onClick={() => setStatus(row, "active")} className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-slate-300 hover:bg-white/5">
                            <ShieldCheck className="w-4 h-4 text-teal-400" /> Restore
                          </button>
                        )}
                        {nexts.includes("disabled") && (
                          <button onClick={() => setStatus(row, "disabled")} className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-slate-300 hover:bg-white/5">
                            <ShieldOff className="w-4 h-4 text-slate-400" /> Disable
                          </button>
                        )}
                        <div className="my-1 border-t border-white/10" />
                        <button onClick={() => prepareDelete(row)} className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-rose-300 hover:bg-rose-500/10">
                          <Trash2 className="w-4 h-4" /> Delete account…
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Delete dialog — never one-click: typed phrase + consequence preview */}
      <Dialog open={Boolean(deleting)} onOpenChange={(v) => !v && setDeleting(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-rose-300">Delete {deleting?.row?.email || "account"}?</DialogTitle>
            <DialogDescription>
              This permanently removes the profile row and all content rows below. Suspension/restore never delete anything — this does.
            </DialogDescription>
          </DialogHeader>
          {deleting?.counts ? (
            <div className="space-y-3">
              <div className="rounded-lg border border-white/10 bg-[#0c1426] p-3 text-sm">
                <div className="text-slate-400 mb-2">{deleteConsequences(deleting.counts).total} row(s) across {deleteConsequences(deleting.counts).counts.length} table(s):</div>
                <div className="flex flex-wrap gap-1.5">
                  {deleteConsequences(deleting.counts).counts.map((c) => (
                    <span key={c.table} className="px-2 py-0.5 rounded bg-white/5 text-[11px] font-mono text-slate-300">{c.table} × {c.count}</span>
                  ))}
                  {deleteConsequences(deleting.counts).counts.length === 0 && <span className="text-xs text-slate-500">no owned content rows</span>}
                </div>
              </div>
              <p className="text-xs text-slate-500">
                The Supabase Auth identity itself cannot be removed from the browser — it must be purged server-side (recorded in the audit entry either way).
              </p>
              <label className="block">
                <span className="text-xs text-slate-400">Type <code className="font-mono text-rose-300">{ACTION_PHRASES.DELETE}</code> to confirm</span>
                <Input value={typed} onChange={(e) => setTyped(e.target.value)} className="mt-1 font-mono" aria-label="Confirmation phrase" autoFocus />
              </label>
            </div>
          ) : (
            <div className="text-sm text-slate-500 py-4">Counting owned content…</div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={!deleting?.counts || !confirmPhrase(typed, ACTION_PHRASES.DELETE) || busyId === deleting?.row?.id}
              onClick={runDelete}
            >
              {busyId === deleting?.row?.id ? "Deleting…" : "Delete permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <p className="text-[11px] text-slate-600 font-mono">
        Authz: RLS admin_read/admin_update on user_profiles + is_admin() server gate · changes audited to audit_log
      </p>
      {!mayManage && (
        <p className="text-[11px] text-amber-500/80 font-mono">Read-only: your role doesn't grant users.manage.</p>
      )}
      <Link to="/admin/audit" className="inline-block text-xs text-teal-400/80 hover:text-teal-300">Open audit log →</Link>
    </div>
  );
}