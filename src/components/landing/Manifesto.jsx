import BrandLogo from "@/components/Brand/BrandLogo";
import { Reveal } from "@/components/motion/Reveal";
import { MANIFESTO } from "@/components/landing/sections";
import { SectionFrame } from "@/components/landing/Section";

// Full-bleed statement beat — a centered, calm moment between story beats.
export default function Manifesto() {
  return (
    <SectionFrame id="manifesto" className="max-w-4xl py-20 sm:py-24">
      <Reveal mode="inView" className="mx-auto max-w-2xl text-center">
        <div className="um-label mb-5">{MANIFESTO.kicker}</div>
        <div className="mx-auto mb-7 flex justify-center" aria-hidden>
          <BrandLogo variant="gradient" size={52} showText={false} />
        </div>
        <h2 className="font-display text-4xl font-semibold tracking-tight leading-[1.08] sm:text-5xl">
          {MANIFESTO.headline}
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-muted-foreground leading-relaxed">{MANIFESTO.body}</p>
      </Reveal>
    </SectionFrame>
  );
}