import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Target } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n";

export default function GoalsCard({ goals }) {
  const { t } = useI18n();
  return (
    <Card className="p-5 h-full">
      <div className="flex items-center gap-2 mb-4">
        <Target className="w-4 h-4 text-hud-emerald" />
        <h2 className="um-label">{t("dash.goals")}</h2>
      </div>
      <div className="space-y-3">
        {goals.slice(0, 3).map((g, i) => {
          const pct = g.target ? Math.min(100, Math.round((g.current / g.target) * 100)) : 0;
          return (
            <Link key={g.id} to="/goals" className="block group">
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="truncate group-hover:text-primary transition-colors">{g.name}</span>
                <span className="text-xs text-muted-foreground">{g.current}/{g.target}</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-emerald-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 + i * 0.08 }}
                />
              </div>
            </Link>
          );
        })}
      </div>
    </Card>
  );
}