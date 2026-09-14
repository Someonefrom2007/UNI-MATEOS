import { useMemo, useState } from "react";
import { useUserData } from "@/lib/useUserData";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { courseColor } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { FolderOpen, Plus, ExternalLink, FileText, Link as LinkIcon, Video, Image as ImageIcon } from "lucide-react";
import QuickAdd from "@/components/QuickAdd";
import { useI18n } from "@/lib/i18n";
const TYPE_ICON = { pdf: FileText, doc: FileText, link: LinkIcon, video: Video, image: ImageIcon, presentation: FileText, file: FileText };

export default function Resources() {
  const { data } = useUserData();
  const { t } = useI18n();
  const [qaOpen, setQaOpen] = useState(false);

  const resources = useMemo(() => data?.Resource || [], [data]);
  const courses = data?.Course || [];

  if (resources.length === 0 && data) {
    return (
      <>
        <PageHeader title={t("title.resources")} subtitle={t("title.resources.subtitle")} />
        <EmptyState icon={FolderOpen} title="No resources yet" description="Add links, PDFs, and files — link them to courses so everything lives in context." actionLabel="Add Resource" onAction={() => setQaOpen(true)} />
        <QuickAdd open={qaOpen} onClose={() => setQaOpen(false)} />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Resources" subtitle="Your study materials, linked to courses and notes.">
        <button onClick={() => setQaOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
          <Plus className="w-4 h-4" /> Add
        </button>
      </PageHeader>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {resources.map((r) => {
          const Icon = TYPE_ICON[r.type] || FileText;
          const course = courses.find((c) => c.id === r.course_id);
          const cc = course ? courseColor(course.color) : null;
          return (
            <Card key={r.id} className="p-4 group glow-hover">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0 border border-border/60">
                  <Icon className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{r.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                    {course && <span className="flex items-center gap-1.5"><span className={`w-1.5 h-1.5 rounded-full ${cc.dot}`} />{course.name}</span>}
                    <span className="chip border-border/70 bg-muted/40 text-muted-foreground"><span className={`${r.type === "video" ? "text-amber-400" : "text-cyan-400"}`}>◆</span>{r.type}</span>
                  </div>
                  {r.url && <a href={r.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary mt-2 hover:underline">Open <ExternalLink className="w-3 h-3" /></a>}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
      <QuickAdd open={qaOpen} onClose={() => setQaOpen(false)} />
    </>
  );
}