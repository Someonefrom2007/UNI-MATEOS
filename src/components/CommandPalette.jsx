import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Search, ArrowRight, CheckSquare, FilePlus, Timer, CornerDownLeft,
  BookOpen, GraduationCap, CalendarDays, Link2,
} from "lucide-react";
import { useUserData } from "@/lib/useUserData";
import { useToast } from "@/components/ui/use-toast";
import { todayISO } from "@/lib/format";
import { filterCommandPalette, isPaletteShortcut } from "@/lib/paletteSearch";
import { buildSearchRows, capPerType } from "@/lib/searchIndex";
import QuickAdd from "@/components/QuickAdd";

const COMMANDS = [
  { label: "Go to Attention", to: "/notifications", type: "Go to" },
  { label: "Go to Dashboard", to: "/dashboard", type: "Go to" },
  { label: "Go to Community", to: "/community", type: "Go to" },
  { label: "Go to Courses", to: "/courses", type: "Go to" },
  { label: "Go to Schedule", to: "/schedule", type: "Go to" },
  { label: "Go to Tasks", to: "/tasks", type: "Go to" },
  { label: "Go to Exams", to: "/exams", type: "Go to" },
  { label: "Go to Grades", to: "/grades", type: "Go to" },
  { label: "Go to Notes", to: "/notes", type: "Go to" },
  { label: "Go to Focus", to: "/focus", type: "Go to" },
  { label: "Go to Goals", to: "/goals", type: "Go to" },
  { label: "Go to Habits", to: "/habits", type: "Go to" },
  { label: "Go to Workload", to: "/workload", type: "Go to" },
  { label: "Go to Insights", to: "/insights", type: "Go to" },
  { label: "Go to AI Assistant", to: "/ai", type: "Go to" },
  { label: "Go to Profile", to: "/profile", type: "Go to" },
  { label: "Go to Settings", to: "/settings", type: "Go to" },
];

// Inline captures are for the two things worth typing in one line. Everything
// else opens the full quick-add sheet, because a course or an exam has fields
// that a single input cannot honestly collect.
const ACTIONS = [
  { label: "Quick Add Task", sub: "capture a task instantly", icon: CheckSquare, action: "task", type: "Action" },
  { label: "New Note", sub: "a fresh page for a raw thought", icon: FilePlus, action: "note", type: "Action" },
  { label: "Start Focus Session", sub: "deep-work timer, armed", icon: Timer, action: "focus", type: "Action" },
  { label: "New Course", sub: "add a course to this semester", icon: BookOpen, sheet: "course", type: "Action" },
  { label: "New Exam", sub: "schedule an assessment", icon: GraduationCap, sheet: "exam", type: "Action" },
  { label: "New Event", sub: "block time in your schedule", icon: CalendarDays, sheet: "event", type: "Action" },
  { label: "New Resource", sub: "save a link or document", icon: Link2, sheet: "resource", type: "Action" },
];

