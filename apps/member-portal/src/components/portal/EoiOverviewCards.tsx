"use client";

import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { useState } from "react";

type Stage = {
  label: string;
  accessibleLabel: string;
  title: string;
  copy: string;
  accent: string;
  complete: boolean;
  progress?: { complete: number; total: number };
};

const getStages = (allPartsComplete: boolean, stageTwoProgress: number): Stage[] => [
  {
    label: "01",
    accessibleLabel: "Stage 1",
    title: "Part 1 complete",
    copy: "Thank you for completing Part 1 of your Expression of Interest. You can now continue with the remaining parts of your EOI.",
    accent: "#ff6b35",
    complete: true,
    progress: { complete: 1, total: 1 },
  },
  {
    label: "02",
    accessibleLabel: "Stage 2",
    title: allPartsComplete ? "Parts 2-4 complete" : "Your next steps",
    copy: allPartsComplete ? "Your EOI profile is complete and ready for review." : "The remaining three sections help us understand you and your needs, so we can provide a safe, personalised, and effective experience.",
    accent: "#a855f7",
    complete: allPartsComplete,
    progress: { complete: stageTwoProgress, total: 3 },
  },
  ...(allPartsComplete ? [{
    label: "03",
    accessibleLabel: "Stage 3",
    title: "Your EOI is in the Review Phase",
    copy: "During this phase, we’ll look over your Expression of Interest. If we need anything else from you, a member of the GYMFUSION team will be in touch.",
    accent: "#EF0C78",
    complete: false,
  }] : []),
] as const;

function StageCard({ stage }: { stage: (ReturnType<typeof getStages>)[number] }) {
  const progress = stage.progress;

  return <article aria-label={stage.accessibleLabel} className="group relative min-h-56 overflow-hidden rounded-2xl border border-white/15 bg-[#111113] p-6 text-white shadow-[0_18px_40px_rgba(0,0,0,0.15)] transition-transform duration-500 hover:-translate-y-1 motion-reduce:transition-none sm:p-7">
    <div className="absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100 motion-reduce:transition-none" style={{ background: `radial-gradient(circle at 70% 15%, ${stage.accent}2b, transparent 48%)` }} aria-hidden="true" />
    {progress ? <div className="absolute bottom-0 left-0 right-0 flex h-1 gap-px bg-white/10" aria-label={`${progress.complete} of ${progress.total} milestones complete`} role="img">
      {Array.from({ length: progress.total }, (_, index) => <span key={index} className="min-w-0 flex-1" style={{ backgroundColor: index < progress.complete ? stage.accent : undefined }} />)}
    </div> : <div className="absolute bottom-0 left-0 h-1 w-24" style={{ backgroundColor: stage.accent }} aria-hidden="true" />}
    <div className="relative flex h-full flex-col">
      <div className="flex items-center justify-between gap-3">
        <span aria-label={stage.accessibleLabel} className="rounded-full px-3 py-1 text-[0.68rem] font-bold uppercase tracking-[0.16em]" style={{ backgroundColor: `${stage.accent}22`, color: stage.accent }}>{stage.label}</span>
        {stage.complete ? <Check className="size-5" style={{ color: stage.accent }} aria-label="Complete" /> : null}
      </div>
      <h3 className="mt-7 font-heading text-2xl font-bold tracking-tight">{stage.title}</h3>
      <p className="mt-3 max-w-xl text-sm leading-6 text-white/65">{stage.copy}</p>
    </div>
  </article>;
}

export default function EoiOverviewCards({ allPartsComplete, stageTwoProgress = 0 }: { allPartsComplete: boolean; stageTwoProgress?: number }) {
  const stages = getStages(allPartsComplete, Math.max(0, Math.min(3, stageTwoProgress)));
  const [active, setActive] = useState(0);
  const move = (direction: number) => setActive((active + direction + stages.length) % stages.length);

  return <section aria-labelledby="eoi-overview-heading">
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-black/50">Your EOI journey</p>
        <h2 id="eoi-overview-heading" className="mt-2 font-heading text-2xl font-bold tracking-tight">Where you are now</h2>
      </div>
    </div>
    <div className={allPartsComplete ? "hidden gap-4 md:grid md:grid-cols-3" : "hidden gap-4 md:grid md:grid-cols-2"}>
      {stages.map((stage) => <StageCard key={stage.label} stage={stage} />)}
    </div>
    <div className="md:hidden">
      <div className="overflow-hidden rounded-2xl">
        <div className="flex transition-transform duration-500 ease-out motion-reduce:transition-none" style={{ transform: `translateX(-${active * 100}%)` }}>
          {stages.map((stage) => <div className="min-w-full" key={stage.label}><StageCard stage={stage} /></div>)}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <button type="button" onClick={() => move(-1)} className="grid size-10 place-items-center rounded-full border border-black/15 bg-white transition-colors hover:bg-black hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black" aria-label="Previous EOI overview card"><ArrowLeft className="size-4" aria-hidden="true" /></button>
        <div className="flex gap-2" aria-label="EOI overview card navigation">
          {stages.map((stage, index) => <button key={stage.label} type="button" onClick={() => setActive(index)} className="h-2 rounded-full transition-all motion-reduce:transition-none" style={{ width: index === active ? "2rem" : "0.5rem", backgroundColor: index === active ? stage.accent : "#d4d4d4" }} aria-label={`Show ${stage.accessibleLabel}`} aria-current={index === active ? "true" : undefined} />)}
        </div>
        <button type="button" onClick={() => move(1)} className="grid size-10 place-items-center rounded-full border border-black/15 bg-white transition-colors hover:bg-black hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black" aria-label="Next EOI overview card"><ArrowRight className="size-4" aria-hidden="true" /></button>
      </div>
    </div>
  </section>;
}
