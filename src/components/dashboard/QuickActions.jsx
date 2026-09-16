import { useNavigate } from "react-router-dom";
import { Command, Play, CheckSquare } from "lucide-react";
import { Button } from "@/components/ui/button";

// Quick actions / command launcher — a fast lane to the Command Palette (⌘K)
// and to Focus mode, surfaced right on the dashboard.
export default function QuickActions() {
  const navigate = useNavigate();
  const openPalette = () => window.dispatchEvent(new Event("unimate:palette"));
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-[#07080D] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] p-5 h-full">
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] via-transparent to-transparent" aria-hidden />
      <div className="relative h-full flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="um-label">Quick actions</h2>
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70 hidden sm:inline-flex items-center gap-1">
            <Command className="w-3 h-3" /> K
          </span>
        </div>
        <div className="space-y-2.5">
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2 h-10 border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05]"
            onClick={openPalette}
          >
            <CheckSquare className="w-4 h-4 text-cyan-300" />
            Command palette
            <span className="ml-auto text-[10px] font-mono text-muted-foreground/70 hidden sm:inline">⌘K</span>
          </Button>
          <Button
            size="sm"
            className="w-full justify-start gap-2 h-10"
            onClick={() => navigate("/focus", { state: { autostart: true } })}
          >
            <Play className="w-4 h-4" />
            Start focus mode
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground mt-auto pt-3">Search anything, add a task or note, arm a session — ⌘K works app-wide.</p>
      </div>
    </div>
  );
}