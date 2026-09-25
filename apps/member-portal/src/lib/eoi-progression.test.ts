import assert from "node:assert/strict";
import test from "node:test";
import { deriveEoiProgression } from "./eoi-progression.ts";

const base = {
  hasActiveEpisode: true,
  journeyPhase: "EOI_PHASE" as const,
  part1: "COMPLETE",
  part2: "INCOMPLETE",
  part3: "INCOMPLETE",
  part4: "INCOMPLETE",
  part2Availability: "AVAILABLE",
  part3Availability: "LOCKED",
  part4Availability: "LOCKED",
};

test("keeps future parts locked until the authoritative availability opens them", () => {
  const projection = deriveEoiProgression(base);
  assert.equal(projection?.parts.part2.availability, "AVAILABLE");
  assert.equal(projection?.parts.part3.availability, "LOCKED");
  assert.equal(projection?.parts.part4.availability, "LOCKED");
  assert.equal(projection?.task?.title, "Complete your Health Profile");
});

test("moves the task to Part 3 after Part 2 is complete and Part 3 is available", () => {
  const projection = deriveEoiProgression({ ...base, part2: "COMPLETE", part2Availability: "AVAILABLE", part3Availability: "AVAILABLE" });
  assert.equal(projection?.parts.part3.availability, "AVAILABLE");
  assert.equal(projection?.task?.title, "Complete your Accessibility & Support Needs");
});

test("keeps Part 4 locked while the authoritative read keeps Part 3 incomplete", () => {
  const projection = deriveEoiProgression({ ...base, part2: "COMPLETE", part2Availability: "AVAILABLE" });
  assert.equal(projection?.parts.part4.availability, "LOCKED");
  assert.equal(projection?.task, undefined);
});

test("uses the Part 3 completion state before exposing the Part 4 task", () => {
  const projection = deriveEoiProgression({ ...base, part2: "COMPLETE", part2Availability: "AVAILABLE", part3: "COMPLETE", part3Availability: "AVAILABLE", part4Availability: "AVAILABLE" });
  assert.equal(projection?.parts.part4.availability, "AVAILABLE");
  assert.equal(projection?.task?.title, "Complete your Fitness Profile");
});

test("does not invent a task for locked future work", () => {
  const projection = deriveEoiProgression({ ...base, part2Availability: "LOCKED" });
  assert.equal(projection?.task, undefined);
});

test("enters review phase only after all EOI parts are complete", () => {
  const projection = deriveEoiProgression({ ...base, journeyPhase: "REVIEW_PHASE", part2: "COMPLETE", part3: "COMPLETE", part4: "COMPLETE", part2Availability: "AVAILABLE", part3Availability: "AVAILABLE", part4Availability: "AVAILABLE" });
  assert.equal(projection?.allPartsComplete, true);
  assert.equal(projection?.stageTwoProgress, 3);
  assert.equal(projection?.task, undefined);
  assert.equal(projection?.currentStatus, "Your EOI is in the Review Phase");
});

test("returns no task when there is no active episode", () => {
  const projection = deriveEoiProgression({ ...base, hasActiveEpisode: false, part1: null });
  assert.equal(projection?.part1, null);
  assert.equal(projection?.task, undefined);
});

test("suppresses stale Part 2-4 completion when there is no active episode", () => {
  const projection = deriveEoiProgression({
    ...base,
    hasActiveEpisode: false,
    part1: null,
    part2: "COMPLETE",
    part3: "COMPLETE",
    part4: "COMPLETE",
    part2Availability: "AVAILABLE",
    part3Availability: "AVAILABLE",
    part4Availability: "AVAILABLE",
  });
  assert.ok(projection);
  assert.deepEqual(
    [projection.parts.part2, projection.parts.part3, projection.parts.part4].map(({ status, availability }) => ({ status, availability })),
    [
      { status: "INCOMPLETE", availability: "LOCKED" },
      { status: "INCOMPLETE", availability: "LOCKED" },
      { status: "INCOMPLETE", availability: "LOCKED" },
    ],
  );
  assert.equal(projection?.stageTwoProgress, 0);
  assert.equal(projection?.allPartsComplete, false);
  assert.equal(projection?.task, undefined);
});

test("locks Part 3 when Part 2 is incomplete despite AVAILABLE state", () => {
  const projection = deriveEoiProgression({ ...base, part3Availability: "AVAILABLE" });
  assert.equal(projection?.parts.part3.status, "INCOMPLETE");
  assert.equal(projection?.parts.part3.availability, "LOCKED");
  assert.equal(projection?.task?.title, "Complete your Health Profile");
});

test("locks Part 4 when Part 3 is incomplete despite AVAILABLE state", () => {
  const projection = deriveEoiProgression({
    ...base,
    part2: "COMPLETE",
    part2Availability: "AVAILABLE",
    part4Availability: "AVAILABLE",
  });
  assert.equal(projection?.parts.part4.status, "INCOMPLETE");
  assert.equal(projection?.parts.part4.availability, "LOCKED");
  assert.equal(projection?.task, undefined);
});

