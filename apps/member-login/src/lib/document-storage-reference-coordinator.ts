import { buildC0BridgeRequest, verifyC0BridgeRequest } from "./c0-bridge-hmac.ts";

export const DOCUMENT_STORAGE_REFERENCE_COORDINATOR_PATH = "/api/internal/document-storage-reference-coordinator";
export const DOCUMENT_STORAGE_REFERENCE_COORDINATOR_CALLBACK_PATH = "/_functions/member_portal_document_storage_reference_coordinator_callback";
export const DOCUMENT_STORAGE_REFERENCE_COORDINATOR_CALLBACK_URL = `https://www.gymfusion.com.au${DOCUMENT_STORAGE_REFERENCE_COORDINATOR_CALLBACK_PATH}`;

const MAX_BODY_BYTES = 1024 * 1024;
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$/;
const DIGEST = /^[0-9a-f]{64}$/;
const DOCUMENT_CLASSES = new Set(["EOI_PART_2_SIGNATURE", "EOI_SUPPORTING_EVIDENCE"]);
const STATUSES = new Set(["PENDING", "STORED", "LINKED", "RECONCILIATION_REQUIRED", "FAILED"]);
const TRANSITIONS = new Set(["STORED", "LINKED", "RECONCILIATION_REQUIRED", "FAILED"]);

type CoordinatorEnv = {
  C0_BRIDGE_SIGNING_SECRET?: string;
  DOCUMENT_STORAGE_REFERENCE_COORDINATOR_CALLBACK_URL?: string;
};

type Context = Record<string, unknown> & {
  _id: string;
  operationID: string;
  documentClass: string;
  FUSIONID: string;
  episodeID: string;
};

type Mutation = {
  kind: "CREATE_PENDING" | "TRANSITION";
  candidate?: Record<string, unknown>;
  toStatus?: string;
  storageMetadata?: Record<string, unknown>;
  linkageConfirmed?: boolean;
  expectedLifecycleStatus?: string;
  lastErrorCode?: string;
  now?: string;
};

type StoredState = {
  phase: "ACTIVE_PRE_ENTRY" | "MUTATION_ENTERED" | "COMMITTED_CONFIRMED" | "UNKNOWN_MUTATION" | "ABORTED_BEFORE_MUTATION";
  generation: number;
  commandID: string;
  storageReferenceID: string;
  operationID: string;
  requestDigest: string;
  context: Context;
  mutation: Mutation;
  mutationEntryID?: string;
  dispatching?: boolean;
  result?: Record<string, unknown>;
};

