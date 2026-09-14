import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, ArrowRight, CheckSquare, FilePlus, Timer, CornerDownLeft } from "lucide-react";
import { useUserData } from "@/lib/useUserData";
import { useToast } from "@/components/ui/use-toast";
import { todayISO } from "@/lib/format";
import { norm, filterCommandPalette, isPaletteShortcut } from "@/lib/paletteSearch";

const COMMANDS = [
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

const ACTIONS = [
  { label: "Quick Add Task", sub: "capture a task instantly", icon: CheckSquare, action: "task", type: "Action" },
  { label: "New Note", sub: "a fresh page for a raw thought", icon: FilePlus, action: "note", type: "Action" },
  { label: "Start Focus Session", sub: "deep-work timer, armed", icon: Timer, action: "focus", type: "Action" },
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
    const nq = norm(q).trim();
    const dataRows = [];
    if (data && nq) {
      const push = (items, type, label, sub, to) => {
        items.forEach((x) => dataRows.push({ type, label: label(x), sub: sub ? sub(x) : "", to: to(x) }));
      };
      push(data.Course || [], "Course", (c) => c.name, (c) => c.code, (c) => `/courses/${c.id}`);
      push(data.Task || [], "Task", (t) => t.title, (t) => t.due_date, () => "/tasks");
      push(data.Note || [], "Note", (n) => n.title, null, (n) => `/notes/${n.id}`);
      push(data.Exam || [], "Exam", (e) => e.name, (e) => e.date, (e) => `/exams/${e.id}`);
      push(data.Resource || [], "Resource", (r) => r.name, (r) => r.type, () => "/resources");
    }
    return filterCommandPalette({ query: q, actions: ACTIONS, commands: COMMANDS, dataRows });
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

  const onKey = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSel((s) => Math.min(s + 1, all.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSel((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = all[sel];
      if (!item) return;
      if (item.action) {
        setCapture(item);
        setCaptureVal("");
        setTimeout(() => captureRef.current?.focus(), 30);
      } else {
        navigate(item.to);
        close();
      }
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
                className="border-0 focus-visible:ring-0 h-14 text-base"
              />
              <span className="hud-mono text-muted-foreground/70 hidden sm:inline-flex">⌘K</span>
            </div>
            <div className="max-h-80 overflow-y-auto p-2">
              {all.length === 0 && <div className="px-3 py-8 text-center text-sm text-muted-foreground">No results for "{q}"</div>}
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
                      onClick={() => {
                        if (item.action) {
                          setCapture(item);
                          setCaptureVal("");
                          setTimeout(() => captureRef.current?.focus(), 30);
                        } else {
                          navigate(item.to);
                          close();
                        }
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${i === sel ? "bg-accent/10 ring-1 ring-accent/30" : "hover:bg-muted"}`}
                    >
                      {item.icon && <item.icon className="w-4 h-4 text-cyan-400 shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{item.label}</div>
                        {item.sub && <div className="text-xs text-muted-foreground truncate">{item.sub}</div>}
                      </div>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{item.type || item.group}</span>
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
    </Dialog>
  );
}