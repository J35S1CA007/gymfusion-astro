export const PART_2_SUBMISSION_ID_PATTERN = /^eoi-p2-submission-[0-9a-f]{64}$/;

export type Part2SuccessResult = {
  ok: true;
  submissionID: string;
  duplicate?: boolean;
};

export type Part2ProxyResult = {
  status: number;
  body: Part2SuccessResult | { ok: false; code: string };
};

export function isCanonicalPart2SubmissionID(value: unknown): value is string {
  return typeof value === "string" && PART_2_SUBMISSION_ID_PATTERN.test(value.trim());
}

export function validatePart2Success(value: unknown): Part2SuccessResult | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const result = value as { ok?: unknown; submissionID?: unknown; duplicate?: unknown };
  if (result.ok !== true || !isCanonicalPart2SubmissionID(result.submissionID)) return null;
  return {
    ok: true,
    submissionID: result.submissionID.trim(),
    ...(typeof result.duplicate === "boolean" ? { duplicate: result.duplicate } : {}),
  };
}

export function normalizePart2ProxyResult(status: number, value: unknown): Part2ProxyResult {
  if (status < 200 || status >= 300) {
    const code = value && typeof value === "object" && !Array.isArray(value)
      && typeof (value as { code?: unknown }).code === "string"
      && (value as { code: string }).code.trim()
      ? (value as { code: string }).code.trim()
      : "SUBMISSION_UNAVAILABLE";
    return { status, body: { ok: false, code } };
  }
  const success = validatePart2Success(value);
  return success
    ? { status: 200, body: success }
    : { status: 502, body: { ok: false, code: "SUBMISSION_UNAVAILABLE" } };
}

export function hasCompletedPart2(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const parts = (value as { parts?: unknown }).parts;
  return Array.isArray(parts) && parts.some((part) => (
    part && typeof part === "object" && !Array.isArray(part)
      && (part as { part?: unknown }).part === "2"
      && (part as { completed?: unknown }).completed === true
  ));
}