const text = (value: unknown) => value == null ? "" : String(value).trim();
const response = (body: unknown, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } });

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).filter((key) => object[key] !== undefined).sort().map((key) => `${JSON.stringify(key)}:${canonical(object[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

async function digest(value: unknown) {
  const bytes = new TextEncoder().encode(canonical(value));
  const result = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(result), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function validContext(value: unknown): value is Context {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const context = value as Partial<Context>;
  return IDENTIFIER.test(text(context._id))
    && IDENTIFIER.test(text(context.operationID))
    && IDENTIFIER.test(text(context.storageProvider))
    && IDENTIFIER.test(text(context.storageDriveKey))
    && DOCUMENT_CLASSES.has(text(context.documentClass))
    && IDENTIFIER.test(text(context.FUSIONID))
    && IDENTIFIER.test(text(context.episodeID));
}

function validMutation(value: unknown): value is Mutation {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const mutation = value as Partial<Mutation>;
  if (mutation.kind === "CREATE_PENDING") return Boolean(mutation.candidate && typeof mutation.candidate === "object" && !Array.isArray(mutation.candidate));
  return mutation.kind === "TRANSITION"
    && TRANSITIONS.has(text(mutation.toStatus))
    && (mutation.expectedLifecycleStatus === undefined || STATUSES.has(text(mutation.expectedLifecycleStatus)))
    && (mutation.linkageConfirmed === undefined || typeof mutation.linkageConfirmed === "boolean")
    && (mutation.storageMetadata === undefined || (typeof mutation.storageMetadata === "object" && !Array.isArray(mutation.storageMetadata)));
}

function sameRequest(state: StoredState, body: Record<string, unknown>) {
  return state.commandID === text(body.commandID)
    && state.storageReferenceID === text(body.storageReferenceID)
    && state.operationID === text(body.operationID)
    && state.requestDigest === text(body.requestDigest);
}

function publicState(state: StoredState) {
  if (state.phase === "COMMITTED_CONFIRMED") return { ok: true, state: state.phase, ...state.result };
  return { ok: false, state: state.phase, code: state.phase === "UNKNOWN_MUTATION" ? "UNKNOWN_MUTATION" : state.phase === "MUTATION_ENTERED" ? "MUTATION_IN_PROGRESS" : "COORDINATOR_BUSY" };
}

function matchingRecord(state: StoredState, proof: unknown) {
  if (!proof || typeof proof !== "object" || Array.isArray(proof)) return false;
  const candidate = proof as { record?: unknown };
  if (!candidate.record || typeof candidate.record !== "object" || Array.isArray(candidate.record)) return false;
  const record = candidate.record as Record<string, unknown>;
  if (record._id !== state.storageReferenceID || record.operationID !== state.operationID) return false;
  for (const field of ["storageProvider", "storageDriveKey", "documentClass", "FUSIONID", "episodeID", "supportingEvidenceID", "attemptID", "fileSlotID", "part2SubmissionID", "sourceContentSha256"]) {
    if (state.context[field] !== undefined && record[field] !== state.context[field]) return false;
  }
  if (state.mutation.kind === "CREATE_PENDING") {
    if (record.lifecycleStatus !== "PENDING") return false;
    for (const [field, value] of Object.entries(state.mutation.candidate || {})) {
      if (["_createdDate", "_updatedDate", "_owner"].includes(field)) continue;
      if (value !== undefined && record[field] !== value) return false;
    }
    return true;
  }
  if (record.lifecycleStatus !== state.mutation.toStatus) return false;
  for (const [field, value] of Object.entries(state.mutation.storageMetadata || {})) {
    if (value !== undefined && record[field] !== value) return false;
  }
  return true;
}

export class DocumentStorageReferenceCoordinator {
  private readonly state: DurableObjectState;
  private readonly env: CoordinatorEnv;

  constructor(state: DurableObjectState, env: CoordinatorEnv) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request) {
    if (request.method !== "POST") return response({ ok: false, code: "METHOD_NOT_ALLOWED" }, 405);
    const rawBody = await request.text();
    if (rawBody.length > MAX_BODY_BYTES) return response({ ok: false, code: "REQUEST_TOO_LARGE" }, 413);
    let body: unknown;
    try { body = JSON.parse(rawBody); } catch { return response({ ok: false, code: "INVALID_REQUEST" }, 400); }
    const verification = await this.verify(rawBody, request);
    if (!verification.ok) return response({ ok: false, code: "UNAUTHORIZED" }, 401);
    const path = new URL(request.url).pathname;
    if (path === "/start") return this.start(body);
    if (path === "/enter") return this.enter(body);
    if (path === "/resolve") return this.resolve(body);
    return response({ ok: false, code: "NOT_FOUND" }, 404);
  }

  private async verify(rawBody: string, request: Request) {
    const secret = text(this.env.C0_BRIDGE_SIGNING_SECRET);
    if (!secret) return { ok: false as const };
    return this.state.blockConcurrencyWhile(async () => verifyC0BridgeRequest({
      secret,
      method: "POST",
      path: DOCUMENT_STORAGE_REFERENCE_COORDINATOR_PATH,
      body: rawBody,
      headers: Object.fromEntries(request.headers.entries()),
      nonceStore: {
        has: async (nonce: string) => Boolean(await this.state.storage.get(`nonce:${nonce}`)),
        reserve: async (nonce: string, expiresAt: number) => {
          if (await this.state.storage.get(`nonce:${nonce}`)) return false;
          await this.state.storage.put(`nonce:${nonce}`, expiresAt);
          return true;
        },
      },
    }));
  }

  private validStart(body: unknown): body is Record<string, unknown> & { context: Context; mutation: Mutation; requestDigest: string } {
    if (!body || typeof body !== "object" || Array.isArray(body)) return false;
    const candidate = body as Record<string, unknown>;
    return candidate.operation === "START"
      && IDENTIFIER.test(text(candidate.commandID))
      && IDENTIFIER.test(text(candidate.storageReferenceID))
      && IDENTIFIER.test(text(candidate.operationID))
      && DIGEST.test(text(candidate.requestDigest))
      && validContext(candidate.context)
      && (candidate.context as Context)._id === text(candidate.storageReferenceID)
      && (candidate.context as Context).operationID === text(candidate.operationID)
      && validMutation(candidate.mutation);
  }

  private validEnterOrResolve(body: unknown, operation: string): body is Record<string, unknown> {
    if (!body || typeof body !== "object" || Array.isArray(body)) return false;
    const candidate = body as Record<string, unknown>;
    return candidate.operation === operation
      && IDENTIFIER.test(text(candidate.commandID))
      && Number.isSafeInteger(candidate.generation) && Number(candidate.generation) > 0
      && IDENTIFIER.test(text(candidate.storageReferenceID))
      && IDENTIFIER.test(text(candidate.operationID))
      && DIGEST.test(text(candidate.requestDigest));
  }

  private async start(body: unknown) {
    if (!this.validStart(body)) return response({ ok: false, code: "INVALID_REQUEST" }, 400);
    const requestDigest = await digest({ storageReferenceID: body.storageReferenceID, operationID: body.operationID, mutation: body.mutation });
    if (requestDigest !== body.requestDigest) return response({ ok: false, code: "REQUEST_DIGEST_INVALID" }, 400);
    const decision = await this.state.blockConcurrencyWhile(async () => {
      const current = await this.state.storage.get<StoredState>("state");
      if (current?.phase === "UNKNOWN_MUTATION") return { kind: "response" as const, body: publicState(current), status: 409 };
      if (current && sameRequest(current, body)) {
        if (current.phase === "COMMITTED_CONFIRMED" || current.phase === "ABORTED_BEFORE_MUTATION") return { kind: "response" as const, body: publicState(current), status: current.phase === "COMMITTED_CONFIRMED" ? 200 : 409 };
        if (current.dispatching) return { kind: "response" as const, body: publicState(current), status: 409 };
        const replay = { ...current, dispatching: true };
        await this.state.storage.put("state", replay);
        return { kind: "execute" as const, state: replay };
      }
      if (current && (current.phase === "ACTIVE_PRE_ENTRY" || current.phase === "MUTATION_ENTERED")) return { kind: "response" as const, body: { ok: false, code: "REFERENCE_MUTATION_BUSY" }, status: 409 };
      const next: StoredState = {
        phase: "ACTIVE_PRE_ENTRY",
        generation: (current?.generation || 0) + 1,
        commandID: text(body.commandID),
        storageReferenceID: text(body.storageReferenceID),
        operationID: text(body.operationID),
        requestDigest: text(body.requestDigest),
        context: body.context,
        mutation: body.mutation,
        dispatching: true,
      };
      await this.state.storage.put("state", next);
      return { kind: "execute" as const, state: next };
    });
    if (decision.kind === "response") return response(decision.body, decision.status);
    return this.execute(decision.state);
  }

  private async enter(body: unknown) {
    if (!this.validEnterOrResolve(body, "ENTER_MUTATION")) return response({ ok: false, code: "INVALID_REQUEST" }, 400);
    const result = await this.state.blockConcurrencyWhile(async () => {
      const current = await this.state.storage.get<StoredState>("state");
      if (!current || !sameRequest(current, body) || current.generation !== body.generation) return { ok: false, code: "STALE_COORDINATOR_COMMAND" };
      if (current.phase !== "ACTIVE_PRE_ENTRY") return { ok: false, code: current.phase === "MUTATION_ENTERED" ? "MUTATION_ALREADY_ENTERED" : current.phase === "UNKNOWN_MUTATION" ? "UNKNOWN_MUTATION" : "MUTATION_NOT_AVAILABLE" };
      const mutationEntryID = crypto.randomUUID();
      const entered = { ...current, phase: "MUTATION_ENTERED" as const, mutationEntryID };
      await this.state.storage.put("state", entered);
      return { ok: true, code: "MUTATION_GRANTED", commandID: current.commandID, generation: current.generation, storageReferenceID: current.storageReferenceID, operationID: current.operationID, requestDigest: current.requestDigest, mutationEntryID };
    });
    return response(result, result.ok ? 200 : 409);
  }

  private async resolve(body: unknown) {
    if (!this.validEnterOrResolve(body, "RESOLVE") || !["COMMITTED_CONFIRMED", "ABORTED_BEFORE_MUTATION"].includes(text(body.resolution))) return response({ ok: false, code: "INVALID_REQUEST" }, 400);
    const result = await this.state.blockConcurrencyWhile(async () => {
      const current = await this.state.storage.get<StoredState>("state");
      if (!current || !sameRequest(current, body) || current.generation !== body.generation) return { ok: false, code: "STALE_COORDINATOR_COMMAND" };
      if (body.resolution === "ABORTED_BEFORE_MUTATION" && (current.phase !== "ACTIVE_PRE_ENTRY" || current.dispatching === true || (body.proof as { updateInvoked?: unknown } | undefined)?.updateInvoked !== false)) return { ok: false, code: "ABORT_NOT_PROVEN" };
      if (body.resolution === "COMMITTED_CONFIRMED" && current.phase !== "MUTATION_ENTERED" && current.phase !== "UNKNOWN_MUTATION") return { ok: false, code: "COMMIT_NOT_AVAILABLE" };
      const proof = body.proof as { record?: unknown } | undefined;
      if (body.resolution === "COMMITTED_CONFIRMED" && (!proof || !matchingRecord(current, proof))) return { ok: false, code: "COMMIT_PROOF_REQUIRED" };
      const next = body.resolution === "COMMITTED_CONFIRMED"
        ? { ...current, phase: "COMMITTED_CONFIRMED" as const, result: { storageReferenceID: current.storageReferenceID, operationID: current.operationID, requestDigest: current.requestDigest, record: proof?.record, mutationPerformed: true }, dispatching: false }
        : { ...current, phase: "ABORTED_BEFORE_MUTATION" as const, result: { storageReferenceID: current.storageReferenceID, operationID: current.operationID, requestDigest: current.requestDigest, code: "ABORTED_BEFORE_MUTATION" }, dispatching: false };
      await this.state.storage.put("state", next);
      return { ...publicState(next), ok: true, code: "RESOLVED" };
    });
    return response(result, result.ok ? 200 : 409);
  }

  private async execute(state: StoredState) {
    let callbackResult: Record<string, unknown> | null = null;
    let callbackOk = false;
    try {
      const callbackURL = text(this.env.DOCUMENT_STORAGE_REFERENCE_COORDINATOR_CALLBACK_URL) || DOCUMENT_STORAGE_REFERENCE_COORDINATOR_CALLBACK_URL;
      const callbackBody = JSON.stringify({ operation: "MUTATE", commandID: state.commandID, generation: state.generation, storageReferenceID: state.storageReferenceID, operationID: state.operationID, requestDigest: state.requestDigest, context: state.context, mutation: state.mutation });
      const signed = buildC0BridgeRequest({ secret: text(this.env.C0_BRIDGE_SIGNING_SECRET), path: DOCUMENT_STORAGE_REFERENCE_COORDINATOR_CALLBACK_PATH, body: callbackBody });
      const resultResponse = await fetch(callbackURL, { method: "POST", body: callbackBody, headers: { ...signed.headers, "content-type": "application/json" } });
      callbackResult = await resultResponse.json().catch(() => null) as Record<string, unknown> | null;
      callbackOk = resultResponse.ok;
    } catch {
      callbackResult = null;
    }
    const finalized = await this.state.blockConcurrencyWhile(async () => {
      const current = await this.state.storage.get<StoredState>("state");
      if (!current || current.commandID !== state.commandID || current.generation !== state.generation) return { ok: false as const, stale: true };
      const exact = callbackResult
        && callbackResult.storageReferenceID === state.storageReferenceID
        && callbackResult.operationID === state.operationID
        && callbackResult.requestDigest === state.requestDigest;
      if (callbackOk && callbackResult?.ok === true && callbackResult.outcome === "COMMITTED" && exact && callbackResult.record && typeof callbackResult.record === "object") {
        const mutationPerformed = callbackResult.mutationPerformed === true;
        if (current.phase !== "MUTATION_ENTERED" && !(current.phase === "ACTIVE_PRE_ENTRY" && mutationPerformed === false)) return { ok: false as const, stale: false, code: "MUTATION_STATE_INVALID" };
        const next = { ...current, phase: "COMMITTED_CONFIRMED" as const, result: { storageReferenceID: state.storageReferenceID, operationID: state.operationID, requestDigest: state.requestDigest, record: callbackResult.record, mutationPerformed }, dispatching: false };
        await this.state.storage.put("state", next);
        return { ok: true as const, state: next };
      }
      if (callbackResult?.outcome === "PRE_MUTATION_REJECTED" && exact && current.phase === "ACTIVE_PRE_ENTRY") {
        const next = { ...current, phase: "ABORTED_BEFORE_MUTATION" as const, result: { storageReferenceID: state.storageReferenceID, operationID: state.operationID, requestDigest: state.requestDigest, code: text(callbackResult.code) || "PRE_MUTATION_REJECTED" }, dispatching: false };
        await this.state.storage.put("state", next);
        return { ok: false as const, stale: false, state: next };
      }
      const next = { ...current, phase: "UNKNOWN_MUTATION" as const, result: { storageReferenceID: state.storageReferenceID, operationID: state.operationID, requestDigest: state.requestDigest, code: "UNKNOWN_MUTATION" }, dispatching: false };
      await this.state.storage.put("state", next);
      return { ok: false as const, stale: false, state: next };
    });
    if (finalized.stale) return response({ ok: false, code: "STALE_COORDINATOR_COMMAND" }, 409);
    if (finalized.ok) return response(publicState(finalized.state), 200);
    return response(finalized.state ? publicState(finalized.state) : { ok: false, code: finalized.code || "UNKNOWN_MUTATION" }, 409);
  }
}

export const __testHooks = { canonical, digest, validContext, validMutation };
