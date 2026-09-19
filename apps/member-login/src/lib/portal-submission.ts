import { env } from "cloudflare:workers";
import { createEmbeddedAuth } from "./better-auth";
import { getActiveIdentityMapping } from "./identity-mapping";
import { buildC0BridgeRequest } from "./c0-bridge-hmac";

const PATH = "/_functions/member_portal_submission_bridge";
const operationByPart = { "2": "EOI_PART_2", "3": "EOI_PART_3", "4": "EOI_PART_4" } as const;

type SubmissionAdapters = {
  session?: (request: Request) => Promise<unknown>;
  mapping?: (db: D1Database, userId: string) => Promise<{ fusionId: string; wixMemberId: string } | undefined>;
  fetch?: typeof fetch;
};

type SubmissionValidation =
  | { ok: true; payload: unknown }
  | { ok: false; status: number; code: string };

type SubmissionOptions = {
  validate?: (payload: unknown) => SubmissionValidation;
};

let testAdapters: SubmissionAdapters = {};

export function setPortalSubmissionTestAdapters(adapters: SubmissionAdapters) {
  testAdapters = adapters;
}

export function clearPortalSubmissionTestAdapters() {
  testAdapters = {};
}

export async function submitPortalPart(request: Request, part: "2" | "3" | "4", payload: unknown, options: SubmissionOptions = {}) {
  const baseURL = new URL(request.url).origin;
  const db = (env as unknown as { BETTER_AUTH_DB: D1Database }).BETTER_AUTH_DB;
  const auth = testAdapters.session ? null : createEmbeddedAuth(db, baseURL);
  const session = testAdapters.session ? await testAdapters.session(request) : await auth!.api.getSession({ headers: request.headers });
  if (!session) return { ok: false as const, status: 401, code: "UNAUTHENTICATED" };
  const userId = (session as { user?: { id?: string } }).user?.id;
  const mapping = testAdapters.mapping ? await testAdapters.mapping(db, String(userId ?? "")) : await getActiveIdentityMapping(db, String(userId ?? ""));
  if (!mapping) return { ok: false as const, status: 401, code: "UNAUTHENTICATED" };
  const validation = options.validate ? options.validate(payload) : { ok: true as const, payload };
  if (!validation.ok) return { ok: false as const, status: validation.status, code: validation.code };
  const body = JSON.stringify({
    operation: operationByPart[part],
    correlationId: crypto.randomUUID(),
    fusionId: mapping.fusionId,
    wixMemberId: mapping.wixMemberId,
    payload: validation.payload,
  });
  const bridge = buildC0BridgeRequest({
    secret: String((env as { C0_BRIDGE_SIGNING_SECRET?: string }).C0_BRIDGE_SIGNING_SECRET ?? ""),
    path: PATH,
    body,
  });
  const response = await (testAdapters.fetch ?? fetch)(`https://www.gymfusion.com.au${PATH}`, { method: "POST", body, headers: { ...bridge.headers, "content-type": "application/json" } });
  const result = await response.json().catch(() => null) as { ok?: boolean; code?: string; submissionID?: string; duplicate?: boolean } | null;
  if (!response.ok || result?.ok !== true || typeof result.submissionID !== "string" || !result.submissionID.trim()) {
    const status = response.status === 400 ? 400 : response.status === 401 ? 401 : 502;
    return { ok: false as const, status, code: result?.code || "SUBMISSION_UNAVAILABLE" };
  }
  return { ok: true as const, status: 200, submissionID: result.submissionID, duplicate: result.duplicate };
}
