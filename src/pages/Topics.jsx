import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useUserData } from "@/lib/useUserData";
import { courseColor } from "@/lib/format";
import { topicStats } from "@/lib/topicStats";
import { Card } from "@/components/ui/card";
import { ArrowUpRight, Check, Layers, Pencil, Plus, Search, Trash2 } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import ErrorState from "@/components/ErrorState";
import QuickAdd from "@/components/QuickAdd";

export default function Topics() {
  const { data, loading, error, mutate, refresh } = useUserData();
  const [qaOpen, setQaOpen] = useState(false);
  const [q, setQ] = useState("");

  const topics = useMemo(() => data?.Topic || [], [data]);
  const courses = useMemo(() => data?.Course || [], [data]);

  const groups = useMemo(() => {
    const nq = q.trim().toLowerCase();
    const list = nq ? topics.filter((t) => (t.name || "").toLowerCase().includes(nq)) : topics;
    const map = new Map();
    for (const t of list) {
      const key = t.course_id || "general";
      if (!map.has(key)) map.set(key, { course_id: t.course_id, items: [] });
      map.get(key).items.push(t);
    }
    return [...map.values()].map((g) => ({
      ...g,
      course: courses.find((c) => c.id === g.course_id) || null,
    }));
  }, [topics, courses, q]);

  const toggleReview = async (t) => {
    await mutate("Topic", "update", t.id, { reviewed: !t.reviewed });
  };

  const setMastery = async (t, val) => {
    await mutate("Topic", "update", t.id, { mastery: val, reviewed: val >= 80 });
  };

  const rename = async (t) => {
    const name = prompt("Topic name", t.name);
    if (!name || name === t.name) return;
    await mutate("Topic", "update", t.id, { name });
  };

  const remove = async (t) => {
    if (!confirm(`Delete topic "${t.name}"?`)) return;
    await mutate("Topic", "delete", t.id);
  };

  if (error) return <ErrorState onRetry={refresh} />;

  if (!loading && data && topics.length === 0) {
    return (
      <>
        <PageHeader title="Topics" subtitle="The building blocks of each course — track how well you really know them." />
        <EmptyState icon={Layers} title="No topics yet" description="Topics are the concepts behind your courses. Track mastery here and stay honest about preparation." actionLabel="Add Topic" onAction={() => setQaOpen(true)} />
        <QuickAdd open={qaOpen} onClose={() => setQaOpen(false)} />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Topics" subtitle="Master the concepts behind your courses, one topic at a time.">
        <button onClick={() => setQaOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
          <Plus className="w-4 h-4" /> Add Topic
        </button>
      </PageHeader>

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search topics" placeholder="Search topics…" className="w-full pl-9 pr-3 py-2 rounded-lg bg-card border border-border text-sm focus:outline-none focus:border-primary/40" />
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-32 bg-muted rounded-xl animate-pulse" />)}
        </div>
      ) : groups.length === 0 ? (
        <EmptyState title="No topics match" description="Try a different search." />
      ) : (
        <div className="space-y-4">
          {groups.map((g) => {
            const stats = topicStats(g.items);
            const cc = g.course ? courseColor(g.course.color) : null;
            return (
              <Card key={g.course_id || "general"} className="p-5">
                <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                  <div className="flex items-center gap-2">
                    {cc && <span className={`w-2.5 h-2.5 rounded-full ${cc.dot}`} />}
                    <h2 className="font-display text-lg font-semibold">{g.course?.name || "General"}</h2>
                    {g.course && (
                      <Link to={`/courses/${g.course.id}`} className="text-muted-foreground hover:text-foreground" title="Open course">
                        <ArrowUpRight className="w-4 h-4" />
                      </Link>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="um-label">{stats.reviewed}/{stats.count} reviewed</span>
                    <span className="chip border-border/70 bg-muted/40 text-muted-foreground">{stats.mastery}% mastery</span>
                  </div>
                </div>
                <div className="space-y-3">
                  {g.items.map((t) => (
                    <div key={t.id} className="flex items-center gap-3">
                      <button onClick={() => toggleReview(t)} aria-label={t.reviewed ? `Mark ${t.name} as not reviewed` : `Mark ${t.name} as reviewed`} className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${t.reviewed ? "bg-emerald-500 border-emerald-500" : "border-border"}`}>
                        {t.reviewed && <Check className="w-3 h-3 text-white" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate flex items-center gap-2">
                          {t.name}
                          <button onClick={() => rename(t)} aria-label={`Rename ${t.name}`} className="text-muted-foreground/60 hover:text-foreground"><Pencil className="w-3 h-3" /></button>
                          <button onClick={() => remove(t)} aria-label={`Delete ${t.name}`} className="text-muted-foreground/60 hover:text-destructive"><Trash2 className="w-3 h-3" /></button>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden mt-1.5">
                          <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${Number(t.mastery) || 0}%` }} />
                        </div>
                      </div>
                      <input type="range" min="0" max="100" value={Number(t.mastery) || 0} onChange={(e) => setMastery(t, Number(e.target.value))} aria-label={`${t.name} mastery`} className="w-24 accent-cyan-500" />
                      <span className="text-xs text-muted-foreground w-8 text-right">{Number(t.mastery) || 0}%</span>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}
      <QuickAdd open={qaOpen} onClose={() => setQaOpen(false)} />
    </>
  );
}