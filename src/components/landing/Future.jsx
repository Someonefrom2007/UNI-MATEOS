import { Reveal } from "@/components/motion/Reveal";
import { FUTURE } from "@/components/landing/sections";
import { SectionFrame } from "@/components/landing/Section";

export default function Future() {
  return (
    <SectionFrame id="future" className="max-w-4xl py-20 sm:py-24">
      <Reveal mode="inView" className="mx-auto max-w-2xl text-center">
        <div className="um-label mb-4">{FUTURE.kicker}</div>
        <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">{FUTURE.headline}</h2>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground leading-relaxed">{FUTURE.body}</p>
      </Reveal>
    </SectionFrame>
  );
}