import { ArrowRight, Check, ClipboardCheck, LockKeyhole } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type DashboardStatus = "COMPLETE" | "INCOMPLETE";
export type DashboardAvailability = "AVAILABLE" | "LOCKED" | "SUBMITTED";

export type DashboardPart = {
  status: DashboardStatus;
  availability: DashboardAvailability;
  href?: string;
  actionLabel?: string;
};

export type DashboardProjection = {
  hasActiveEpisode: boolean;
  journeyPhase?: "EOI_PHASE" | "REVIEW_PHASE" | null;
  part1: DashboardStatus | null;
  nextAction: string | null;
  currentStatus: string;
  parts?: Partial<Record<"part2" | "part3" | "part4", DashboardPart>>;
  task?: {
    title: string;
    description: string;
    href: string;
    actionLabel: string;
  };
};

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

function StatusCard({
  children,
  description,
}: {
  children: ReactNode;
  description?: ReactNode;
}) {
  return <section className="relative isolate overflow-hidden rounded-2xl bg-black p-6 text-white shadow-[0_18px_45px_rgba(0,0,0,0.14)] sm:p-7" aria-labelledby="dashboard-status-heading">
    <div className="absolute -right-12 -top-16 -z-10 size-48 rounded-full bg-[#ff6b35]/80 blur-3xl" aria-hidden="true" />
    <div className="absolute bottom-0 left-0 h-1 w-24 bg-[#ff6b35]" aria-hidden="true" />
    <div className="flex items-center gap-3 text-white/65">
      <span className="grid size-9 place-items-center rounded-full border border-white/20 bg-white/10"><ClipboardCheck className="size-4" aria-hidden="true" /></span>
      <p className="text-xs font-bold uppercase tracking-[0.18em]">Current status</p>
    </div>
    {children}
    {description ? <div className="mt-5 text-sm leading-6 text-white/70">{description}</div> : null}
  </section>;
}

export function CurrentStatus({ projection }: { projection: DashboardProjection }) {
  if (!projection.hasActiveEpisode) {
    return <StatusCard description={<>If you would like to re-enrol, please submit a new <a href="https://eoi.gymfusion.com.au" className="font-bold text-white underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">EOI</a>.</>}><h2 id="dashboard-status-heading" className="mt-5 max-w-3xl font-heading text-2xl font-bold leading-tight sm:text-3xl">No active enrolment or EOI in progress.</h2></StatusCard>;
  }
  if (!projection.part1) {
    return <StatusCard description="We could not load your EOI progress right now. Please try again shortly."><h2 id="dashboard-status-heading" className="mt-5 max-w-3xl font-heading text-2xl font-bold leading-tight sm:text-3xl">{projection.currentStatus}</h2></StatusCard>;
  }
  return <StatusCard><h2 id="dashboard-status-heading" className="mt-5 font-heading text-2xl font-bold leading-tight sm:text-3xl">{projection.currentStatus}</h2></StatusCard>;
}

function PartCard({ part, definition }: { part: DashboardPart; definition: (typeof partDetails)[keyof typeof partDetails] }) {
  const locked = part.availability === "LOCKED";
  const content = <div className={cn("flex h-full flex-col gap-5 rounded-xl border p-5", locked ? "border-black/10 bg-[#f6f6f4]" : "border-black/15 bg-white")}>
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-sm font-bold uppercase tracking-[0.12em] text-black/50">{definition.label}</p>
        <h3 className="mt-2 font-heading text-xl font-bold leading-tight">{definition.title}</h3>
      </div>
      {locked ? <LockKeyhole className="mt-1 size-5 shrink-0 text-black/55" aria-label="Locked" /> : part.status === "COMPLETE" ? <Check className="mt-1 size-5 shrink-0" aria-label="Complete" /> : null}
    </div>
    <div className="mt-auto flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <StatusBadge status={part.status} />
        <span className="text-xs font-semibold text-black/55">{part.availability}</span>
      </div>
      {part.href && !locked ? <ActionLink href={part.href}>{part.actionLabel ?? "Open"}</ActionLink> : null}
    </div>
  </div>;

  return <div aria-label={`${definition.label}, ${part.status}${locked ? ", locked" : ""}`}>{content}</div>;
}

function TasksCard({ projection }: { projection: DashboardProjection }) {
  return <section className="relative overflow-hidden rounded-2xl border border-black/10 bg-white p-6 shadow-[0_14px_35px_rgba(0,0,0,0.06)] sm:p-7" aria-labelledby="dashboard-tasks-heading">
    <div className="absolute right-0 top-0 h-1 w-28 bg-[#ffb000]" aria-hidden="true" />
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-black/50">Current tasks</p>
        <h2 id="dashboard-tasks-heading" className="mt-3 font-heading text-2xl font-bold tracking-tight">{projection.task ? "Action required" : "No outstanding tasks."}</h2>
      </div>
      {projection.task ? <span className="rounded-full bg-[#fff3d6] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.08em] text-[#8a5600]">Needs attention</span> : null}
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
  const parts = { part1, part2: projection.parts?.part2, part3: projection.parts?.part3, part4: projection.parts?.part4 };

  return <section className="rounded-2xl border border-black/12 bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] sm:p-7" aria-labelledby="dashboard-eoi-heading">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-bold uppercase tracking-[0.14em] text-black/50">EOI progress</p><h2 id="dashboard-eoi-heading" className="mt-2 font-heading text-2xl font-bold tracking-tight">Your Expression of Interest</h2></div></div>
    <div className="mt-6 grid gap-4 md:grid-cols-2">{(<><PartCard part={parts.part1} definition={partDetails.part1} />{parts.part2 ? <PartCard part={parts.part2} definition={partDetails.part2} /> : null}{parts.part3 ? <PartCard part={parts.part3} definition={partDetails.part3} /> : null}{parts.part4 ? <PartCard part={parts.part4} definition={partDetails.part4} /> : null}</>)}</div>
  </section>;
}

export default function DashboardView({ projection }: { projection: DashboardProjection }) {
  return <div className="grid gap-5"><TasksCard projection={projection.hasActiveEpisode && projection.part1 ? projection : { ...projection, task: undefined }} /></div>;
}
