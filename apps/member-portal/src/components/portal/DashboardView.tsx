import { ArrowRight, Check, LockKeyhole } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { EoiProgression } from "../../lib/eoi-progression";
import EoiOverviewCards from "./EoiOverviewCards";

export type DashboardStatus = "COMPLETE" | "INCOMPLETE";

export type DashboardPart = EoiProgression["parts"][keyof EoiProgression["parts"]];
export type DashboardProjection = EoiProgression;

const partDetails = {
  part1: { label: "EOI - Part 1", title: "Expression of Interest" },
  part2: { label: "EOI - Part 2", title: "Health Profile" },
  part3: { label: "EOI - Part 3", title: "Accessibility & Support Needs" },
  part4: { label: "EOI - Part 4", title: "Fitness Profile" },
} as const;

function StatusBadge({ status }: { status: DashboardStatus }) {
  return <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold tracking-[0.08em]", status === "COMPLETE" ? "border-black bg-black text-white" : "border-black/20 bg-white text-black/70")}>{status}</span>;
}

function ActionLink({ href, children }: { href: string; children: ReactNode }) {
  return <a href={href} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-black px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-black/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black">{children}<ArrowRight className="size-4" aria-hidden="true" /></a>;
}

function PartCard({ part, definition }: { part: DashboardPart; definition: (typeof partDetails)[keyof typeof partDetails] }) {
  const locked = part.availability === "LOCKED";
  const content = <div className={cn("flex h-full flex-col gap-5 rounded-xl border p-5", locked ? "border-black/10 bg-[#f6f6f4]" : "border-black/15 bg-white")}>
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-sm font-bold uppercase tracking-[0.12em] text-black/50">{definition.label}</p>
        <h3 className="mt-2 font-heading text-xl font-bold leading-tight">{definition.title}</h3>
      </div>
      {locked ? <LockKeyhole className="mt-1 size-5 shrink-0 text-black/55" aria-label="Locked" /> : <Check className="mt-1 size-5 shrink-0" aria-label="Available" />}
    </div>
    <div className="mt-auto flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <StatusBadge status={part.status} />
        <span className="text-xs font-semibold text-black/55">{locked ? "LOCKED" : part.availability === "SUBMITTED" ? "SUBMITTED" : "AVAILABLE"}</span>
      </div>
      {part.href && !locked ? <ActionLink href={part.href}>{part.actionLabel ?? "Open"}</ActionLink> : null}
    </div>
  </div>;

  return <div aria-label={`${definition.label}, ${part.status}${locked ? ", locked" : ""}`}>{content}</div>;
}

function TasksCard({ projection }: { projection: DashboardProjection }) {
  return <section className="rounded-2xl border border-black/12 bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] sm:p-7" aria-labelledby="dashboard-tasks-heading">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="text-sm font-bold uppercase tracking-[0.14em] text-black/50">Current tasks</p>
        <h2 id="dashboard-tasks-heading" className="mt-2 font-heading text-2xl font-bold tracking-tight">{projection.task ? "Action required" : "No outstanding tasks."}</h2>
      </div>
      {projection.task ? <span className="rounded-full border border-black/15 px-2.5 py-1 text-xs font-bold uppercase tracking-[0.08em]">Needs attention</span> : null}
    </div>
    {projection.task ? <div className="mt-6 flex flex-col gap-4 rounded-xl border border-black/10 bg-[#fafaf8] p-5 sm:flex-row sm:items-center sm:justify-between">
      <div><h3 className="font-heading text-xl font-bold">{projection.task.title}</h3><p className="mt-2 max-w-2xl text-sm leading-6 text-black/65">{projection.task.description}</p></div>
      <ActionLink href={projection.task.href}>{projection.task.actionLabel}</ActionLink>
    </div> : <p className="mt-4 text-base leading-7 text-black/65">You’re all up to date.</p>}
  </section>;
}

export function EoiProgress({ projection }: { projection: DashboardProjection }) {
  if (!projection.part1) return null;
  const part1: DashboardPart = {
    status: projection.part1,
    availability: projection.part1 === "COMPLETE" ? "SUBMITTED" : "AVAILABLE",
    href: projection.part1 === "COMPLETE" ? "/submissions" : "https://eoi.gymfusion.com.au",
    actionLabel: projection.part1 === "COMPLETE" ? "View submission" : "Continue EOI",
  };
  const parts = { part1, part2: projection.parts.part2, part3: projection.parts.part3, part4: projection.parts.part4 };

  return <section className="rounded-2xl border border-black/12 bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] sm:p-7" aria-labelledby="dashboard-eoi-heading">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-bold uppercase tracking-[0.14em] text-black/50">EOI progress</p><h2 id="dashboard-eoi-heading" className="mt-2 font-heading text-2xl font-bold tracking-tight">Your Expression of Interest</h2></div></div>
    <div className="mt-6 grid gap-4 md:grid-cols-2">{(<><PartCard part={parts.part1} definition={partDetails.part1} />{parts.part2 ? <PartCard part={parts.part2} definition={partDetails.part2} /> : null}{parts.part3 ? <PartCard part={parts.part3} definition={partDetails.part3} /> : null}{parts.part4 ? <PartCard part={parts.part4} definition={partDetails.part4} /> : null}</>)}</div>
  </section>;
}

export default function DashboardView({ projection }: { projection: DashboardProjection }) {
  return <div className="grid min-w-0 gap-8">
    <EoiOverviewCards progression={projection} />
    <TasksCard projection={projection} />
  </div>;
}