test("does not advance past an incomplete predecessor with contradictory completion", () => {
  const projection = deriveEoiProgression({
    ...base,
    part3: "COMPLETE",
    part3Availability: "AVAILABLE",
    part4: "COMPLETE",
    part4Availability: "AVAILABLE",
  });
  assert.equal(projection?.parts.part2.status, "INCOMPLETE");
  assert.equal(projection?.parts.part3.status, "INCOMPLETE");
  assert.equal(projection?.parts.part4.status, "INCOMPLETE");
  assert.equal(projection?.stageTwoProgress, 0);
  assert.equal(projection?.task?.title, "Complete your Health Profile");
});

test("suppresses Review Phase when there is no active episode", () => {
  const projection = deriveEoiProgression({
    ...base,
    hasActiveEpisode: false,
    journeyPhase: "REVIEW_PHASE",
    part1: null,
    part2: "COMPLETE",
    part3: "COMPLETE",
    part4: "COMPLETE",
    part2Availability: "AVAILABLE",
    part3Availability: "AVAILABLE",
    part4Availability: "AVAILABLE",
  });
  assert.equal(projection?.journeyPhase, null);
  assert.equal(projection?.currentStatus, "No active enrolment or EOI in progress.");
  assert.equal(projection?.allPartsComplete, false);
});

test("suppresses Review Phase while Part 2 is incomplete", () => {
  const projection = deriveEoiProgression({ ...base, journeyPhase: "REVIEW_PHASE" });
  assert.equal(projection?.journeyPhase, null);
  assert.equal(projection?.currentStatus, "Your EOI is in progress.");
  assert.equal(projection?.task?.title, "Complete your Health Profile");
});

test("suppresses Review Phase while Part 3 is incomplete", () => {
  const projection = deriveEoiProgression({
    ...base,
    journeyPhase: "REVIEW_PHASE",
    part2: "COMPLETE",
    part2Availability: "AVAILABLE",
    part3Availability: "AVAILABLE",
  });
  assert.equal(projection?.journeyPhase, null);
  assert.equal(projection?.currentStatus, "Your EOI is in progress.");
  assert.equal(projection?.task?.title, "Complete your Accessibility & Support Needs");
});

test("suppresses Review Phase while Part 4 is incomplete", () => {
  const projection = deriveEoiProgression({
    ...base,
    journeyPhase: "REVIEW_PHASE",
    part2: "COMPLETE",
    part3: "COMPLETE",
    part2Availability: "AVAILABLE",
    part3Availability: "AVAILABLE",
    part4Availability: "AVAILABLE",
  });
  assert.equal(projection?.journeyPhase, null);
  assert.equal(projection?.currentStatus, "Your EOI is in progress.");
  assert.equal(projection?.task?.title, "Complete your Fitness Profile");
});

test("locks malformed Part 2 status despite AVAILABLE state", () => {
  const projection = deriveEoiProgression({ ...base, part2: {} as unknown as string });
  assert.equal(projection?.parts.part2.availability, "LOCKED");
  assert.equal(projection?.task, undefined);
});

test("locks malformed Part 3 status despite AVAILABLE state", () => {
  const projection = deriveEoiProgression({
    ...base,
    part2: "COMPLETE",
    part2Availability: "AVAILABLE",
    part3: {} as unknown as string,
    part3Availability: "AVAILABLE",
  });
  assert.equal(projection?.parts.part3.availability, "LOCKED");
  assert.equal(projection?.parts.part4.availability, "LOCKED");
  assert.equal(projection?.task, undefined);
});

test("locks malformed Part 4 status despite AVAILABLE state", () => {
  const projection = deriveEoiProgression({
    ...base,
    part2: "COMPLETE",
    part3: "COMPLETE",
    part2Availability: "AVAILABLE",
    part3Availability: "AVAILABLE",
    part4: {} as unknown as string,
    part4Availability: "AVAILABLE",
  });
  assert.equal(projection?.parts.part4.availability, "LOCKED");
  assert.equal(projection?.task, undefined);
});

test("malformed predecessor status prevents downstream progression", () => {
  const projection = deriveEoiProgression({
    ...base,
    part2: {} as unknown as string,
    part2Availability: "AVAILABLE",
    part3: "COMPLETE",
    part4: "COMPLETE",
    part3Availability: "AVAILABLE",
    part4Availability: "AVAILABLE",
  });
  assert.equal(projection?.parts.part2.availability, "LOCKED");
  assert.equal(projection?.parts.part3.availability, "LOCKED");
  assert.equal(projection?.parts.part4.availability, "LOCKED");
  assert.equal(projection?.stageTwoProgress, 0);
  assert.equal(projection?.allPartsComplete, false);
  assert.equal(projection?.task, undefined);
});

