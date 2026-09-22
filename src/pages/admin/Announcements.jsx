import { useState, useEffect, useCallback } from "react";
import { Megaphone, Plus, RefreshCw, Trash2 } from "lucide-react";

import { getAppRepo } from "@/lib/repo/select";
import { useAdmin } from "@/lib/admin/useAdmin";
import { can, PERMISSIONS } from "@/lib/admin/permissions";
import { SEVERITIES, AUDIENCES, activeFor, normalizeAnnouncement, announcementRow, validateAnnouncement } from "@/lib/admin/announcements";
import { withAudit } from "@/lib/admin/auditLog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";

const severityBadge = (s) =>
  s === "important" ? "text-rose-300 bg-rose-500/10" : s === "maintenance" ? "text-amber-300 bg-amber-500/10" : s === "notice" ? "text-sky-300 bg-sky-500/10" : "text-slate-400 bg-white/5";

const EMPTY_FORM = { title: "", body: "", severity: "info", audience: "all", startAt: "", endAt: "" };

export default function AdminAnnouncements() {
  const { principal, env } = useAdmin();
  const { toast } = useToast();
  const repo = getAppRepo();
  const mayManage = can(principal, PERMISSIONS.SETTINGS_MANAGE);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [editing, setEditing] = useState(null); // { id?, ...form }
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const list = await repo.list("Announcement");
      setRows(Array.isArray(list) ? list : []);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [repo]);

  useEffect(() => { load(); }, [load]);

  const nowIso = new Date().toISOString();
  const liveNow = activeFor(rows.map(normalizeAnnouncement), { now: nowIso, plan: "free", isAdmin: true });

  const save = async () => {
    if (!editing) return;
    const form = normalizeAnnouncement(editing);
    const v = validateAnnouncement(form);
    if (!v.ok) {
      toast({ title: "Check the form", description: v.errors.join(", ") });
      return;
    }
    setBusy(true);
    const row = announcementRow(form);
    try {
      if (editing.id) {
        await repo.update("Announcement", editing.id, row);
      } else {
        await repo.create("Announcement", row);
      }
      await withAudit({ repo }, {
        action: editing.id ? "announcement.update" : "announcement.create",
        targetType: "Announcement",
        targetId: editing.id || row.title,
        actor: principal?.id || null,
        meta: { env: env.name, severity: row.severity, audience: row.audience },
      }, async () => ({ ok: true }));
      toast({ title: editing.id ? "Announcement updated" : "Announcement created", description: row.title });
      setEditing(null);
      await load();
    } catch (e) {
      toast({ title: "Save failed", description: e?.message || "RLS rejected the write" });
    }
    setBusy(false);
  };

  const remove = async (ann) => {
    setBusy(true);
    try {
      await repo.delete("Announcement", ann.id);
      await withAudit({ repo }, {
        action: "announcement.delete",
        targetType: "Announcement",
        targetId: ann.id,
        actor: principal?.id || null,
        meta: { env: env.name, title: ann.title },
      }, async () => ({ ok: true }));
      toast({ title: "Announcement deleted" });
      await load();
    } catch (e) {
      toast({ title: "Delete failed", description: e?.message || "rejected" });
    }
    setBusy(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-teal-400/80">configure</div>
          <h1 className="font-display text-2xl font-semibold text-slate-50 mt-1 flex items-center gap-2">
            <Megaphone className="w-6 h-6 text-teal-400" /> Announcements
          </h1>
          <p className="text-sm text-slate-400 mt-1">{liveNow.length} live right now · {rows.length} total.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} disabled={loading} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-sm text-slate-300 hover:text-slate-100 disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          {mayManage && (
            <button onClick={() => setEditing({ ...EMPTY_FORM })} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-teal-500/15 text-teal-300 text-sm ring-1 ring-teal-400/30 hover:bg-teal-500/20">
              <Plus className="w-4 h-4" /> New announcement
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-8 text-center text-sm text-slate-500">Loading…</div>
      ) : failed ? (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-8 text-center text-sm text-rose-300">Couldn't read announcements — apply the admin write policies.</div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-8 text-center text-sm text-slate-500">No announcements yet.</div>
      ) : (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] divide-y divide-white/5">
          {rows.slice().sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || ""))).map((raw) => {
            const a = normalizeAnnouncement(raw);
            const isLive = activeFor([a], { now: nowIso, plan: "free", isAdmin: true }).length > 0;
            return (
              <div key={raw.id} className="px-4 py-3 flex flex-wrap items-center gap-3 text-sm">
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase ${severityBadge(a.severity)}`}>{a.severity}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-slate-200 font-medium truncate">{a.title}</div>
                  <div className="text-xs text-slate-500 truncate">{a.body || "—"}</div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-white/5 text-slate-400">{a.audience}</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase ${isLive ? "bg-teal-500/10 text-teal-400" : "bg-white/5 text-slate-500"}`}>
                  {isLive ? "live" : "scheduled/off"}
                </span>
                {mayManage && (
                  <div className="flex gap-1.5">
                    <button onClick={() => setEditing({ ...EMPTY_FORM, ...a, id: raw.id })} className="px-2 py-1 rounded text-[11px] bg-white/5 text-slate-300 hover:bg-white/10">Edit</button>
                    <button disabled={busy} onClick={() => remove(raw)} className="px-2 py-1 rounded text-[11px] bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 flex items-center gap-1">
                      <Trash2 className="w-3 h-3" /> Delete
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={Boolean(editing)} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit announcement" : "New announcement"}</DialogTitle>
            <DialogDescription>Delivered to users matching the audience while the window is active.</DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <label className="block text-sm">
                <span className="text-slate-400">Title</span>
                <Input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className="mt-1" autoFocus />
              </label>
              <label className="block text-sm">
                <span className="text-slate-400">Body</span>
                <Textarea value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })} rows={3} className="mt-1" />
              </label>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <label className="block">
                  <span className="text-slate-400">Severity</span>
                  <select value={editing.severity} onChange={(e) => setEditing({ ...editing, severity: e.target.value })} className="mt-1 w-full h-9 rounded-md border border-white/10 bg-[#0c1426] px-2">
                    {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="text-slate-400">Audience</span>
                  <select value={editing.audience} onChange={(e) => setEditing({ ...editing, audience: e.target.value })} className="mt-1 w-full h-9 rounded-md border border-white/10 bg-[#0c1426] px-2">
                    {AUDIENCES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <label className="block">
                  <span className="text-slate-400">Starts (ISO)</span>
                  <Input value={editing.startAt} onChange={(e) => setEditing({ ...editing, startAt: e.target.value })} placeholder="2026-09-22T09:00:00Z" className="mt-1 font-mono text-xs" />
                </label>
                <label className="block">
                  <span className="text-slate-400">Ends (ISO)</span>
                  <Input value={editing.endAt} onChange={(e) => setEditing({ ...editing, endAt: e.target.value })} placeholder="2026-09-23T09:00:00Z" className="mt-1 font-mono text-xs" />
                </label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {!mayManage && <p className="text-[11px] text-amber-500/80 font-mono">Read-only: your role doesn't grant settings.manage.</p>}
    </div>
  );
}