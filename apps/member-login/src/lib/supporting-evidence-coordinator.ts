import { buildC0BridgeRequest, verifyC0BridgeRequest } from "./c0-bridge-hmac.ts";

export const SUPPORTING_EVIDENCE_COORDINATOR_CALLBACK_PATH = "/_functions/member_portal_supporting_evidence_coordinator_callback";
export const SUPPORTING_EVIDENCE_COORDINATOR_CALLBACK_URL = `https://www.gymfusion.com.au${SUPPORTING_EVIDENCE_COORDINATOR_CALLBACK_PATH}`;
export const SUPPORTING_EVIDENCE_COORDINATOR_STATES = ["QUEUED", "RUNNING", "COMPLETE", "FAILED", "RECONCILIATION_REQUIRED"] as const;
export type SupportingEvidenceCoordinatorState = typeof SUPPORTING_EVIDENCE_COORDINATOR_STATES[number];

const MUTATIONS = new Set(["VOLUNTARY_SUBMIT", "RESPOND", "STAFF_CREATE", "STAFF_TRANSITION", "RECONCILE"]);
const MEMBER_MUTATIONS = new Set(["VOLUNTARY_SUBMIT", "RESPOND"]);
const STALE_RUNNING_MS = 5 * 60 * 1000;
const MAX_COMMAND_BODY_BYTES = 12 * 1024 * 1024;
const SUPPORTING_EVIDENCE_STATUSES = new Set([
  "Evidence Requested",
  "Submitted in Response",
  "Under Review",
  "Further Evidence Required",
  "Evidence Accepted",
]);

type CoordinatorEnv = {
  C0_BRIDGE_SIGNING_SECRET?: string;
  SUPPORTING_EVIDENCE_COORDINATOR_CALLBACK_URL?: string;
};

type CommandRequest = {
  operation: string;
  commandID: string;
  evidenceKey: string;
  operationKey: string;
  fusionId?: string;
  wixMemberId?: string;
  payload: Record<string, unknown>;
};

type FenceRequest = {
  operation: "FENCE";
  commandID: string;
  evidenceKey: string;
  operationKey: string;
  generation: number;
  phase: string;
};

type ClaimRequest = {
  operation: "CLAIM_ACK";
  claimID: string;
  commandID: string;
  evidenceKey: string;
  operationKey: string;
  generation: number;
  phase: string;
};

type SideEffectClaim = Omit<ClaimRequest, "operation"> & {
  state: "ACQUIRED" | "UNKNOWN" | "CONFIRMED";
};

type Command = Omit<CommandRequest, "payload"> & {
  payload?: Record<string, unknown>;
  requestHash: string;
  state: SupportingEvidenceCoordinatorState;
  generation: number;
  phase: SupportingEvidenceCoordinatorState;
  createdAt: number;
  updatedAt: number;
  sideEffectClaim?: SideEffectClaim;
  result?: { requestRef?: string; status?: string; closed?: boolean };
  code?: string;
};

const text = (value: unknown) => value == null ? "" : String(value).trim();
const json = (value: unknown) => JSON.stringify(value);

function response(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

function sanitizedResult(value: unknown) {
  const result = value as { requestRef?: unknown; status?: unknown; closed?: unknown } | null;
  return {
    ...(text(result?.requestRef) ? { requestRef: text(result?.requestRef) } : {}),
    ...(text(result?.status) ? { status: text(result?.status) } : {}),
    ...(typeof result?.closed === "boolean" ? { closed: result.closed } : {}),
  };
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function validKey(value: string) {
  return /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$/.test(value);
}

function validCommandRequest(value: unknown): value is CommandRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Partial<CommandRequest>;
  const operation = text(candidate.operation);
  const commandID = text(candidate.commandID);
  const evidenceKey = text(candidate.evidenceKey);
  const operationKey = text(candidate.operationKey);
  if (!MUTATIONS.has(operation) || !validKey(commandID) || !validKey(evidenceKey) || !validKey(operationKey) || !candidate.payload || typeof candidate.payload !== "object" || Array.isArray(candidate.payload)) return false;
  if (MEMBER_MUTATIONS.has(operation) && (!text(candidate.fusionId) || !text(candidate.wixMemberId))) return false;
  return true;
}

function validFenceRequest(value: unknown): value is FenceRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Partial<FenceRequest>;
  return candidate.operation === "FENCE"
    && validKey(text(candidate.commandID))
    && validKey(text(candidate.evidenceKey))
    && validKey(text(candidate.operationKey))
    && Number.isSafeInteger(candidate.generation)
    && Number(candidate.generation) > 0
    && MUTATIONS.has(text(candidate.phase));
}

