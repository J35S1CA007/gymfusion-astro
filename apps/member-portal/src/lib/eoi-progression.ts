export type EoiStatus = "COMPLETE" | "INCOMPLETE";
export type EoiAvailability = "AVAILABLE" | "LOCKED" | "SUBMITTED";

export type EoiOnboardingRead = {
  hasActiveEpisode?: boolean;
  journeyPhase?: "EOI_PHASE" | "REVIEW_PHASE" | null;
  part1?: string | null;
  part2?: string | null;
  part3?: string | null;
  part4?: string | null;
  part2Availability?: string;
  part3Availability?: string;
  part4Availability?: string;
};

export type EoiTask = {
  title: string;
  description: string;
  href: string;
  actionLabel: string;
};

export type EoiPartProjection = {
  status: EoiStatus;
  availability: EoiAvailability;
  href: string;
  actionLabel: string;
};

export type EoiProgression = {
  hasActiveEpisode: boolean;
  journeyPhase: "EOI_PHASE" | "REVIEW_PHASE" | null;
  part1: EoiStatus | null;
  nextAction: string | null;
  currentStatus: string;
  parts: {
    part2: EoiPartProjection;
    part3: EoiPartProjection;
    part4: EoiPartProjection;
  };
  task?: EoiTask;
  allPartsComplete: boolean;
  stageTwoProgress: number;
};

const normalized = (value: unknown) => typeof value === "string" ? value.trim().toUpperCase() : "";

function rawAvailability(value: unknown): "AVAILABLE" | "LOCKED" | null {
  const normalizedAvailability = normalized(value);
  return normalizedAvailability === "AVAILABLE" || normalizedAvailability === "LOCKED"
    ? normalizedAvailability
    : null;
}

function status(value: unknown, declaredAvailability?: unknown): EoiStatus | null {
  if (rawAvailability(declaredAvailability) === null) return null;
  const normalizedStatus = normalized(value);
  if (normalizedStatus === "COMPLETE") return "COMPLETE";
  return normalizedStatus === "INCOMPLETE" ? "INCOMPLETE" : null;
}

function availability(statusValue: EoiStatus, declaredAvailability: unknown): EoiAvailability {
  const normalizedAvailability = rawAvailability(declaredAvailability);
  if (statusValue === "COMPLETE" && normalizedAvailability !== null) return "SUBMITTED";
  return normalizedAvailability === "AVAILABLE" ? "AVAILABLE" : "LOCKED";
}

function projectPart(statusValue: EoiStatus, declaredAvailability: unknown, href: string, actionLabel: string): EoiPartProjection {
  return { status: statusValue, availability: availability(statusValue, declaredAvailability), href, actionLabel };
}

function lockedPart(href: string): EoiPartProjection {
  return projectPart("INCOMPLETE", "LOCKED", href, "Continue");
}

function currentTask(onboarding: EoiOnboardingRead, part1: EoiStatus | null, parts: EoiProgression["parts"]): EoiTask | undefined {
  if (onboarding.hasActiveEpisode !== true || part1 === null) return undefined;
  if (part1 === "INCOMPLETE") {
    return {
      title: "Complete your Expression of Interest",
      description: "Finish Part 1 to continue your GYMFUSION journey.",
      href: "https://eoi.gymfusion.com.au",
      actionLabel: "Continue EOI",
    };
  }
  if (parts.part2.status === "INCOMPLETE" && parts.part2.availability === "AVAILABLE") {
    return { title: "Complete your Health Profile", description: "Continue your EOI by completing Part 2.", href: "/eoi/part-2", actionLabel: "Continue Part 2" };
  }
  if (parts.part3.status === "INCOMPLETE" && parts.part3.availability === "AVAILABLE") {
    return { title: "Complete your Accessibility & Support Needs", description: "Continue your EOI by completing Part 3.", href: "/eoi/part-3", actionLabel: "Continue Part 3" };
  }
  if (parts.part4.status === "INCOMPLETE" && parts.part4.availability === "AVAILABLE") {
    return { title: "Complete your Fitness Profile", description: "Complete the final available part of your EOI.", href: "/eoi/part-4", actionLabel: "Continue Part 4" };
  }
  return undefined;
}

export function deriveEoiProgression(onboarding: EoiOnboardingRead | undefined): EoiProgression | null {
  if (!onboarding) return null;

  const hasActiveEpisode = onboarding.hasActiveEpisode === true;
  const normalizedPart1 = normalized(onboarding.part1);
  const part1: EoiStatus | null = hasActiveEpisode && (normalizedPart1 === "COMPLETE" || normalizedPart1 === "INCOMPLETE")
    ? normalizedPart1
    : null;
  const part2Status = part1 === "COMPLETE" ? status(onboarding.part2, onboarding.part2Availability) : null;
  const part3Status = part2Status === "COMPLETE" ? status(onboarding.part3, onboarding.part3Availability) : null;
  const part4Status = part3Status === "COMPLETE" ? status(onboarding.part4, onboarding.part4Availability) : null;
  const parts = {
    part2: part1 === "COMPLETE" && part2Status !== null
      ? projectPart(part2Status, onboarding.part2Availability, "/eoi/part-2", part2Status === "COMPLETE" ? "Review" : "Continue")
      : lockedPart("/eoi/part-2"),
    part3: part2Status === "COMPLETE" && part3Status !== null
      ? projectPart(part3Status, onboarding.part3Availability, "/eoi/part-3", part3Status === "COMPLETE" ? "Review" : "Continue")
      : lockedPart("/eoi/part-3"),
    part4: part3Status === "COMPLETE" && part4Status !== null
      ? projectPart(part4Status, onboarding.part4Availability, "/eoi/part-4", part4Status === "COMPLETE" ? "Review" : "Continue")
      : lockedPart("/eoi/part-4"),
  };
  const allPartsComplete = part1 === "COMPLETE" && Object.values(parts).every((part) => part.status === "COMPLETE");
  const task = currentTask(onboarding, part1, parts);
  const trustedJourneyPhase = normalized(onboarding.journeyPhase);
  const reviewPhase = hasActiveEpisode && allPartsComplete && trustedJourneyPhase === "REVIEW_PHASE";

  return {
    hasActiveEpisode,
    journeyPhase: reviewPhase ? "REVIEW_PHASE" : hasActiveEpisode && trustedJourneyPhase === "EOI_PHASE" ? "EOI_PHASE" : null,
    part1,
    nextAction: task?.title ?? null,
    currentStatus: reviewPhase ? "Your EOI is in the Review Phase" : hasActiveEpisode ? "Your EOI is in progress." : "No active enrolment or EOI in progress.",
    parts,
    ...(task ? { task } : {}),
    allPartsComplete,
    stageTwoProgress: Object.values(parts).filter((part) => part.status === "COMPLETE").length,
  };
}
