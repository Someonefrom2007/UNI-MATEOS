import { useState, useEffect, useMemo, useCallback } from "react";
import { MessageSquare, RefreshCw, EyeOff, Eye, Trash2, CheckCircle2, XCircle } from "lucide-react";

import { getAppRepo } from "@/lib/repo/select";
import { useAdmin } from "@/lib/admin/useAdmin";
import { can, PERMISSIONS, ROLES } from "@/lib/admin/permissions";
import { nextReportStatuses, nextContentStatuses, canModerate, moderateReport, moderateContent } from "@/lib/admin/moderation";
import { withAudit } from "@/lib/admin/auditLog";
import { useToast } from "@/components/ui/use-toast";

const reportBadge = (s) =>
  s === "open" ? "text-amber-400 bg-amber-500/10" : s === "reviewed" ? "text-teal-400 bg-teal-500/10" : "text-slate-400 bg-white/5";

const contentBadge = (s) =>
  s === "active" ? "text-teal-400 bg-teal-500/10" : s === "hidden" ? "text-amber-400 bg-amber-500/10" : "text-rose-400 bg-rose-500/10";

const safeList = async (repo, table) => {
  try { return { rows: await repo.list(table), failed: false }; } catch { return { rows: [], failed: true }; }
};

export default function AdminCommunity() {
  const { principal, env } = useAdmin();
  const { toast } = useToast();
  const repo = getAppRepo();
  const mayModerate = can(principal, PERMISSIONS.COMMUNITY_MODERATE);
  const mayRemove = canModerate(principal, "remove");

  const [reports, setReports] = useState([]);
  const [posts, setPosts] = useState([]);
  const [replies, setReplies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState("reports");
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    const [r, p, rp] = await Promise.all([safeList(repo, "CommunityReport"), safeList(repo, "CommunityPost"), safeList(repo, "CommunityReply")]);
    setReports(r.rows); setPosts(p.rows); setReplies(rp.rows);
    setFailed(r.failed || p.failed || rp.failed);
    setLoading(false);
  }, [repo]);

  useEffect(() => { load(); }, [load]);

  const sortedReports = useMemo(
    () => reports.slice().sort((a, b) => {
      const rank = { open: 0, reviewed: 1, dismissed: 2 };
      return (rank[a.status] ?? 3) - (rank[b.status] ?? 3) || String(b.created_at || "").localeCompare(String(a.created_at || ""));
    }),
    [reports]
  );
  const openReports = reports.filter((r) => (r.status || "open") === "open").length;

  const actOnReport = async (report, action) => {
    const decision = moderateReport(report, action, {});
    if (!decision.ok) { toast({ title: "Rejected", description: decision.error }); return; }
    setBusy(`${report.id}:${action}`);
    try {
      await repo.update("CommunityReport", report.id, { status: decision.status });
      await withAudit({ repo }, {
        action: `moderation.report.${action}`,
        targetType: "CommunityReport",
        targetId: report.id,
        actor: principal?.id || null,
        meta: { env: env.name, reason: decision.reason, post_id: report.post_id },
      }, async () => ({ ok: true }));
      toast({ title: `Report ${action}d`, description: decision.reason });
      await load();
    } catch (e) {
      toast({ title: "Failed", description: e?.message || "update rejected" });
    }
    setBusy(null);
  };

  const actOnContent = async (kind, content, action) => {
    const decision = moderateContent(content, action, {});
    if (!decision.ok) { toast({ title: "Rejected", description: decision.error }); return; }
    if (action === "removed" && !mayRemove) { toast({ title: "Permission", description: "Removing content requires super admin." }); return; }
    setBusy(`${kind}:${content.id}:${action}`);
    const table = kind === "post" ? "CommunityPost" : "CommunityReply";
    try {
      await repo.update(table, content.id, { status: decision.status });
      await withAudit({ repo }, {
        action: `moderation.content.${action}`,
        targetType: table,
        targetId: content.id,
        actor: principal?.id || null,
        meta: { env: env.name, kind, reason: decision.reason },
      }, async () => ({ ok: true }));
      toast({ title: `Content ${action}d`, description: decision.reason });
      await load();
    } catch (e) {
      toast({ title: "Failed", description: e?.message || "update rejected" });
    }
    setBusy(null);
  };

  const contentRow = (kind, c) => {
    const status = c.status || "active";
    const nexts = nextContentStatuses(status);
    return (
      <div key={`${kind}-${c.id}`} className="px-4 py-3 flex flex-wrap items-center gap-3 text-sm">
        <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase ${contentBadge(status)}`}>{status}</span>
        <span className="text-[10px] font-mono uppercase text-slate-600 w-14 shrink-0">{kind}</span>
        <div className="min-w-0 flex-1">
          <div className="text-slate-300 truncate">{c.content || c.title || c.body || "—"}</div>
          <div className="text-[11px] text-slate-600 font-mono truncate">{c.user_id?.slice(0, 13)}… · {c.created_at ? String(c.created_at).slice(0, 10) : "—"}</div>
        </div>
        {mayModerate && (
          <div className="flex gap-1.5">
            {nexts.includes("active") && (
              <button disabled={busy?.startsWith(`${kind}:${c.id}`)} onClick={() => actOnContent(kind, c, "active")} className="px-2 py-1 rounded text-[11px] bg-white/5 text-slate-300 hover:bg-white/10 flex items-center gap-1">
                <Eye className="w-3 h-3" /> Restore
              </button>
            )}
            {nexts.includes("hidden") && (
              <button disabled={busy?.startsWith(`${kind}:${c.id}`)} onClick={() => actOnContent(kind, c, "hidden")} className="px-2 py-1 rounded text-[11px] bg-white/5 text-slate-300 hover:bg-white/10 flex items-center gap-1">
                <EyeOff className="w-3 h-3" /> Hide
              </button>
            )}
            {nexts.includes("removed") && (
              <button disabled={busy?.startsWith(`${kind}:${c.id}`) || !mayRemove} onClick={() => actOnContent(kind, c, "removed")} className="px-2 py-1 rounded text-[11px] bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 flex items-center gap-1 disabled:opacity-40">
                <Trash2 className="w-3 h-3" /> Remove
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-teal-400/80">operations</div>
          <h1 className="font-display text-2xl font-semibold text-slate-50 mt-1 flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-teal-400" /> Community moderation
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            {openReports} open report{openReports === 1 ? "" : "s"} · content is hidden or restored, never silently destroyed — every action is audited.
          </p>
        </div>
        <button onClick={load} disabled={loading} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-sm text-slate-300 hover:text-slate-100 disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      <div className="flex rounded-lg border border-white/10 bg-white/5 overflow-hidden text-sm w-max">
        {[["reports", `Reports (${reports.length})`], ["posts", `Posts (${posts.length})`], ["replies", `Replies (${replies.length})`]].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className={`px-4 py-2 ${tab === id ? "bg-teal-500/15 text-teal-300" : "text-slate-400 hover:text-slate-200"}`}>{label}</button>
        ))}
      </div>

      {loading ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-8 text-center text-sm text-slate-500">Loading…</div>
      ) : failed ? (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-8 text-center text-sm text-rose-300">Couldn't read community tables — apply the admin policies.</div>
      ) : (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] divide-y divide-white/5">
          {tab === "reports" && (sortedReports.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">No reports recorded.</div>
          ) : sortedReports.map((report) => {
            const status = report.status || "open";
            const nexts = nextReportStatuses(status);
            return (
              <div key={report.id} className="px-4 py-3 flex flex-wrap items-center gap-3 text-sm">
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase ${reportBadge(status)}`}>{status}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-slate-300 truncate">{report.reason || report.details || "report"}</div>
                  <div className="text-[11px] text-slate-600 font-mono truncate">
                    post {report.post_id?.slice(0, 8) || "—"}… · by {report.reporter_id?.slice(0, 8) || "—"}… · {report.created_at ? String(report.created_at).slice(0, 16).replace("T", " ") : "—"}
                  </div>
                </div>
                {mayModerate && (
                  <div className="flex gap-1.5">
                    {nexts.includes("reviewed") && (
                      <button disabled={busy?.startsWith(`${report.id}:`)} onClick={() => actOnReport(report, "reviewed")} className="px-2 py-1 rounded text-[11px] bg-teal-500/10 text-teal-300 hover:bg-teal-500/20 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Reviewed
                      </button>
                    )}
                    {nexts.includes("dismissed") && (
                      <button disabled={busy?.startsWith(`${report.id}:`)} onClick={() => actOnReport(report, "dismissed")} className="px-2 py-1 rounded text-[11px] bg-white/5 text-slate-300 hover:bg-white/10 flex items-center gap-1">
                        <XCircle className="w-3 h-3" /> Dismiss
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          }))}
          {tab === "posts" && (posts.length === 0 ? <div className="p-8 text-center text-sm text-slate-500">No posts visible.</div> : posts.map((c) => contentRow("post", c)))}
          {tab === "replies" && (replies.length === 0 ? <div className="p-8 text-center text-sm text-slate-500">No replies visible.</div> : replies.map((c) => contentRow("reply", c)))}
        </div>
      )}

      {!mayModerate && <p className="text-[11px] text-amber-500/80 font-mono">Read-only: your role doesn't grant community.moderate.</p>}
      {!mayRemove && mayModerate && <p className="text-[11px] text-slate-600 font-mono">Removing content outright requires super admin ({ROLES.SUPER_ADMIN}).</p>}
    </div>
  );
}