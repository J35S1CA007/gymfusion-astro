import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button, Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui";
import PortalShell, { type PortalMember } from "./PortalShell";
import DashboardView, { type DashboardProjection } from "./DashboardView";

export type PreviewState = "active-complete" | "part2-complete" | "part3-complete" | "active-incomplete" | "no-active" | "complete-eoi-phase" | "complete-no-phase" | "incomplete-review" | "eoi-review";

const previewOptions: Array<{ value: PreviewState; label: string }> = [
  { value: "active-complete", label: "Active episode - Part 1 complete" },
  { value: "part2-complete", label: "Active episode - Part 2 complete" },
  { value: "part3-complete", label: "Active episode - Part 3 complete" },
  { value: "active-incomplete", label: "Active episode - Part 1 incomplete" },
  { value: "no-active", label: "No active episode" },
  { value: "complete-eoi-phase", label: "All parts complete - EOI phase" },
  { value: "complete-no-phase", label: "All parts complete - no phase" },
  { value: "incomplete-review", label: "Incomplete EOI - review phase" },
  { value: "eoi-review", label: "EOI complete - under review" },
];

export default function FramePreview({ member, projections, initialState = "active-complete" }: { member: PortalMember; projections: Record<PreviewState, DashboardProjection>; initialState?: PreviewState }) {
  const [previewState, setPreviewState] = useState<PreviewState>(initialState);
  const [logoutMessage, setLogoutMessage] = useState("");

  return (
    <PortalShell
      active="dashboard"
      member={member}
      onLogout={() => setLogoutMessage("Mock Log Out invoked.")}
      title="Dashboard"
      headerActions={
        <Sheet>
          <SheetTrigger asChild>
            <Button type="button" variant="outline" aria-label="Open preview controls" className="size-10 border-black/15">
              <SlidersHorizontal className="size-4" aria-hidden="true" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[min(92vw,380px)] border-black/10 bg-white p-0 text-black">
            <SheetHeader className="border-b border-black/10 p-6">
              <SheetTitle>Preview controls</SheetTitle>
              <SheetDescription>Synthetic data only. These controls are not part of the member experience.</SheetDescription>
            </SheetHeader>
            <div className="p-6">
              <label className="flex flex-col gap-2 text-sm font-bold" htmlFor="dashboard-preview-state">
                <span>Dashboard preview state</span>
                <select id="dashboard-preview-state" value={previewState} onChange={(event) => setPreviewState(event.target.value as PreviewState)} className="min-h-11 max-w-full rounded-md border border-black/20 bg-white px-3 py-2 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black">
                  {previewOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
            </div>
          </SheetContent>
        </Sheet>
      }
    >
      <DashboardView projection={projections[previewState]} />
      <p className="min-h-6 text-sm font-semibold" aria-live="polite" data-preview-logout-result>{logoutMessage}</p>
    </PortalShell>
  );
}
