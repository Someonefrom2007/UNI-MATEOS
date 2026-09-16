import { useMemo, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { isLocalWorkspace } from "@/lib/repo/select";
import { createLocalRepo } from "@/lib/repo/localRepo";
import { useToast } from "@/components/ui/use-toast";
import { parseICS, toScheduleEventRows, diffICS, fetchICSFeed, expandForImport } from "@/lib/calendarSync";
import { loadFeeds, addFeed as storeAddFeed, removeFeed as storeRemoveFeed, feedName } from "@/lib/feedsStore";
import { Link2, Upload, RefreshCw, Trash2, CalendarPlus, FileSpreadsheet, X } from "lucide-react";

const LOCAL = isLocalWorkspace();
const localRepo = LOCAL ? createLocalRepo() : null;

const readFileText = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });

export default function ICSFeedDialog({ open, onClose, data, onImported }) {
  const { toast } = useToast();
  const [url, setUrl] = useState("");
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState(null);
  const [source, setSource] = useState("");
  const [importing, setImporting] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [removeUrl, setRemoveUrl] = useState(null);
  const [feeds, setFeeds] = useState(loadFeeds);

  const existing = data?.ScheduleEvent || [];

  const preview = useMemo(() => {
    if (!parsed?.events?.length) return null;
    const expanded = expandForImport(parsed.events);
    const { rows, skippedAllDay } = toScheduleEventRows(expanded, source);
    const { toCreate, skipped } = diffICS(existing, rows);
    return { rows: toCreate, already: skipped, skippedAllDay };
  }, [parsed, source, existing]);

  const reset = () => {
    setUrl("");
    setFileName("");
    setParsed(null);
    setSource("");
    setImporting(false);
    setFetching(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const handleFetchUrl = async () => {
    const clean = url.trim();
    if (!clean) return;
    setFetching(true);
    try {
      const result = await fetchICSFeed(clean);
      setParsed({ events: result.events, warnings: result.warnings });
      setSource(clean);
    } catch (err) {
      toast({ title: "Couldn't fetch that feed", description: err.message || "Check the URL and try again." });
    } finally {
      setFetching(false);
    }
  };

  const handleUpload = async (file) => {
    if (!/\.ics$/i.test(file.name)) {
      toast({ title: "Not an .ics file", description: "Export your calendar (.ics) from Google Calendar or Apple Calendar first." });
      return;
    }
    try {
      const text = await readFileText(file);
      const result = parseICS(text);
      setParsed({ events: result.events, warnings: result.warnings });
      setSource(`file://${file.name}`);
      setFileName(file.name);
    } catch {
      toast({ title: "Couldn't read that file" });
    }
  };

  const handleImport = async () => {
    if (!preview || !preview.rows.length || importing) return;
    setImporting(true);
    try {
      if (LOCAL) {
        for (const row of preview.rows) localRepo.create("schedule_events", row);
      } else {
        const { error } = await supabase.from("schedule_events").insert(preview.rows);
        if (error) throw error;
      }
      if (source.startsWith("http")) {
        const next = storeAddFeed(source, feedName(source));
        setFeeds(next);
      }
      toast({ title: `Imported ${preview.rows.length} calendar events${preview.already ? ` · ${preview.already} already on schedule` : ""}${preview.skippedAllDay ? ` · ${preview.skippedAllDay} all-day skipped` : ""}.` });
      onImported?.();
      close();
    } catch (err) {
      toast({ title: "Import failed", description: err.message || "Something went wrong." });
    } finally {
      setImporting(false);
    }
  };

  const handleRemoveFeed = async (feed) => {
    setRemoveUrl(feed.url);
    try {
      if (LOCAL) {
        localRepo.deleteWhere("schedule_events", (r) => String(r.google_event_id || "").startsWith(`ics:${feed.url}`));
      } else {
        const { error } = await supabase.from("schedule_events").delete().like("google_event_id", `ics:${feed.url}%`);
        if (error) throw error;
      }
      const next = storeRemoveFeed(feed.url);
      setFeeds(next);
      toast({ title: `Removed "${feed.name}" and its imported events.` });
      onImported?.();
    } catch {
      toast({ title: "Couldn't remove that feed" });
    } finally {
      setRemoveUrl(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold">ICS · Calendar feed</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Pull live external events (Google · Apple · LMS) straight onto the HUD timeline.</p>
          </div>
          <button onClick={close} aria-label="Close" className="p-1.5 rounded-lg hover:bg-muted"><X className="w-4 h-4" /></button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground" htmlFor="feed-url">Feed URL</label>
            <div className="flex gap-2">
              <Input id="feed-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://calendar.google.com/.../basic.ics" className="h-9 text-sm" />
              <Button size="sm" onClick={handleFetchUrl} disabled={fetching || !url.trim()}>
                <RefreshCw className={`w-3.5 h-3.5 ${fetching ? "animate-spin" : ""}`} /> <Link2 className="w-3.5 h-3.5 ml-1 hidden" /> Fetch
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">or upload a file</label>
            <label className="flex items-center justify-center gap-2 h-9 rounded-lg border border-dashed border-border text-sm text-muted-foreground cursor-pointer hover:border-accent/60 hover:text-foreground transition-colors">
              <Upload className="w-3.5 h-3.5" /> {fileName || "Choose .ics file…"}
              <input type="file" accept=".ics,text/calendar" className="hidden" onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} />
            </label>
          </div>
        </div>

        {parsed && (
          <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-hud-cyan" /> {parsed.events.length} events found
              </div>
              {parsed.warnings.length > 0 && <span className="text-xs text-muted-foreground">{parsed.warnings.length} entries skipped</span>}
            </div>
            {preview && preview.rows.length > 0 && (
              <ul className="text-xs space-y-1 max-h-40 overflow-y-auto">
                {preview.rows.slice(0, 12).map((r) => (
                  <li key={r.google_event_id} className="flex items-center gap-2 justify-between">
                    <span className="truncate">{r.title}</span>
                    <span className="text-muted-foreground shrink-0">{r.date} · {r.start_time}</span>
                  </li>
                ))}
                {preview.rows.length > 12 && <li className="text-muted-foreground">+{preview.rows.length - 12} more…</li>}
              </ul>
            )}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs text-muted-foreground">
                {preview.already > 0 && `${preview.already} already on schedule · `}
                {preview.skippedAllDay > 0 && `${preview.skippedAllDay} all-day skipped · `}
                {preview.rows.length} ready to import
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setParsed(null)}>Clear</Button>
                <Button size="sm" onClick={handleImport} disabled={!preview.rows.length || importing}>
                  <CalendarPlus className="w-3.5 h-3.5" /> {importing ? "Importing…" : `Import ${preview.rows.length}`}
                </Button>
              </div>
            </div>
          </div>
        )}

        {feeds.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground uppercase tracking-wider">Subscribed feeds (auto-refresh on load)</div>
            {feeds.map((f) => (
              <div key={f.url} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Link2 className="w-3.5 h-3.5 text-hud-cyan shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm truncate">{f.name}</div>
                    <div className="text-[10px] text-muted-foreground truncate">{f.url}</div>
                  </div>
                </div>
                <Button size="sm" variant="ghost" className="shrink-0" onClick={() => handleRemoveFeed(f)} disabled={removeUrl === f.url}>
                  <Trash2 className="w-3.5 h-3.5" /> Remove
                </Button>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}