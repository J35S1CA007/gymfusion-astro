import { env } from "cloudflare:workers";
import { createEmbeddedAuth } from "./better-auth";
import { getActiveIdentityMapping } from "./identity-mapping";
import { buildC0BridgeRequest, MEMBER_PORTAL_SUPPORTING_EVIDENCE_PATH } from "./c0-bridge-hmac";

export const SUPPORTING_EVIDENCE_OPERATIONS = ["READ", "VOLUNTARY_SUBMIT", "RESPOND"] as const;
export type SupportingEvidenceOperation = typeof SUPPORTING_EVIDENCE_OPERATIONS[number];

type Adapters = {
  session?: (request: Request) => Promise<unknown>;
  mapping?: (db: D1Database, userId: string) => Promise<{ fusionId: string; wixMemberId: string } | undefined>;
  fetch?: typeof fetch;
  coordinator?: (body: string) => Promise<Response>;
};
let testAdapters: Adapters = {};

const text = (value: unknown) => value == null ? "" : String(value).trim();

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value as Record<string, unknown>).sort().map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

async function stableIdentifier(prefix: string, values: unknown[]) {
  const canonical = values.map((value) => text(value)).join("\u001f");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
  return `${prefix}-${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

async function mutationIdentity(operation: SupportingEvidenceOperation, mapping: { fusionId: string; wixMemberId: string }, payload: Record<string, unknown>) {
  const requestRef = operation === "RESPOND" ? text(payload.requestRef) : "";
  const idempotencyKey = text(payload.idempotencyKey);
  const fallbackLogicalKey = idempotencyKey || stableStringify({ requestRef, attemptID: payload.attemptID, attachment: payload.attachment, attachments: payload.attachments });
  const evidenceKey = operation === "RESPOND"
    ? requestRef
    : await stableIdentifier("evidence", [mapping.fusionId, "voluntary", fallbackLogicalKey]);
  if (!evidenceKey) return { ok: false as const, code: "SUPPORTING_EVIDENCE_REQUEST_REQUIRED" };
  const operationKey = await stableIdentifier("operation", [operation, mapping.fusionId, mapping.wixMemberId, evidenceKey, fallbackLogicalKey]);
  const commandID = await stableIdentifier("command", [operation, evidenceKey, operationKey]);
  return {
    ok: true as const,
    evidenceKey,
    operationKey,
    commandID,
    payload: operation === "VOLUNTARY_SUBMIT" ? { ...payload, supportingEvidenceID: evidenceKey } : payload,
  };
}

export function setSupportingEvidenceTestAdapters(adapters: Adapters) {
  testAdapters = adapters;
}

export function clearSupportingEvidenceTestAdapters() {
  testAdapters = {};
}

export async function runSupportingEvidenceOperation(request: Request, operation: SupportingEvidenceOperation, payload: unknown = {}) {
  const baseURL = new URL(request.url).origin;
  const db = (env as unknown as { BETTER_AUTH_DB: D1Database }).BETTER_AUTH_DB;
  const auth = testAdapters.session ? null : createEmbeddedAuth(db, baseURL);
  const session = testAdapters.session ? await testAdapters.session(request) : await auth!.api.getSession({ headers: request.headers });
  if (!session) return { ok: false as const, status: 401, code: "UNAUTHENTICATED" };
  const userId = (session as { user?: { id?: string } }).user?.id;
  const mapping = testAdapters.mapping ? await testAdapters.mapping(db, String(userId ?? "")) : await getActiveIdentityMapping(db, String(userId ?? ""));
  if (!mapping) return { ok: false as const, status: 401, code: "UNAUTHENTICATED" };
  if (operation === "READ") {
    const body = JSON.stringify({ operation, correlationId: crypto.randomUUID(), fusionId: mapping.fusionId, wixMemberId: mapping.wixMemberId, payload });
    const bridge = buildC0BridgeRequest({ secret: String((env as { C0_BRIDGE_SIGNING_SECRET?: string }).C0_BRIDGE_SIGNING_SECRET ?? ""), path: MEMBER_PORTAL_SUPPORTING_EVIDENCE_PATH, body });
    const response = await (testAdapters.fetch ?? fetch)(`https://www.gymfusion.com.au${MEMBER_PORTAL_SUPPORTING_EVIDENCE_PATH}`, { method: "POST", body, headers: { ...bridge.headers, "content-type": "application/json" } });
    const result = await response.json().catch(() => null) as { ok?: boolean; code?: string; state?: string; items?: unknown[] } | null;
    if (!response.ok || result?.ok !== true) return { ok: false as const, status: response.status === 401 ? 401 : 502, code: result?.code || (response.status === 401 ? "UNAUTHENTICATED" : "SUPPORTING_EVIDENCE_UNAVAILABLE") };
    return { ok: true as const, status: 200, state: result.state, items: result.items };
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return { ok: false as const, status: 400, code: "INVALID_REQUEST" };
  const identity = await mutationIdentity(operation, mapping, payload as Record<string, unknown>);
  if (!identity.ok) return { ok: false as const, status: 400, code: identity.code };
  const body = JSON.stringify({ operation, commandID: identity.commandID, evidenceKey: identity.evidenceKey, operationKey: identity.operationKey, fusionId: mapping.fusionId, wixMemberId: mapping.wixMemberId, payload: identity.payload });
  const binding = (env as unknown as { SUPPORTING_EVIDENCE_COORDINATOR?: DurableObjectNamespace }).SUPPORTING_EVIDENCE_COORDINATOR;
  const response = testAdapters.coordinator
    ? await testAdapters.coordinator(body)
    : binding
      ? await binding.get(binding.idFromName(`evidence:${identity.evidenceKey}`)).fetch("https://supporting-evidence-coordinator/member-command", { method: "POST", body, headers: { "content-type": "application/json" } })
      : new Response(JSON.stringify({ ok: false, code: "COORDINATOR_UNAVAILABLE" }), { status: 503, headers: { "content-type": "application/json" } });
  const result = await response.json().catch(() => null) as { ok?: boolean; code?: string; state?: string; items?: unknown[]; requestRef?: string; status?: string; closed?: boolean } | null;
  if (!response.ok || result?.ok !== true) return { ok: false as const, status: response.status === 401 ? 401 : response.status === 409 ? 409 : 502, code: result?.code || (response.status === 401 ? "UNAUTHENTICATED" : "SUPPORTING_EVIDENCE_UNAVAILABLE"), state: result?.state };
  return { ok: true as const, status: 200, state: result.state, items: result.items, requestRef: result.requestRef, evidenceStatus: result.status, closed: result.closed };
}
