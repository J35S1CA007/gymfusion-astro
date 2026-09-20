const VALID_VIEWS = new Set([
  "dashboard",
  "submissions",
  "profile",
  "account",
  "eoi",
  "supporting-evidence",
  "profile-change-requests",
]);

const INJURY_VALUES = new Set([
  "previous_recovered",
  "previous_limitation",
  "current_injury",
  "no_issues",
  "chronic_condition",
  "something_else",
]);

const NEEDS_VALUES = new Set([
  "disability",
  "health_condition",
  "neurodivergence",
  "other_factor",
  "none",
]);

export type PortalReadResult = { kind: "authenticated"; view: string; data: Record<string, unknown> } | { kind: "unauthenticated" | "unavailable" };

type Part3Read =
  | { completed: false }
  | {
    completed: true;
    formVersion: 1;
    submittedAt: string;
    answers: {
      injuries: string[];
      injuryDetails: string;
      needs: string[];
      needsDetails: string;
    };
  };

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

function isCanonicalTimestamp(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function selections(value: unknown, allowed: Set<string>): string[] | null {
  if (!Array.isArray(value)) return null;
  const result: string[] = [];
  for (const item of value) {
    if (typeof item !== "string" || !allowed.has(item) || result.includes(item)) return null;
    result.push(item);
  }
  return result;
}

function validatePart3(value: unknown): Part3Read | null {
  if (!isPlainObject(value)) return null;
  if (value.completed === false) return Object.keys(value).length === 1 ? { completed: false } : null;
  if (value.completed !== true || value.formVersion !== 1 || !isCanonicalTimestamp(value.submittedAt) || !isPlainObject(value.answers)) return null;

  const answers = value.answers;
  if (Object.keys(answers).some((key) => !["injuries", "injuryDetails", "needs", "needsDetails"].includes(key)) || Object.keys(answers).length !== 4) return null;
  const injuries = selections(answers.injuries, INJURY_VALUES);
  const needs = selections(answers.needs, NEEDS_VALUES);
  const injuryDetails = typeof answers.injuryDetails === "string" ? answers.injuryDetails.trim() : null;
  const needsDetails = typeof answers.needsDetails === "string" ? answers.needsDetails.trim() : null;
  if (!injuries || !needs || injuryDetails === null || needsDetails === null) return null;
  if (injuries.includes("no_issues") && injuries.length > 1) return null;
  if (needs.includes("none") && needs.length > 1) return null;

  const injuryRequiresDetails = injuries.some((item) => item !== "no_issues");
  const needsRequiresDetails = needs.some((item) => item !== "none");
  if (injuryRequiresDetails ? injuryDetails.length < 30 || injuryDetails.length > 350 : injuryDetails !== "") return null;
  if (needsRequiresDetails ? needsDetails.length < 30 || needsDetails.length > 500 : needsDetails !== "") return null;

  return {
    completed: true,
    formVersion: 1,
    submittedAt: value.submittedAt,
    answers: { injuries, injuryDetails, needs, needsDetails },
  };
}

function validateDashboardPart3(value: unknown): { completed: boolean } | null {
  if (!isPlainObject(value) || Object.keys(value).length !== 1 || typeof value.completed !== "boolean") return null;
  return { completed: value.completed };
}

function validateProfileData(value: Record<string, unknown>): Record<string, unknown> | null {
  if (Object.keys(value).length !== 1 || !isPlainObject(value.profile)) return null;
  const profile = value.profile;
  if (!Object.keys(profile).every((key) => key === "firstName" || key === "lastName")) return null;
  if (typeof profile.firstName !== "string" || !profile.firstName.trim()) return null;
  if ("lastName" in profile && typeof profile.lastName !== "string") return null;
  return value;
}

function validateAccountData(value: Record<string, unknown>): Record<string, unknown> | null {
  if (Object.keys(value).length !== 1 || !isPlainObject(value.account)) return null;
  const account = value.account;
  if (Object.keys(account).length !== 1 || typeof account.displayName !== "string" || !account.displayName.trim()) return null;
  return value;
}

function validateCollectionData(value: Record<string, unknown>): Record<string, unknown> | null {
  if (!Array.isArray(value.items) || !value.items.every(isPlainObject) || typeof value.state !== "string" || !["empty", "complete", "no_active_episode"].includes(value.state)) return null;
  if ("eoiOutcome" in value && value.eoiOutcome !== null && !isPlainObject(value.eoiOutcome)) return null;
  return value;
}

function validateReadPayload(value: unknown, expectedView: string): { view: string; data: Record<string, unknown> } | null {
  if (!VALID_VIEWS.has(expectedView) || !isPlainObject(value) || value.ok !== true || value.view !== expectedView || !isPlainObject(value.data)) return null;
  let data: Record<string, unknown> | null = null;
  if (expectedView === "eoi") {
    const part3 = validatePart3(value.data.part3);
    if (part3 && !(value.data.state === "no_active_episode" && part3.completed !== false)) data = { ...value.data, part3 };
  } else if (expectedView === "dashboard") {
    const part3 = validateDashboardPart3(value.data.part3);
    if (part3 && !(value.data.state === "no_active_episode" && part3.completed !== false)) data = { ...value.data, part3 };
  } else if (expectedView === "profile") {
    data = validateProfileData(value.data);
  } else if (expectedView === "account") {
    data = validateAccountData(value.data);
  } else if (["submissions", "supporting-evidence", "profile-change-requests"].includes(expectedView)) {
    data = validateCollectionData(value.data);
  }
  return data ? { view: expectedView, data } : null;
}

export async function readMemberPortalView(request: Request, serviceBaseUrl: string | undefined, view: string, fetcher: typeof fetch = fetch): Promise<PortalReadResult> {
  const cookie = request.headers.get("cookie")?.trim();
  if (!cookie) return { kind: "unauthenticated" };
  if (!serviceBaseUrl || !VALID_VIEWS.has(view)) return { kind: "unavailable" };
  let endpoint: URL;
  try {
    endpoint = new URL("/api/auth/portal-read", serviceBaseUrl);
  } catch {
    return { kind: "unavailable" };
  }
  try {
    const response = await fetcher(endpoint.href, { method: "POST", headers: { cookie, "content-type": "application/json" }, body: JSON.stringify({ view }), redirect: "manual" });
    if (response.status === 401) return { kind: "unauthenticated" };
    if (response.status !== 200) return { kind: "unavailable" };
    const payload = await response.json() as { authenticated?: unknown; ok?: unknown; view?: unknown; data?: unknown };
    if (payload.authenticated !== true || payload.ok !== true) return { kind: "unavailable" };
    const validated = validateReadPayload(payload, view);
    return validated ? { kind: "authenticated", ...validated } : { kind: "unavailable" };
  } catch {
    return { kind: "unavailable" };
  }
}
