import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import EmptyState from "@/components/EmptyState";
import ConfirmDialog from "@/components/ConfirmDialog";
import AttendanceEditor from "@/components/AttendanceEditor";
import { useToast } from "@/components/ui/use-toast";
import { CalendarCheck, Plus, Pencil, Trash2, AlertTriangle, CheckCircle2 } from "lucide-react";
import {
  summarizeCourse,
  sortAttendance,
  ATTENDANCE_META,
  requiredRate,
} from "@/lib/attendance";

const TONE = {
  emerald: "bg-emerald-500/10 text-hud-emerald border-emerald-500/30",
  amber: "bg-amber-500/10 text-hud-amber border-amber-500/30",
  rose: "bg-rose-500/10 text-hud-rose border-rose-500/30",
  cyan: "bg-cyan-500/10 text-hud-cyan border-cyan-500/30",
};

// Attendance panel for a single course workspace. Reads the `attendance` rows
// the data layer already loads and writes through the same mutate surface as
// every other module, so local and hosted modes stay identical.
export default function AttendancePanel({ course, rows = [], mutate }) {
  const [editing, setEditing] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  const summary = useMemo(() => summarizeCourse(course, rows), [course, rows]);
  const log = useMemo(() => sortAttendance(rows), [rows]);

  const save = async (patch) => {
    if (editing?.id) {
      await mutate("Attendance", "update", editing.id, patch);
      toast({ title: "Session updated" });
    } else {
      await mutate("Attendance", "create", patch);
      toast({ title: "Session logged" });
    }
  };

  const remove = async () => {
    if (!toDelete) return;
    setBusy(true);
    try {
      await mutate("Attendance", "delete", toDelete.id);
      toast({ title: "Session removed" });
      setToDelete(null);
    } catch {
      toast({ title: "Couldn't remove the session. Please try again." });
    } finally {
      setBusy(false);
    }
  };

  const target = requiredRate(course);

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="um-label">Attendance</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Measured against this course's own requirement of {target}%.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setEditing({ course_id: course.id })}>
            <Plus className="w-3.5 h-3.5 mr-1.5" />Log session
          </Button>
        </div>

        {summary.rate === null ? (
          <p className="text-sm text-muted-foreground mt-4">
            Nothing logged yet. Add a session to start tracking your attendance.
          </p>
        ) : (
          <>
            <div className="flex items-end gap-3 mt-4">
              <span className={`text-4xl font-display font-medium tabular-nums ${summary.status === "below" ? "text-hud-rose" : "text-hud-emerald"}`}>
                {summary.rate.toFixed(1)}%
              </span>
              <span className="pb-1 text-xs text-muted-foreground">
                {summary.counts.present + summary.counts.late} of {summary.counts.present + summary.counts.late + summary.counts.absent} judged sessions
              </span>
            </div>

            {/* A plain bar, because the comparison to the requirement is the point. */}
            <div className="relative mt-3 h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full ${summary.status === "below" ? "bg-rose-500" : "bg-emerald-500"}`}
                style={{ width: `${Math.min(100, summary.rate)}%` }}
              />
            </div>
            <div className="relative h-4">
              <span className="absolute -top-0.5 text-[10px] text-muted-foreground" style={{ left: `${Math.min(96, target)}%` }}>
                {target}%
              </span>
            </div>

            <div className="mt-2 text-sm">
              {summary.status === "below" ? (
                summary.stillPossible ? (
                  <p className="flex items-start gap-2 text-hud-rose">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>
                      Below your requirement. Attend the next {summary.sessionsNeeded} session{summary.sessionsNeeded === 1 ? "" : "s"} in a row to get back above {target}%.
                    </span>
                  </p>
                ) : (
                  <p className="flex items-start gap-2 text-hud-rose">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>A {target}% requirement can no longer be reached from this record.</span>
                  </p>
                )
              ) : (
                <p className="flex items-start gap-2 text-hud-emerald">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>
                    {summary.absencesLeft > 0
                      ? `Above your requirement — you can miss ${summary.absencesLeft} more judged session${summary.absencesLeft === 1 ? "" : "s"} and still meet it.`
                      : "Meeting your requirement, with no room left to miss another session."}
                  </span>
                </p>
              )}
            </div>

            <div className="grid grid-cols-4 gap-2 mt-4 pt-4 border-t border-border">
              {["present", "late", "absent", "excused"].map((s) => (
                <div key={s} className="text-center">
                  <div className="text-lg font-medium tabular-nums">{summary.counts[s]}</div>
                  <div className={`text-[10px] ${s === "present" ? "text-hud-emerald" : s === "late" ? "text-hud-amber" : s === "absent" ? "text-hud-rose" : "text-hud-cyan"}`}>
                    {ATTENDANCE_META[s].label}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      {log.length === 0 ? (
        <EmptyState
          icon={CalendarCheck}
          title="No sessions logged"
          description="Log each class as present, late, absent or excused to see your attendance rate."
          actionLabel="Log session"
          onAction={() => setEditing({ course_id: course.id })}
        />
      ) : (
        <div className="space-y-2">
          {log.map((r) => {
            const meta = ATTENDANCE_META[r.status] || ATTENDANCE_META.present;
            return (
              <Card key={r.id} className="p-3 flex items-center gap-3 group">
                <span className={`text-[10px] px-2 py-0.5 rounded border shrink-0 ${TONE[meta.tone]}`}>{meta.label}</span>
                <span className="text-sm flex-1 min-w-0 tabular-nums">{r.date}</span>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                  <button onClick={() => setEditing(r)} className="p-1.5 rounded hover:bg-muted" aria-label={`Edit session on ${r.date}`}>
                    <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                  <button onClick={() => setToDelete(r)} className="p-1.5 rounded hover:bg-muted" aria-label={`Delete session on ${r.date}`}>
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <AttendanceEditor
        open={editing !== null}
        record={editing?.id ? editing : null}
        courses={[course]}
        onSave={save}
        onClose={() => setEditing(null)}
      />

      <ConfirmDialog
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        title="Remove this session?"
        description="It stops counting toward this course's attendance rate."
        confirmLabel="Remove session"
        busy={busy}
        onConfirm={remove}
      />
    </div>
  );
}