function validClaimRequest(value: unknown): value is ClaimRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Partial<ClaimRequest>;
  return candidate.operation === "CLAIM_ACK"
    && validKey(text(candidate.claimID))
    && validKey(text(candidate.commandID))
    && validKey(text(candidate.evidenceKey))
    && validKey(text(candidate.operationKey))
    && Number.isSafeInteger(candidate.generation)
    && Number(candidate.generation) > 0
    && MUTATIONS.has(text(candidate.phase));
}

export class SupportingEvidenceCoordinator {
  private readonly state: DurableObjectState;
  private readonly env: CoordinatorEnv;

  constructor(state: DurableObjectState, env: CoordinatorEnv) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request) {
    if (request.method !== "POST") return response({ ok: false, code: "METHOD_NOT_ALLOWED" }, 405);
    const rawBody = await request.text();
    if (rawBody.length > MAX_COMMAND_BODY_BYTES) return response({ ok: false, code: "REQUEST_TOO_LARGE" }, 413);
    let body: unknown;
    try { body = JSON.parse(rawBody); } catch { return response({ ok: false, code: "INVALID_REQUEST" }, 400); }

    const pathname = new URL(request.url).pathname;
    if (pathname === "/wix-command" || pathname === "/wix-fence") {
      const verification = await this.verifyWixRequest(rawBody, request);
      if (!verification) return response({ ok: false, code: "UNAUTHORIZED" }, 401);
      if (pathname === "/wix-fence") {
        if (validClaimRequest(body)) return this.authorizeClaim(body);
        if (!validFenceRequest(body)) return response({ ok: false, code: "INVALID_REQUEST" }, 400);
        return this.authorizeFence(body);
      }
    } else if (pathname !== "/member-command") {
      return response({ ok: false, code: "NOT_FOUND" }, 404);
    }
    if (!validCommandRequest(body)) return response({ ok: false, code: "INVALID_REQUEST" }, 400);
    return this.accept(body);
  }

  private async verifyWixRequest(rawBody: string, request: Request) {
    const secret = text(this.env.C0_BRIDGE_SIGNING_SECRET);
    if (!secret) return false;
    return this.state.blockConcurrencyWhile(async () => {
      const nonceStore = {
        has: async (nonce: string) => Boolean(await this.state.storage.get(`nonce:${nonce}`)),
        reserve: async (nonce: string, expiresAt: number) => {
          if (await this.state.storage.get(`nonce:${nonce}`)) return false;
          await this.state.storage.put(`nonce:${nonce}`, expiresAt);
          return true;
        },
      };
      const headers = Object.fromEntries(request.headers.entries());
      const timestamp = headers["x-gf-timestamp"] || "";
      const verification = await verifyC0BridgeRequest({
        secret,
        path: "/api/internal/supporting-evidence-coordinator",
        body: rawBody,
        headers,
        nonceStore,
        now: Date.now(),
      });
      return Boolean(timestamp && verification.ok);
    });
  }

  private async requestHash(command: CommandRequest) {
    return sha256(json({
      operation: command.operation,
      evidenceKey: command.evidenceKey,
      operationKey: text(command.operationKey),
      fusionId: text(command.fusionId),
      wixMemberId: text(command.wixMemberId),
      payload: command.payload,
    }));
  }

  private async accept(request: CommandRequest) {
    const hash = await this.requestHash(request);
    const decision = await this.state.blockConcurrencyWhile(async () => {
      const key = `command:${request.commandID}`;
      const existing = await this.state.storage.get<Command>(key);
      if (existing) {
        if (existing.requestHash !== hash) return { kind: "response" as const, body: { ok: false, code: "COMMAND_ID_CONFLICT" }, status: 409 };
        if (["COMPLETE", "FAILED", "RECONCILIATION_REQUIRED"].includes(existing.state)) return { kind: "response" as const, body: this.publicState(existing), status: existing.state === "COMPLETE" ? 200 : 409 };
        if (existing.state === "RUNNING" && existing.sideEffectClaim?.state === "ACQUIRED") {
          return { kind: "response" as const, body: this.publicState(existing), status: 202 };
        }
        if (existing.state === "RUNNING" && Date.now() - existing.updatedAt >= STALE_RUNNING_MS) {
          const reconciled = { ...existing, state: "RECONCILIATION_REQUIRED" as const, phase: "RECONCILIATION_REQUIRED" as const, code: "STALE_RUNNING_COMMAND", updatedAt: Date.now() };
          await this.state.storage.put(key, reconciled);
          if (text(existing.operationKey)) await this.state.storage.put(`operation:${existing.operationKey}`, { commandID: existing.commandID, generation: existing.generation, state: reconciled.state });
          if ((await this.state.storage.get<string>("activeCommand")) === existing.commandID) await this.state.storage.delete("activeCommand");
          return { kind: "response" as const, body: this.publicState(reconciled), status: 409 };
        }
        return { kind: "response" as const, body: this.publicState(existing), status: 202 };
      }
      const unresolved = [...(await this.state.storage.list<Command>({ prefix: "command:" })).values()]
        .find((command) => command.state === "RECONCILIATION_REQUIRED" && command.operation !== "RECONCILE");
      if (unresolved && request.operation !== "RECONCILE") {
        return { kind: "response" as const, body: this.publicState(unresolved), status: 409 };
      }
      if (request.operation === "RECONCILE" && unresolved && text(request.operationKey) !== text(unresolved.operationKey)) {
        return { kind: "response" as const, body: { ok: false, state: "RECONCILIATION_REQUIRED", code: "RECONCILIATION_OPERATION_MISMATCH" }, status: 409 };
      }
      const operationKey = text(request.operationKey);
      if (operationKey) {
        const operationState = await this.state.storage.get<{ commandID: string; state: SupportingEvidenceCoordinatorState }>(`operation:${operationKey}`);
        const recoveryClaim = operationState?.state === "RECONCILIATION_REQUIRED" && request.operation === "RECONCILE";
        if (operationState && operationState.commandID !== request.commandID && !recoveryClaim) {
          const owner = await this.state.storage.get<Command>(`command:${operationState.commandID}`);
          if (owner?.state === "COMPLETE") return { kind: "response" as const, body: this.publicState(owner), status: 200 };
          if (owner?.state === "RECONCILIATION_REQUIRED") return { kind: "response" as const, body: this.publicState(owner), status: 409 };
          return { kind: "response" as const, body: { ok: false, state: operationState.state, code: "COORDINATOR_BUSY" }, status: 202 };
        }
      }
      const activeID = await this.state.storage.get<string>("activeCommand");
      if (activeID) {
        const active = await this.state.storage.get<Command>(`command:${activeID}`);
        if (active?.state === "RUNNING" && (active.sideEffectClaim?.state === "ACQUIRED" || Date.now() - active.updatedAt < STALE_RUNNING_MS)) {
          const queued: Command = { ...request, requestHash: hash, state: "QUEUED", phase: "QUEUED", generation: 0, createdAt: Date.now(), updatedAt: Date.now() };
          await this.state.storage.put(key, queued);
          return { kind: "response" as const, body: this.publicState(queued), status: 202 };
        }
        if (active?.state === "RUNNING") {
          const reconciled: Command = { ...active, state: "RECONCILIATION_REQUIRED", phase: "RECONCILIATION_REQUIRED", code: "STALE_RUNNING_COMMAND", updatedAt: Date.now() };
          await this.state.storage.put(`command:${activeID}`, reconciled);
          if (text(active.operationKey)) await this.state.storage.put(`operation:${active.operationKey}`, { commandID: active.commandID, generation: active.generation, state: reconciled.state });
          const blocked: Command = { ...request, requestHash: hash, state: "RECONCILIATION_REQUIRED", phase: "RECONCILIATION_REQUIRED", generation: 0, createdAt: Date.now(), updatedAt: Date.now(), code: "ACTIVE_COMMAND_RECONCILIATION_REQUIRED" };
          await this.state.storage.put(key, blocked);
          await this.state.storage.delete("activeCommand");
          return { kind: "response" as const, body: this.publicState(blocked), status: 409 };
        }
        await this.state.storage.delete("activeCommand");
      }
      const running: Command = { ...request, requestHash: hash, state: "RUNNING", phase: "RUNNING", generation: 1, createdAt: Date.now(), updatedAt: Date.now() };
      await this.state.storage.put(key, running);
      await this.state.storage.put("activeCommand", request.commandID);
      if (operationKey) await this.state.storage.put(`operation:${operationKey}`, { commandID: request.commandID, generation: running.generation, state: running.state });
      return { kind: "execute" as const, command: running };
    });
    if (decision.kind === "response") return response(decision.body, decision.status);
    return this.execute(decision.command);
  }

  private publicState(command: Command) {
    if (command.state === "COMPLETE") return { ok: true, state: command.state, ...command.result };
    return { ok: false, state: command.state, ...(command.code ? { code: command.code } : {}), ...(command.state === "QUEUED" || command.state === "RUNNING" ? { code: "COORDINATOR_BUSY" } : {}) };
  }

  private async authorizeFence(request: FenceRequest) {
    const authorized = await this.state.blockConcurrencyWhile(async () => {
      const current = await this.state.storage.get<Command>(`command:${request.commandID}`);
      const activeCommand = await this.state.storage.get<string>("activeCommand");
      return Boolean(current
        && current.state === "RUNNING"
        && activeCommand === request.commandID
        && current.generation === request.generation
        && current.evidenceKey === request.evidenceKey
        && current.operationKey === request.operationKey
        && current.operation === request.phase);
    });
    return authorized
      ? response({ ok: true, state: "RUNNING", commandID: request.commandID, generation: request.generation })
      : response({ ok: false, code: "STALE_COMMAND_GENERATION" }, 409);
  }

  private async authorizeClaim(request: ClaimRequest) {
    const authorized = await this.state.blockConcurrencyWhile(async () => {
      const current = await this.state.storage.get<Command>(`command:${request.commandID}`);
      const activeCommand = await this.state.storage.get<string>("activeCommand");
      const claim = current?.sideEffectClaim;
      return Boolean(current
        && claim?.state === "ACQUIRED"
        && activeCommand === request.commandID
        && current.state === "RUNNING"
        && claim.claimID === request.claimID
        && claim.commandID === request.commandID
        && claim.evidenceKey === request.evidenceKey
        && claim.operationKey === request.operationKey
        && claim.generation === request.generation
        && claim.phase === request.phase
        && current.generation === request.generation
        && current.evidenceKey === request.evidenceKey
        && current.operationKey === request.operationKey
        && current.operation === request.phase);
    });
    return authorized
      ? response({ ok: true, state: "RUNNING", claimState: "ACQUIRED", claimID: request.claimID, commandID: request.commandID, evidenceKey: request.evidenceKey, operationKey: request.operationKey, generation: request.generation, phase: request.phase })
      : response({ ok: false, code: "STALE_COMMAND_GENERATION" }, 409);
  }

  private async claimID(command: Command) {
    return sha256(json({ commandID: command.commandID, evidenceKey: command.evidenceKey, operationKey: command.operationKey, generation: command.generation, phase: command.operation }));
  }

  private async acquireSideEffectClaim(command: Command) {
    const claimID = await this.claimID(command);
    return this.state.blockConcurrencyWhile(async () => {
      const key = `command:${command.commandID}`;
      const current = await this.state.storage.get<Command>(key);
      const activeCommand = await this.state.storage.get<string>("activeCommand");
      if (!current || current.state !== "RUNNING" || activeCommand !== command.commandID || current.generation !== command.generation) {
        return { ok: false as const, code: "STALE_COMMAND_GENERATION" };
      }
      if (current.sideEffectClaim?.state === "UNKNOWN") return { ok: false as const, code: "UNKNOWN_RESULT" };
      if (current.sideEffectClaim?.state === "ACQUIRED") {
        if (current.sideEffectClaim.claimID !== claimID) return { ok: false as const, code: "STALE_COMMAND_GENERATION" };
        return { ok: true as const, command: current, claim: current.sideEffectClaim };
      }
      const claim: SideEffectClaim = { claimID, commandID: command.commandID, evidenceKey: command.evidenceKey, operationKey: command.operationKey, generation: command.generation, phase: command.operation, state: "ACQUIRED" };
      const claimed = { ...current, sideEffectClaim: claim, updatedAt: Date.now() };
      await this.state.storage.put(key, claimed);
      return { ok: true as const, command: claimed, claim };
    });
  }

  private expectedStatus(command: Command) {
    if (command.operation === "VOLUNTARY_SUBMIT" || command.operation === "RESPOND") return "Submitted in Response";
    if (command.operation === "STAFF_CREATE") return "Evidence Requested";
    if (command.operation === "STAFF_TRANSITION") return text(command.payload?.toStatus);
    if (command.operation === "RECONCILE" && ["STAFF_CREATE", "STAFF_TRANSITION"].includes(text(command.payload?.recoveryOperation))) {
      return text(command.payload?.toStatus) || (text(command.payload?.recoveryOperation) === "STAFF_CREATE" ? "Evidence Requested" : "");
    }
    return "";
  }

  private validCallbackResult(command: Command, result: unknown): result is { ok: true; requestRef: string; status: string; operationKey: string; closed: boolean; attemptID?: string; fileSlotID?: string; fileSlotIDs?: string[] } {
    if (!result || typeof result !== "object" || Array.isArray(result)) return false;
    const candidate = result as Record<string, unknown>;
    const status = text(candidate.status);
    if (candidate.ok !== true || text(candidate.requestRef) !== command.evidenceKey || !SUPPORTING_EVIDENCE_STATUSES.has(status) || text(candidate.operationKey) !== command.operationKey || typeof candidate.closed !== "boolean") return false;
    const expectedStatus = this.expectedStatus(command);
    if (expectedStatus && status !== expectedStatus) return false;
    if (candidate.closed !== (status === "Evidence Accepted")) return false;
    const storageCommand = command.operation === "VOLUNTARY_SUBMIT" || command.operation === "RESPOND" || (command.operation === "RECONCILE" && text(command.payload?.recoveryOperation) !== "STAFF_CREATE" && text(command.payload?.recoveryOperation) !== "STAFF_TRANSITION");
    if (!storageCommand) return true;
    const slotIDs = Array.isArray(candidate.fileSlotIDs) ? candidate.fileSlotIDs.filter((value) => text(value)) : [];
    if (!text(candidate.attemptID) || !slotIDs.length) return false;
    if (text(command.payload?.attemptID) && text(candidate.attemptID) !== text(command.payload?.attemptID)) return false;
    const expectedSlots = [
      text(command.payload?.fileSlotID),
      ...(Array.isArray(command.payload?.attachments) ? command.payload.attachments.map((file) => text(file?.fileSlotID)) : []),
      text((command.payload?.attachment as Record<string, unknown> | undefined)?.fileSlotID),
    ].filter(Boolean);
    return expectedSlots.every((slotID) => slotIDs.includes(slotID)) && (!text(command.payload?.fileSlotID) || text(candidate.fileSlotID) === text(command.payload?.fileSlotID) || slotIDs.includes(text(command.payload?.fileSlotID)));
  }

  private async execute(initialCommand: Command) {
    const claimResult = await this.acquireSideEffectClaim(initialCommand);
    if (!claimResult.ok) {
      const current = await this.state.storage.get<Command>(`command:${initialCommand.commandID}`);
      return response(current ? this.publicState(current) : { ok: false, code: claimResult.code }, 409);
    }
    const command = claimResult.command;
    const claim = claimResult.claim;
    let next: Command;
    try {
      const callbackURL = text(this.env.SUPPORTING_EVIDENCE_COORDINATOR_CALLBACK_URL) || SUPPORTING_EVIDENCE_COORDINATOR_CALLBACK_URL;
      if (!command.payload) return response({ ok: false, code: "COMMAND_PAYLOAD_UNAVAILABLE" }, 409);
      const callbackBody = json({
        operation: command.operation,
        commandID: command.commandID,
        evidenceKey: command.evidenceKey,
        operationKey: command.operationKey,
        ...(text(command.fusionId) ? { fusionId: command.fusionId } : {}),
        ...(text(command.wixMemberId) ? { wixMemberId: command.wixMemberId } : {}),
        coordinatorClaim: claim,
        coordinatorFence: {
          commandID: command.commandID,
          evidenceKey: command.evidenceKey,
          operationKey: command.operationKey,
          generation: command.generation,
          phase: command.operation,
        },
        payload: command.payload,
      });
      const signed = buildC0BridgeRequest({ secret: text(this.env.C0_BRIDGE_SIGNING_SECRET), path: SUPPORTING_EVIDENCE_COORDINATOR_CALLBACK_PATH, body: callbackBody });
      const resultResponse = await fetch(callbackURL, { method: "POST", body: callbackBody, headers: { ...signed.headers, "content-type": "application/json" } });
      const result = await resultResponse.json().catch(() => null) as { ok?: boolean; code?: string; requestRef?: string; status?: string; operationKey?: string; closed?: boolean; attemptID?: string; fileSlotID?: string; fileSlotIDs?: string[] } | null;
      if (resultResponse.ok && this.validCallbackResult(command, result)) {
        next = { ...command, state: "COMPLETE", phase: "COMPLETE", sideEffectClaim: { ...claim, state: "CONFIRMED" }, result: sanitizedResult(result), updatedAt: Date.now() };
      } else {
        const code = resultResponse.ok ? "CALLBACK_RESULT_INVALID" : text(result?.code) || "COORDINATOR_CALLBACK_FAILURE";
        next = { ...command, state: "RECONCILIATION_REQUIRED", phase: "RECONCILIATION_REQUIRED", sideEffectClaim: { ...claim, state: "UNKNOWN" }, code, updatedAt: Date.now() };
      }
    } catch {
      next = { ...command, state: "RECONCILIATION_REQUIRED", phase: "RECONCILIATION_REQUIRED", sideEffectClaim: { ...claim, state: "UNKNOWN" }, code: "COORDINATOR_UNAVAILABLE", updatedAt: Date.now() };
    }
    const finalized = await this.state.blockConcurrencyWhile(async () => {
      const current = await this.state.storage.get<Command>(`command:${command.commandID}`);
      if (!current || current.state !== "RUNNING" || current.generation !== command.generation) return false;
      const persisted: Command = next.state === "COMPLETE" ? { ...next, payload: undefined } : next;
      await this.state.storage.put(`command:${command.commandID}`, persisted);
      if ((await this.state.storage.get<string>("activeCommand")) === command.commandID) await this.state.storage.delete("activeCommand");
      if (text(command.operationKey)) {
        const operationState = await this.state.storage.get<{ commandID: string; generation: number }>(`operation:${command.operationKey}`);
        if (operationState?.commandID === command.commandID && operationState.generation === command.generation) await this.state.storage.put(`operation:${command.operationKey}`, { ...operationState, state: next.state });
      }
      return true;
    });
    if (finalized) this.startQueueDrain();
    return response(finalized ? this.publicState(next) : { ok: false, code: "STALE_COMMAND_GENERATION" }, finalized && next.state === "COMPLETE" ? 200 : 409);
  }

  private startQueueDrain() {
    const task = this.drainQueue();
    if (typeof this.state.waitUntil === "function") this.state.waitUntil(task);
  }

  private async drainQueue() {
    const next = await this.state.blockConcurrencyWhile(async () => {
      if (await this.state.storage.get<string>("activeCommand")) return null;
      const entries = [...(await this.state.storage.list<Command>({ prefix: "command:" })).values()]
        .filter((command) => command.state === "QUEUED")
        .sort((a, b) => a.createdAt - b.createdAt);
      const command = entries[0];
      if (!command) return null;
      const unresolved = [...(await this.state.storage.list<Command>({ prefix: "command:" })).values()]
        .find((candidate) => candidate.state === "RECONCILIATION_REQUIRED" && candidate.operation !== "RECONCILE");
      if (unresolved && command.operation !== "RECONCILE") {
        await this.state.storage.put(`command:${command.commandID}`, { ...command, state: "RECONCILIATION_REQUIRED", phase: "RECONCILIATION_REQUIRED", code: "ACTIVE_OPERATION_RECONCILIATION_REQUIRED", updatedAt: Date.now() });
        return null;
      }
      const running = { ...command, state: "RUNNING" as const, phase: "RUNNING" as const, generation: command.generation + 1, updatedAt: Date.now() };
      await this.state.storage.put(`command:${command.commandID}`, running);
      await this.state.storage.put("activeCommand", command.commandID);
      if (text(command.operationKey)) await this.state.storage.put(`operation:${command.operationKey}`, { commandID: command.commandID, generation: running.generation, state: running.state });
      return running;
    });
    if (next) await this.execute(next);
  }
}