const HEADERS = {
  action: "RAPID ACTIONS",
  nav: "NAVIGATE",
  data: "OPEN",
};

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const [capture, setCapture] = useState(null);
  const [captureVal, setCaptureVal] = useState("");
  const [busy, setBusy] = useState(false);
  const [sheetType, setSheetType] = useState(null);
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const captureRef = useRef(null);
  const { data, loading, mutate } = useUserData();
  const { toast } = useToast();

  const close = useCallback(() => {
    setOpen(false);
    setCapture(null);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (isPaletteShortcut(e)) {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    const onExternal = () => setOpen((v) => !v);
    window.addEventListener("keydown", onKey);
    window.addEventListener("unimate:palette", onExternal);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("unimate:palette", onExternal);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQ("");
      setSel(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setCapture(null);
      setBusy(false);
    }
  }, [open]);

  const all = useMemo(() => {
    if (!open) return [];
    // Score first, then cap: an entity with many rows must contribute its best
    // matches, not merely its first ones.
    const dataRows = data ? buildSearchRows(data, { query: q }) : [];
    const ranked = filterCommandPalette({ query: q, actions: ACTIONS, commands: COMMANDS, dataRows });
    return capPerType(ranked);
  }, [open, q, data]);

  useEffect(() => {
    setSel(0);
  }, [q, all.length, open]);

  const runCapture = async () => {
    if (busy) return;
    if (capture?.action !== "focus" && !captureVal.trim()) return;
    setBusy(true);
    try {
      if (capture.action === "task") {
        await mutate("Task", "create", {
          title: captureVal.trim(),
          status: "todo",
          priority: "medium",
          due_date: todayISO(),
          estimated_duration: 0,
        });
        toast({ title: "Task added" });
        close();
        navigate("/tasks");
      } else if (capture.action === "note") {
        const row = await mutate("Note", "create", { title: captureVal.trim(), content: "", pinned: false, archived: false });
        toast({ title: "Note created" });
        close();
        navigate(row?.id ? `/notes/${row.id}` : "/notes");
      } else if (capture.action === "focus") {
        close();
        navigate("/focus", { state: { autostart: true } });
      }
    } catch {
      toast({ title: "Couldn't create it. Try again." });
    } finally {
      setBusy(false);
    }
  };

  const runItem = (item) => {
    if (!item) return;
    if (item.sheet) {
      // The sheet has its own fields; the palette closes behind it.
      setSheetType(item.sheet);
      close();
      return;
    }
    if (item.action) {
      setCapture(item);
      setCaptureVal("");
      setTimeout(() => captureRef.current?.focus(), 30);
      return;
    }
    navigate(item.to);
    close();
  };

  const onKey = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSel((s) => Math.min(s + 1, all.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSel((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      runItem(all[sel]);
    }
  };

  const captureKey = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      runCapture();
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      setCapture(null);
    }
  };

  let lastGroup = null;
  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent className="sm:max-w-xl p-0 gap-0 overflow-hidden glow-active">
        {capture ? (
          <div className="space-y-4 p-5">
            <div className="cyber-tag">{capture.label}</div>
            <Input
              ref={captureRef}
              autoFocus
              value={captureVal}
              onChange={(e) => setCaptureVal(e.target.value)}
              onKeyDown={captureKey}
              placeholder={capture.action === "task" ? "What needs doing?" : capture.action === "note" ? "Title the note…" : ""}
              aria-label={capture.action === "task" ? "New task" : capture.action === "note" ? "Note title" : "Capture input"}
              className="h-12 text-base"
            />
            {capture.action === "focus" && (
              <p className="text-sm text-muted-foreground -mt-2">Press enter to arm the focus timer in deep-work mode.</p>
            )}
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                <CornerDownLeft className="w-3.5 h-3.5" /> enter to confirm · esc to cancel
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setCapture(null)}>Cancel</Button>
                <Button size="sm" disabled={busy} onClick={runCapture}>{busy ? "Saving…" : "Create"}</Button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 px-4 border-b border-border">
              <Search className="w-4 h-4 text-muted-foreground" />
              <Input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onKey}
                placeholder={loading ? "Loading your data…" : "Search courses, tasks, notes… or type a command"}
                aria-label="Search courses, tasks and notes"
                className="border-0 focus-visible:ring-0 h-14 text-base"
              />
              <span className="hud-mono text-muted-foreground/70 hidden sm:inline-flex">⌘K</span>
            </div>
            <div className="max-h-80 overflow-y-auto p-2">
              {all.length === 0 && <div aria-live="polite" className="px-3 py-8 text-center text-sm text-muted-foreground">No results for "{q}"</div>}
              {all.map((item, i) => {
                const showHeader = item.group !== lastGroup;
                lastGroup = item.group;
                return (
                  <div key={`${item.group}-${item.label}`}>
                    {showHeader && (
                      <div className="hud-mono px-3 pt-2 pb-1 text-muted-foreground/60">{HEADERS[item.group] || item.group}</div>
                    )}
                    <button
                      onMouseEnter={() => setSel(i)}
                      onClick={() => runItem(item)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${i === sel ? "bg-accent/10 ring-1 ring-accent/30" : "hover:bg-muted"}`}
                    >
                      {item.icon && <item.icon className="w-4 h-4 text-hud-cyan shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{item.label}</div>
                        {item.sub && <div className="text-xs text-muted-foreground truncate">{item.sub}</div>}
                      </div>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">{item.typeLabel || item.type || item.group}</span>
                      <ArrowRight className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-4 px-4 py-2 border-t border-border text-[10px] font-mono uppercase tracking-wider text-muted-foreground/70">
              <span>↑↓ navigate</span><span>↵ select</span><span>esc close</span>
            </div>
          </>
        )}
      </DialogContent>
      <QuickAdd
        open={Boolean(sheetType)}
        preset={sheetType ? { typeKey: sheetType } : null}
        onClose={() => setSheetType(null)}
      />
    </Dialog>
  );
}