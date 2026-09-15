import { ShieldCheck, HardDrive, UserX } from "lucide-react";
import { PRIVACY } from "@/components/landing/sections";
import { SectionFrame, SectionHeading } from "@/components/landing/Section";

const ICONS = [HardDrive, UserX, ShieldCheck];

export default function Privacy() {
  return (
    <SectionFrame id="privacy">
      <SectionHeading kicker={PRIVACY.kicker} headline={PRIVACY.headline} align="center" className="max-w-2xl">
        <ul className="mx-auto mt-8 flex max-w-lg flex-col gap-3 text-left">
          {PRIVACY.points.map((pt, i) => {
            const Icon = ICONS[i] || ShieldCheck;
            return (
              <li key={pt} className="flex items-start gap-3 rounded-xl border border-border bg-card/60 px-4 py-3">
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
                <span className="text-sm text-muted-foreground">{pt}</span>
              </li>
            );
          })}
        </ul>
      </SectionHeading>
    </SectionFrame>
  );
}