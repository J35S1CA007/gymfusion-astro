const INJURY_VALUES = [
  "previous_recovered",
  "previous_limitation",
  "current_injury",
  "no_issues",
  "chronic_condition",
  "something_else",
] as const;

const NEEDS_VALUES = [
  "disability",
  "health_condition",
  "neurodivergence",
  "other_factor",
  "none",
] as const;

const ANSWER_FIELDS = ["injuries", "injuryDetails", "needs", "needsDetails"] as const;

type Part3Answers = {
  injuries: string[];
  injuryDetails: string;
  needs: string[];
  needsDetails: string;
};

type NormalizedAnswer = { fieldName: keyof Part3Answers; value: string | string[] };

export type Part3CanonicalPayload = {
  formPart: 3;
  formVersion: 1;
  submissionID: string;
  answers: Part3Answers;
  normalizedAnswers: NormalizedAnswer[];
  calculatedFields: Record<string, never>;
  conditionalFollowups: [];
};

export type Part3ValidationResult =
  | { ok: true; payload: Part3CanonicalPayload }
  | { ok: false; code: "INVALID_PART3_CONTRACT" };

const invalid = (): Part3ValidationResult => ({ ok: false, code: "INVALID_PART3_CONTRACT" });

function hasExpectedVersion(value: unknown, expected: number): boolean {
  return value === expected || value === String(expected);
}

function normalizeSelections(value: unknown, allowed: readonly string[]): string[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const selected: string[] = [];
  for (const item of value) {
    if (typeof item !== "string" || !allowed.includes(item)) return undefined;
    if (selected.includes(item)) return undefined;
    selected.push(item);
  }
  return selected;
}

function normalizeOptionalDetail(value: unknown): string | undefined {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") return undefined;
  return value.trim();
}

function hasRequiredLength(value: string, minimum: number, maximum: number): boolean {
  return value.length >= minimum && value.length <= maximum;
}

function hasOnlyActiveAnswerFields(value: Record<string, unknown>): boolean {
  return Object.keys(value).every((key) => (ANSWER_FIELDS as readonly string[]).includes(key));
}

export function normalizeAndValidatePart3Payload(input: unknown): Part3ValidationResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) return invalid();

  const raw = input as Record<string, unknown>;
  if (!hasExpectedVersion(raw.formPart, 3) || !hasExpectedVersion(raw.formVersion, 1)) return invalid();
  if (typeof raw.submissionID !== "string" || !raw.submissionID.trim()) return invalid();

  const rawAnswers = raw.answers;
  if (!rawAnswers || typeof rawAnswers !== "object" || Array.isArray(rawAnswers)) return invalid();
  const answerValues = rawAnswers as Record<string, unknown>;
  if (!hasOnlyActiveAnswerFields(answerValues)) return invalid();

  const injuries = normalizeSelections(answerValues.injuries, INJURY_VALUES);
  const needs = normalizeSelections(answerValues.needs, NEEDS_VALUES);
  if (!injuries || !needs) return invalid();

  const injuryDetails = normalizeOptionalDetail(answerValues.injuryDetails);
  const needsDetails = normalizeOptionalDetail(answerValues.needsDetails);
  if (injuryDetails === undefined || needsDetails === undefined) return invalid();

  if (injuries.includes("no_issues") && injuries.length > 1) return invalid();
  if (needs.includes("none") && needs.length > 1) return invalid();

  const injuryRequiresDetails = injuries.some((value) => value !== "no_issues");
  const needsRequiresDetails = needs.some((value) => value !== "none");
  if (injuryRequiresDetails && !hasRequiredLength(injuryDetails, 30, 350)) return invalid();
  if (needsRequiresDetails && !hasRequiredLength(needsDetails, 30, 500)) return invalid();

  const answers: Part3Answers = {
    injuries,
    injuryDetails: injuryRequiresDetails ? injuryDetails : "",
    needs,
    needsDetails: needsRequiresDetails ? needsDetails : "",
  };

  return {
    ok: true,
    payload: {
      formPart: 3,
      formVersion: 1,
      submissionID: raw.submissionID.trim(),
      answers,
      normalizedAnswers: ANSWER_FIELDS.map((fieldName) => ({ fieldName, value: answers[fieldName] })),
      calculatedFields: {},
      conditionalFollowups: [],
    },
  };
}