test("fails closed when a complete Part 2 has missing availability", () => {
  const projection = deriveEoiProgression({ ...base, part2: "COMPLETE", part2Availability: undefined, part3Availability: "AVAILABLE" });
  assert.equal(projection?.parts.part2.status, "INCOMPLETE");
  assert.equal(projection?.parts.part2.availability, "LOCKED");
  assert.equal(projection?.parts.part3.availability, "LOCKED");
  assert.equal(projection?.task, undefined);
});

test("fails closed when a complete Part 3 has missing availability", () => {
  const projection = deriveEoiProgression({ ...base, part2: "COMPLETE", part2Availability: "AVAILABLE", part3: "COMPLETE", part3Availability: undefined, part4Availability: "AVAILABLE" });
  assert.equal(projection?.parts.part3.status, "INCOMPLETE");
  assert.equal(projection?.parts.part3.availability, "LOCKED");
  assert.equal(projection?.parts.part4.availability, "LOCKED");
  assert.equal(projection?.task, undefined);
});

test("fails closed when a complete Part 4 has missing availability", () => {
  const projection = deriveEoiProgression({ ...base, part2: "COMPLETE", part2Availability: "AVAILABLE", part3: "COMPLETE", part3Availability: "AVAILABLE", part4: "COMPLETE", part4Availability: undefined });
  assert.equal(projection?.parts.part4.status, "INCOMPLETE");
  assert.equal(projection?.parts.part4.availability, "LOCKED");
  assert.equal(projection?.allPartsComplete, false);
  assert.equal(projection?.journeyPhase, "EOI_PHASE");
});

test("fails closed for complete stages with unknown or raw SUBMITTED availability", () => {
  for (const declaredAvailability of ["UNKNOWN", "SUBMITTED"]) {
    const projection = deriveEoiProgression({ ...base, part2: "COMPLETE", part2Availability: declaredAvailability, part3Availability: "AVAILABLE" });
    assert.equal(projection?.parts.part2.status, "INCOMPLETE");
    assert.equal(projection?.parts.part2.availability, "LOCKED");
    assert.equal(projection?.parts.part3.availability, "LOCKED");
    assert.equal(projection?.task, undefined);
  }
});

test("derives local SUBMITTED display state from valid raw availability", () => {
  const projection = deriveEoiProgression({ ...base, part2: "COMPLETE", part2Availability: "AVAILABLE", part3Availability: "AVAILABLE" });
  assert.equal(projection?.parts.part2.status, "COMPLETE");
  assert.equal(projection?.parts.part2.availability, "SUBMITTED");
  assert.equal(projection?.task?.title, "Complete your Accessibility & Support Needs");
});

test("invalid predecessor availability prevents downstream unlock", () => {
  const projection = deriveEoiProgression({ ...base, part2: "COMPLETE", part2Availability: "UNKNOWN", part3: "COMPLETE", part3Availability: "AVAILABLE", part4Availability: "AVAILABLE" });
  assert.equal(projection?.parts.part2.availability, "LOCKED");
  assert.equal(projection?.parts.part3.availability, "LOCKED");
  assert.equal(projection?.parts.part4.availability, "LOCKED");
  assert.equal(projection?.stageTwoProgress, 0);
  assert.equal(projection?.task, undefined);
});

test("invalid availability cannot contribute to Review Phase", () => {
  const projection = deriveEoiProgression({ ...base, journeyPhase: "REVIEW_PHASE", part2: "COMPLETE", part2Availability: "UNKNOWN", part3: "COMPLETE", part3Availability: "AVAILABLE", part4: "COMPLETE", part4Availability: "AVAILABLE" });
  assert.equal(projection?.journeyPhase, null);
  assert.equal(projection?.currentStatus, "Your EOI is in progress.");
  assert.equal(projection?.allPartsComplete, false);
  assert.equal(projection?.task, undefined);
});

test("fails closed for malformed availability values", () => {
  for (const declaredAvailability of [null, {}, 42]) {
    const projection = deriveEoiProgression({ ...base, part2: "COMPLETE", part2Availability: declaredAvailability as unknown as string, part3Availability: "AVAILABLE" });
    assert.equal(projection?.parts.part2.status, "INCOMPLETE");
    assert.equal(projection?.parts.part2.availability, "LOCKED");
    assert.equal(projection?.parts.part3.availability, "LOCKED");
    assert.equal(projection?.task, undefined);
  }
});

test("does not derive Review Phase from an unsupported or missing journey phase", () => {
  const complete = { ...base, part2: "COMPLETE", part3: "COMPLETE", part4: "COMPLETE", part2Availability: "AVAILABLE", part3Availability: "AVAILABLE", part4Availability: "AVAILABLE" };
  for (const journeyPhase of ["EOI_PHASE", null, undefined, "UNKNOWN"]) {
    const projection = deriveEoiProgression({ ...complete, journeyPhase: journeyPhase as "EOI_PHASE" | "REVIEW_PHASE" | null });
    assert.equal(projection?.journeyPhase, journeyPhase === "EOI_PHASE" ? "EOI_PHASE" : null);
    assert.equal(projection?.allPartsComplete, true);
    assert.equal(projection?.task, undefined);
  }
});
