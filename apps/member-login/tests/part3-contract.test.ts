import assert from "node:assert/strict";
import test from "node:test";
import { normalizeAndValidatePart3Payload } from "../src/lib/part3-contract.ts";

const injuryDetails = "A recurring wrist limitation affects loaded extension during training.";
const needsDetails = "Clear instructions and a quieter environment help me participate comfortably.";

function payload(overrides: Record<string, unknown> = {}) {
  return {
    formPart: "3",
    formVersion: "1",
    submissionID: "browser-transport-id",
    answers: {
      injuries: ["current_injury"],
      injuryDetails,
      needs: ["health_condition"],
      needsDetails,
    },
    normalizedAnswers: [{ fieldName: "ignored", value: "ignored" }],
    calculatedFields: { ignored: true },
    conditionalFollowups: [{ ignored: true }],
    ...overrides,
  };
}

function assertValid(input: Record<string, unknown>) {
  const result = normalizeAndValidatePart3Payload(input);
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("expected valid Part 3 payload");
  return result.payload;
}

function assertInvalid(input: Record<string, unknown>) {
  const result = normalizeAndValidatePart3Payload(input);
  assert.deepEqual(result, { ok: false, code: "INVALID_PART3_CONTRACT" });
}

test("normalises the active Part 3 contract and strips browser-owned calculated data", () => {
  const result = assertValid(payload());

  assert.equal(result.formPart, 3);
  assert.equal(result.formVersion, 1);
  assert.deepEqual(result.answers, {
    injuries: ["current_injury"],
    injuryDetails,
    needs: ["health_condition"],
    needsDetails,
  });
  assert.deepEqual(result.normalizedAnswers, [
    { fieldName: "injuries", value: ["current_injury"] },
    { fieldName: "injuryDetails", value: injuryDetails },
    { fieldName: "needs", value: ["health_condition"] },
    { fieldName: "needsDetails", value: needsDetails },
  ]);
  assert.deepEqual(result.calculatedFields, {});
  assert.deepEqual(result.conditionalFollowups, []);
  assert.equal(result.submissionID, "browser-transport-id");
});

test("accepts numeric canonical form values and multiple non-exclusive selections", () => {
  const result = assertValid(payload({
    formPart: 3,
    formVersion: 1,
    answers: {
      injuries: ["previous_recovered", "chronic_condition", "something_else"],
      injuryDetails,
      needs: ["disability", "neurodivergence", "other_factor"],
      needsDetails,
    },
  }));

  assert.deepEqual(result.answers.injuries, ["previous_recovered", "chronic_condition", "something_else"]);
  assert.deepEqual(result.answers.needs, ["disability", "neurodivergence", "other_factor"]);
});

test("accepts no_issues and none without required detail text", () => {
  const result = assertValid(payload({
    answers: {
      injuries: ["no_issues"],
      needs: ["none"],
    },
  }));

  assert.equal(result.answers.injuryDetails, "");
  assert.equal(result.answers.needsDetails, "");
});

test("accepts empty selection arrays because no minimum selection is locked", () => {
  const result = assertValid(payload({
    answers: { injuries: [], needs: [] },
  }));

  assert.deepEqual(result.answers.injuries, []);
  assert.deepEqual(result.answers.needs, []);
});

test("rejects duplicate enum selections", () => {
  assertInvalid(payload({
    answers: {
      injuries: ["current_injury", "current_injury", "previous_recovered"],
      injuryDetails,
      needs: ["health_condition", "health_condition"],
      needsDetails,
    },
  }));
  assertInvalid(payload({
    answers: {
      injuries: ["current_injury"],
      injuryDetails,
      needs: ["disability", "disability"],
      needsDetails,
    },
  }));
});

test("strips unknown top-level browser authority fields", () => {
  const result = assertValid(payload({
    fusionId: "browser-fusion-id",
    episodeId: "browser-episode-id",
    submittedAt: "2026-09-19T00:00:00.000Z",
    arbitraryAuthorityLikeField: "browser-controlled",
  }));

  assert.deepEqual(Object.keys(result).sort(), [
    "answers",
    "calculatedFields",
    "conditionalFollowups",
    "formPart",
    "formVersion",
    "normalizedAnswers",
    "submissionID",
  ]);
  assert.equal("fusionId" in result, false);
  assert.equal("episodeId" in result, false);
  assert.equal("submittedAt" in result, false);
  assert.equal("arbitraryAuthorityLikeField" in result, false);
  assert.equal("fusionId" in result.answers, false);
  assert.equal("episodeId" in result.answers, false);
});

