import { useState, useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { useUserData } from "@/lib/useUserData";
import { useSoundscape, SOUNDSCAPE_MODES } from "@/hooks/use-soundscape";
import PageHeader from "@/components/PageHeader";
import { fmtDuration, courseColor } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Play, Pause, Square, Headphones } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useI18n } from "@/lib/i18n";
import ErrorState from "@/components/ErrorState";

const MODES = {
  "25_5": { focus: 25, break: 5, label: "25 / 5" },
  "50_10": { focus: 50, break: 10, label: "50 / 10" },
  custom: { focus: 45, break: 10, label: "Custom" },
};

export default function Focus() {
  const { data, error, mutate, refresh } = useUserData();
  const { toast } = useToast();
  const { t } = useI18n();
  const location = useLocation();
  const { mode: soundMode, playing: soundPlaying, levels, start: setSound } = useSoundscape();
  const [mode, setMode] = useState("25_5");
  const [phase, setPhase] = useState("idle"); // idle | focus | paused | break | done
  const [secondsLeft, setSecondsLeft] = useState(MODES["25_5"].focus * 60);
  const [elapsed, setElapsed] = useState(0); // focus seconds only
  const [courseId, setCourseId] = useState("none");
  const [taskId, setTaskId] = useState("none");
  const [label, setLabel] = useState("");

  const autostart = useMemo(() => {
    const s = location.state;
    return !!(s && typeof s === "object" && s.autostart === true);
  }, [location.state]);

  useEffect(() => {
    if (autostart && phase === "idle") start();
  }, [autostart, phase]);

  const courses = data?.Course || [];
  const tasks = useMemo(() => (data?.Task || []).filter((t) => t.status !== "completed"), [data]);

  const saveSession = async (minutes) => {
    if (minutes <= 0) return;
    try {
      await mutate("FocusSession", "create", {
        course_id: courseId === "none" ? null : courseId,
        task_id: taskId === "none" ? null : taskId,
        duration: minutes,
        date: new Date().toISOString().slice(0, 10),
        completed: true,
        mode,
        label,
      });
      toast({ title: `Session saved — ${fmtDuration(minutes)}` });
    } catch {
      toast({ title: "Couldn't save the session. Try again." });
    }
  };

  // Tick only while a phase is actually running (paused stops the clock)
  useEffect(() => {
    if (phase !== "focus" && phase !== "break") return;
    const iv = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
      if (phase === "focus") setElapsed((e) => e + 1);
    }, 1000);
    return () => clearInterval(iv);
  }, [phase]);

  // Phase transitions when the countdown reaches zero
  useEffect(() => {
    if (secondsLeft > 0) return;
    if (phase === "focus") {
      // A naturally completed focus block counts — no manual stop needed
      const minutes = Math.round(elapsed / 60);
      if (minutes > 0) saveSession(minutes);
      toast({ title: "Focus complete — take a break." });
      setElapsed(0);
      setPhase("break");
      setSecondsLeft(MODES[mode].break * 60);
    } else if (phase === "break") {
      setPhase("done");
    }
  }, [secondsLeft, phase]);

  // Ambient soundscape rides along as soon as a focus block starts.
  useEffect(() => {
    if (phase === "focus" && soundMode !== "none" && !soundPlaying) setSound(soundMode);
  }, [phase, soundMode, soundPlaying, setSound]);

  const start = () => {
    setPhase("focus");
    setSecondsLeft(MODES[mode].focus * 60);
    setElapsed(0);
  };

  const pause = () => setPhase("paused");
  const resume = () => setPhase("focus");

  const stop = async () => {
    const minutes = Math.round(elapsed / 60);
    if (minutes > 0) await saveSession(minutes);
    setPhase("idle");
    setElapsed(0);
    setSecondsLeft(MODES[mode].focus * 60);
  };

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");
  const progress = phase === "focus" ? (MODES[mode].focus * 60 - secondsLeft) / (MODES[mode].focus * 60) : 1;
  const course = courses.find((c) => c.id === courseId);
  const cc = course ? courseColor(course.color) : null;

  const todayFocus = (data?.FocusSession || [])
    .filter((s) => s.date === new Date().toISOString().slice(0, 10))
    .reduce((sum, s) => sum + s.duration, 0);

  if (error) return <ErrorState onRetry={refresh} />;

  return (
    <>
      <PageHeader title={t("title.focus")} subtitle={t("title.focus.subtitle")} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className={`lg:col-span-2 p-8 flex flex-col items-center justify-center min-h-[420px] relative overflow-hidden ${phase === "focus" ? "glow-active" : "glow-hover"}`}>
          <div className={`absolute inset-0 opacity-10 ${cc ? cc.soft : "bg-primary/10"}`} />
          <div className="absolute inset-0 cyber-scanlines opacity-20" />
          <div className="relative">
            <div className="text-center">
              {phase === "focus" && (
                <div className="flex items-center justify-center gap-1.5 mb-3">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shadow-[0_0_10px_rgba(244,63,94,0.9)]" />
                  <span className="hud-mono text-hud-rose">rec</span>
                </div>
              )}
              <div className={`um-label mb-3 ${phase === "focus" ? "text-hud-cyan" : ""}`}>{phase === "break" ? "Break" : phase === "done" ? "Session complete" : phase === "paused" ? "Paused" : phase === "focus" ? "Focusing" : "Ready"}</div>
              <div className={`font-display text-7xl sm:text-8xl font-semibold tabular-nums tracking-tight ${phase === "focus" ? "drop-shadow-[0_0_24px_rgba(34,211,238,0.35)]" : ""}`}>{mm}:{ss}</div>
              {course && <div className="mt-3 text-sm text-muted-foreground">{course.name}</div>}
              {label && <div className="text-xs text-muted-foreground">{label}</div>}
              {soundPlaying && (
                <div className="flex items-end justify-center gap-[3px] h-8 mt-5" aria-hidden="true">
                  {levels.slice(0, 12).map((lv, i) => (
                    <div
                      key={i}
                      className="w-1 rounded-t bg-gradient-to-t from-hud-cyan/40 to-hud-violet transition-[height] duration-100 ease-linear"
                      style={{ height: `${Math.max(4, Math.min(100, lv))}%` }}
                    />
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center justify-center gap-3 mt-8">
              {phase === "idle" || phase === "done" ? (
                <Button size="lg" onClick={start} className="rounded-full px-8"><Play className="w-5 h-5 mr-2" />Start</Button>
              ) : phase === "paused" ? (
                <Button size="lg" onClick={resume} className="rounded-full px-8"><Play className="w-5 h-5 mr-2" />Resume</Button>
              ) : (
                <Button size="lg" variant="outline" onClick={pause} className="rounded-full px-8"><Pause className="w-5 h-5 mr-2" />Pause</Button>
              )}
              {phase !== "idle" && phase !== "done" && (
                <Button size="lg" variant="ghost" onClick={stop} className="rounded-full"><Square className="w-5 h-5 mr-2" />End</Button>
              )}
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <h2 className="um-label mb-3">Session</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">Mode</label>
                <Select value={mode} onValueChange={(v) => { setMode(v); setSecondsLeft(MODES[v].focus * 60); }} disabled={phase !== "idle" && phase !== "done"}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(MODES).map(([k, m]) => <SelectItem key={k} value={k}>{m.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Course</label>
                <Select value={courseId} onValueChange={setCourseId} disabled={phase !== "idle" && phase !== "done"}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent><SelectItem value="none">—</SelectItem>{courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground" htmlFor="focus-task">Task</label>
                <Select value={taskId} onValueChange={setTaskId} disabled={phase !== "idle" && phase !== "done"}>
                  <SelectTrigger id="focus-task" className="mt-1"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent><SelectItem value="none">—</SelectItem>{tasks.map((t) => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground" htmlFor="focus-label">Label</label>
                <input
                  id="focus-label"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="What are you working on?"
                  disabled={phase !== "idle" && phase !== "done"}
                  className="mt-1 w-full h-9 px-3 rounded-md border border-input bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
                />
              </div>
            </div>
          </Card>
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Headphones className="w-4 h-4 text-hud-cyan" />
              <h2 className="um-label">Ambient soundscape</h2>
              {soundPlaying && (
                <span className="chip ml-auto text-hud-cyan border-hud-cyan/30 bg-hud-cyan/10">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" /> live
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {SOUNDSCAPE_MODES.map((m) => (
                <button
                  key={m.key}
                  onClick={() => setSound(m.key)}
                  className={`px-2 py-1.5 rounded-md border text-left transition-all ${soundMode === m.key && m.key !== "none" ? "border-accent/50 bg-accent/10 text-hud-cyan glow-cyan" : soundMode === m.key ? "border-border bg-muted/40 text-muted-foreground" : "border-border/60 text-muted-foreground hover:border-accent/30"}`}
                >
                  <div className="text-xs font-medium leading-tight">{m.label}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{m.hint}</div>
                </button>
              ))}
            </div>
            <div className="mt-4">
              <div className={`flex items-end gap-[3px] h-10 ${soundPlaying ? "opacity-100" : "opacity-30"}`} aria-hidden="true">
                {levels.map((lv, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-t bg-gradient-to-t from-hud-cyan/30 to-hud-cyan transition-[height] duration-100 ease-linear"
                    style={{ height: `${Math.max(4, Math.min(100, lv))}%` }}
                  />
                ))}
              </div>
              <div className="flex items-center justify-between mt-1.5">
                <span className="hud-mono text-muted-foreground/70">eq visualizer</span>
                <span className="text-[10px] text-muted-foreground">{soundPlaying ? "live analyser feed" : "starts with your focus block"}</span>
              </div>
            </div>
          </Card>
          <Card className="p-5">
            <div className="um-label mb-2">Today</div>
            <div className="font-display text-2xl font-semibold">{fmtDuration(todayFocus)}</div>
            <p className="text-xs text-muted-foreground mt-1">Total focus time today.</p>
          </Card>
        </div>
      </div>
    </>
  );
}