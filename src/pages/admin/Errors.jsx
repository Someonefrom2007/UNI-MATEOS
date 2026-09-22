import { useState, useEffect, useCallback, useMemo } from "react";
import { TriangleAlert, RefreshCw, RotateCcw, CheckCircle2, Search } from "lucide-react";

import { getAppRepo } from "@/lib/repo/select";
import { useAdmin } from "@/lib/admin/useAdmin";
import { can, PERMISSIONS } from "@/lib/admin/permissions";
import { withAudit } from "@/lib/admin/auditLog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

const STATUS_BADGE = {
  failed: "bg-rose-500/15 text-rose-300",
  retrying: "bg-amber-500/15 text-amber-300",
  received: "bg-sky-500/15 text-sky-300",
  processed: "bg-teal-500/15 text-teal-300",
  resolved: "bg-white/10 text-slate-400",
};

const normalize = (e) => ({
  id: e.id,
  type: e.type || e.event_type || "unknown",
  status: e.status || "received",
  error: e.error || e.last_error || null,
  createdAt: e.created_at || e.createdAt || null,
  processedAt: e.processed_at || null,
  replayedAt: e.replayed_at || null,
  raw: e,
});

export default function AdminErrors() {
  const { principal, env } = useAdmin();
  const { toast } = useToast();
  const repo = getAppRepo();
  const mayReplay = can(principal, PERMISSIONS.BILLING_MANAGE);

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [q, setQ] = useState("");
  const [replayTarget, setReplayTarget] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const rows = await repo.list("WebhookEvent");
      setEvents((Array.isArray(rows) ? rows : []).map(normalize));
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [repo]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const sorted = events.slice().sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    if (!needle) return sorted;
    return sorted.filter((e) =>
      e.type.toLowerCase().includes(needle) ||
      e.status.toLowerCase().includes(needle) ||
      String(e.error || "").toLowerCase().includes(needle)
    );
  }, [events, q]);

  const counts = useMemo(() => {
    const out = { failed: 0, retrying: 0, received: 0, processed: 0, resolved: 0 };
    events.forEach((e) => { out[e.status] = (out[e.status] || 0) + 1; });
    return out;
  }, [events]);

  // Replay is deliberately a two-step, audited action — never one-click.
  const confirmReplay = async () => {
    if (!replayTarget) return;
    setBusy(true);
    try {
      await repo.update("WebhookEvent", replayTarget.id, {
        status: "retrying",
        replayed_at: new Date().toISOString(),
      });
      await withAudit({ repo }, {
        action: "webhook.replay",
        targetType: "WebhookEvent",
        targetId: replayTarget.id,
        actor: principal?.id || null,
        meta: { env: env.name, type: replayTarget.type },
      }, async () => ({ ok: true }));
      toast({ title: "Replay queued", description: `${replayTarget.type} marked retrying — the worker (or admin-gateway) will re-process it.` });
      setReplayTarget(null);
      await load();
    } catch (e) {
      toast({ title: "Replay failed", description: e?.message || "update rejected" });
    }
    setBusy(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-teal-400/80">operations</div>
          <h1 className="font-display text-2xl font-semibold text-slate-50 mt-1 flex items-center gap-2">
            <TriangleAlert className="w-6 h-6 text-amber-400" /> Errors & webhooks
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            {counts.failed} failed · {counts.retrying} retrying · {events.length} total events observed.
          </p>
        </div>
        <button onClick={load} disabled={loading} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-sm text-slate-300 hover:text-slate-100 disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 bg-white/5 max-w-md">
        <Search className="w-4 h-4 text-slate-500" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter by type, status, error…"
          aria-label="Filter webhook events"
          className="bg-transparent text-sm outline-none w-full placeholder:text-slate-600"
        />
      </div>

      {loading ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-8 text-center text-sm text-slate-500">Loading…</div>
      ) : failed ? (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-8 text-center text-sm text-rose-300">
          Couldn't read webhook_events — apply the admin monitor policies (the client has no access to raw webhook payloads by default).
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-8 text-center text-sm text-slate-500">
          {events.length === 0 ? "No webhook events recorded." : "No events match the filter."}
        </div>
      ) : (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] divide-y divide-white/5 max-h-[55vh] overflow-y-auto">
          {filtered.map((e) => (
            <div key={e.id} className="px-4 py-3 flex flex-wrap items-center gap-3 text-sm">
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase shrink-0 ${STATUS_BADGE[e.status] || "bg-white/10 text-slate-400"}`}>{e.status}</span>
              <span className="font-mono text-xs text-slate-200">{e.type}</span>
              {e.error && <span className="text-[11px] text-rose-400/90 font-mono truncate max-w-[280px]">{e.error}</span>}
              {e.replayedAt && (
                <span className="text-[10px] font-mono uppercase text-sky-400/80 flex items-center gap-1">
                  <RotateCcw className="w-3 h-3" /> replayed {String(e.replayedAt).slice(0, 10)}
                </span>
              )}
              <span className="ml-auto text-[11px] text-slate-600 font-mono shrink-0">{e.createdAt ? String(e.createdAt).slice(0, 19).replace("T", " ") : "—"}</span>
              {mayReplay && e.status === "failed" && (
                <button onClick={() => setReplayTarget(e)} className="px-2 py-1 rounded text-[11px] bg-sky-500/10 text-sky-300 hover:bg-sky-500/20 flex items-center gap-1">
                  <RotateCcw className="w-3 h-3" /> Replay…
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={Boolean(replayTarget)} onOpenChange={(v) => !v && setReplayTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Replay webhook event?</DialogTitle>
            <DialogDescription>
              Re-queues <span className="font-mono text-xs">{replayTarget?.type}</span> for processing. This is an audited action — never run replays in bulk without checking the payload first.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReplayTarget(null)}>Cancel</Button>
            <Button onClick={confirmReplay} disabled={busy} className="bg-sky-600 hover:bg-sky-500">
              <CheckCircle2 className="w-4 h-4 mr-1.5" /> {busy ? "Queuing…" : "Queue replay"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {!mayReplay && <p className="text-[11px] text-amber-500/80 font-mono">Read-only: replay requires billing.manage (webhook events are billing records).</p>}
      <p className="text-[11px] text-slate-600 font-mono">
        Payload bodies are not shown — full re-processing belongs to the server-side admin-gateway, not the browser.
      </p>
    </div>
  );
}