test("accepts exact detail boundaries", () => {
  const result = assertValid(payload({
    answers: {
      injuries: ["current_injury"],
      injuryDetails: "i".repeat(30),
      needs: ["health_condition"],
      needsDetails: "n".repeat(500),
    },
  }));

  assert.equal(result.answers.injuryDetails.length, 30);
  assert.equal(result.answers.needsDetails.length, 500);

  const minimumNeeds = assertValid(payload({
    answers: {
      injuries: ["no_issues"],
      needs: ["health_condition"],
      needsDetails: "n".repeat(30),
    },
  }));
  assert.equal(minimumNeeds.answers.needsDetails.length, 30);

  const maximumInjury = assertValid(payload({
    answers: {
      injuries: ["current_injury"],
      injuryDetails: "i".repeat(350),
      needs: ["none"],
    },
  }));
  assert.equal(maximumInjury.answers.injuryDetails.length, 350);
});

test("ignores stale hidden detail text when the exclusive no-answer option is selected", () => {
  const result = assertValid(payload({
    answers: {
      injuries: ["no_issues"],
      injuryDetails: "stale hidden text should not be persisted",
      needs: ["none"],
      needsDetails: "stale hidden text should not be persisted",
    },
  }));

  assert.equal(result.answers.injuryDetails, "");
  assert.equal(result.answers.needsDetails, "");
});

test("rejects unsupported versions and malformed top-level input", () => {
  assertInvalid(payload({ formVersion: 2 }));
  assertInvalid(payload({ formPart: 2 }));
  assertInvalid({});
  assertInvalid(payload({ submissionID: "" }));
  assertInvalid(payload({ answers: null }));
});

test("rejects unknown answer fields and malformed selection types", () => {
  assertInvalid(payload({ answers: { ...payload().answers as object, unexpected: "value" } }));
  assertInvalid(payload({ answers: { ...payload().answers as object, injuries: "current_injury" } }));
  assertInvalid(payload({ answers: { ...payload().answers as object, needs: { value: "none" } } }));
  assertInvalid(payload({ answers: { ...payload().answers as object, injuries: ["unknown"] } }));
  assertInvalid(payload({ answers: { ...payload().answers as object, needs: ["unknown"] } }));
});

test("rejects exclusive selections combined with other values", () => {
  assertInvalid(payload({ answers: { ...payload().answers as object, injuries: ["no_issues", "current_injury"] } }));
  assertInvalid(payload({ answers: { ...payload().answers as object, needs: ["none", "disability"] } }));
});

test("rejects missing, whitespace-only and out-of-range required details", () => {
  assertInvalid(payload({ answers: { injuries: ["current_injury"], needs: ["none"] } }));
  assertInvalid(payload({ answers: { injuries: ["current_injury"], injuryDetails: "   ", needs: ["none"] } }));
  assertInvalid(payload({ answers: { injuries: ["current_injury"], injuryDetails: "i".repeat(29), needs: ["none"] } }));
  assertInvalid(payload({ answers: { injuries: ["current_injury"], injuryDetails: "i".repeat(351), needs: ["none"] } }));
  assertInvalid(payload({ answers: { injuries: ["no_issues"], needs: ["health_condition"] } }));
  assertInvalid(payload({ answers: { injuries: ["no_issues"], needs: ["health_condition"], needsDetails: "   " } }));
  assertInvalid(payload({ answers: { injuries: ["no_issues"], needs: ["health_condition"], needsDetails: "n".repeat(29) } }));
  assertInvalid(payload({ answers: { injuries: ["no_issues"], needs: ["health_condition"], needsDetails: "n".repeat(501) } }));
});

test("rejects malformed detail types and never mutates the input", () => {
  const input = payload();
  const snapshot = structuredClone(input);
  assertInvalid(payload({ answers: { ...payload().answers as object, injuryDetails: 30 } }));
  assertInvalid(payload({ answers: { ...payload().answers as object, needsDetails: { text: needsDetails } } }));
  assertValid(input);
  assert.deepEqual(input, snapshot);
});
