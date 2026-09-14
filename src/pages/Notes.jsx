import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useUserData } from "@/lib/useUserData";
import { useDeskMode } from "@/hooks/use-desk-mode";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { courseColor } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { FileText, Plus, Pin, Search } from "lucide-react";
import QuickAdd from "@/components/QuickAdd";
import { useI18n } from "@/lib/i18n";

export default function Notes() {
  const { data, loading } = useUserData();
  const { chaos } = useDeskMode();
  const { t } = useI18n();
  const [qaOpen, setQaOpen] = useState(false);
  const [q, setQ] = useState("");

  const notes = useMemo(() => {
    if (!data) return [];
    let list = data.Note.filter((n) => !n.archived);
    if (q.trim()) {
      const nq = q.toLowerCase();
      list = list.filter((n) => n.title.toLowerCase().includes(nq) || (n.content || "").toLowerCase().includes(nq));
    }
    return list.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (b.updated_date || "").localeCompare(a.updated_date || ""));
  }, [data, q]);

  const courses = data?.Course || [];

  if (!loading && data && data.Note.length === 0) {
    return (
      <>
        <PageHeader title={t("title.notes")} subtitle={t("title.notes.subtitle")} />
        <EmptyState icon={FileText} title="No notes yet" description="Capture lecture notes, summaries, and ideas — link them to courses and exams." actionLabel="Add Note" onAction={() => setQaOpen(true)} />
        <QuickAdd open={qaOpen} onClose={() => setQaOpen(false)} />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Notes" subtitle="A first-class place for everything you write down.">
        <button onClick={() => setQaOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
          <Plus className="w-4 h-4" /> Add Note
        </button>
      </PageHeader>

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search notes…" className="w-full pl-9 pr-3 py-2 rounded-lg bg-card border border-border text-sm focus:outline-none focus:border-primary/40" />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => <div key={i} className="h-32 bg-muted rounded-xl animate-pulse" />)}
        </div>
      ) : notes.length === 0 ? (
        <EmptyState title="No notes match" description="Try a different search." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {notes.map((n, i) => {
            const course = courses.find((c) => c.id === n.course_id);
            const cc = course ? courseColor(course.color) : null;
            return (
              <Link key={n.id} to={`/notes/${n.id}`}>
                <Card className={`p-4 h-full glow-hover transition-transform duration-300 ${chaos ? (i % 2 === 0 ? "rotate-1" : "-rotate-1") : "rotate-0"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-medium text-sm leading-tight">{n.title}</h3>
                    {n.pinned && <Pin className="w-3.5 h-3.5 text-cyan-400 shrink-0 drop-shadow-[0_0_6px_rgba(34,211,238,0.8)]" />}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-3">{(n.content || "").replace(/[#*>]/g, "").slice(0, 140)}</p>
                  {course && (
                    <div className="mt-3 chip border-border/70 bg-muted/40 text-muted-foreground">
                      <span className={`w-1.5 h-1.5 rounded-full ${cc.dot}`} />
                      {course.name}
                    </div>
                  )}
                </Card>
              </Link>
            );
          })}
        </div>
      )}
      <QuickAdd open={qaOpen} onClose={() => setQaOpen(false)} />
    </>
  );
}