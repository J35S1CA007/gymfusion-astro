import { verifyC0BridgeRequest } from "./c0-bridge-hmac.ts";

export const PART2_SIGNATURE_COORDINATOR_PATH = "/api/internal/part2-signature-coordinator";
const MAX_BODY_BYTES = 64 * 1024;
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$/;
const DIGEST = /^[0-9a-f]{64}$/;
const DOCUMENT_CLASS = "EOI_PART_2_SIGNATURE";
const RESOLUTIONS = new Set(["STORED_CONFIRMED", "NO_STORAGE_CONFIRMED", "UNCERTAIN"]);
const NO_STORAGE_PROOFS = new Set(["PROVEN_ABSENT", "EXACT_OBJECT_ABSENT", "DEFINITIVE_NO_STORAGE"]);

type CoordinatorEnv = { PART2_SIGNATURE_COORDINATOR_SIGNING_SECRET?: string };
type SignatureContext = {
  operationID: string;
  storageReferenceID: string;
  part2SubmissionID: string;
  sourceContentSha256: string;
  documentClass: string;
  FUSIONID: string;
  episodeID: string;
};
type ClaimBody = SignatureContext & {
  operation: "CLAIM";
  generation?: number;
};
type ResolveBody = SignatureContext & {
  operation: "RESOLVE_ATTEMPT";
  generation: number;
  claimID: string;
  resolutionID: string;
  resolution: "STORED_CONFIRMED" | "NO_STORAGE_CONFIRMED" | "UNCERTAIN";
  proofType: string;
};
type EnterWriteBody = SignatureContext & {
  operation: "ENTER_WRITE";
  generation: number;
  claimID: string;
};

const response = (body: unknown, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } });
const text = (value: unknown) => value == null ? "" : String(value).trim();

function validIdentifier(value: unknown) { return IDENTIFIER.test(text(value)); }
function validDigest(value: unknown) { return DIGEST.test(text(value)); }
function validPositiveInteger(value: unknown) { return Number.isSafeInteger(value) && Number(value) > 0; }
function canonical(value: Record<string, unknown>) { return JSON.stringify(value); }

function validClaim(value: unknown): value is ClaimBody {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const body = value as Partial<ClaimBody>;
  return body.operation === "CLAIM"
    && validIdentifier(body.operationID)
    && validIdentifier(body.storageReferenceID)
    && validIdentifier(body.part2SubmissionID)
    && validDigest(body.sourceContentSha256)
    && body.documentClass === DOCUMENT_CLASS
    && validIdentifier(body.FUSIONID)
    && validIdentifier(body.episodeID)
    && (body.generation === undefined || validPositiveInteger(body.generation));
}

function validResolve(value: unknown): value is ResolveBody {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const body = value as Partial<ResolveBody>;
  return body.operation === "RESOLVE_ATTEMPT"
    && validIdentifier(body.operationID)
    && validIdentifier(body.storageReferenceID)
    && validIdentifier(body.part2SubmissionID)
    && validDigest(body.sourceContentSha256)
    && body.documentClass === DOCUMENT_CLASS
    && validIdentifier(body.FUSIONID)
    && validIdentifier(body.episodeID)
    && validPositiveInteger(body.generation)
    && validIdentifier(body.claimID)
    && validIdentifier(body.resolutionID)
    && RESOLUTIONS.has(text(body.resolution))
    && validIdentifier(body.proofType);
}

function validEnterWrite(value: unknown): value is EnterWriteBody {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const body = value as Partial<EnterWriteBody>;
  return body.operation === "ENTER_WRITE"
    && validIdentifier(body.operationID)
    && validIdentifier(body.storageReferenceID)
    && validIdentifier(body.part2SubmissionID)
    && validDigest(body.sourceContentSha256)
    && body.documentClass === DOCUMENT_CLASS
    && validIdentifier(body.FUSIONID)
    && validIdentifier(body.episodeID)
    && validPositiveInteger(body.generation)
    && validIdentifier(body.claimID);
}

function rows(cursor: { toArray?: () => unknown[] }) {
  return typeof cursor?.toArray === "function" ? cursor.toArray() as Record<string, unknown>[] : [];
}

export class Part2SignatureCoordinator {
  private readonly state: DurableObjectState;
  private readonly env: CoordinatorEnv;

  constructor(state: DurableObjectState, env: CoordinatorEnv) {
    this.state = state;
    this.env = env;
    this.state.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS operation_binding (
        operation_id TEXT PRIMARY KEY,
        storage_reference_id TEXT NOT NULL,
        part2_submission_id TEXT NOT NULL,
        source_content_sha256 TEXT NOT NULL,
        document_class TEXT NOT NULL,
        fusion_id TEXT NOT NULL,
        episode_id TEXT NOT NULL,
        active_generation INTEGER NOT NULL
      )
    `);
    this.state.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS generation_history (
        generation INTEGER PRIMARY KEY,
        state TEXT NOT NULL,
        claim_id TEXT,
        claim_fingerprint TEXT,
        resolution_id TEXT,
        resolution_fingerprint TEXT,
        resolution TEXT,
        proof_type TEXT,
        next_generation INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);
  }

  async fetch(request: Request) {
    if (request.method !== "POST") return response({ ok: false, code: "METHOD_NOT_ALLOWED" }, 405);
    const rawBody = await request.text();
    if (rawBody.length > MAX_BODY_BYTES) return response({ ok: false, code: "REQUEST_TOO_LARGE" }, 413);
    let body: unknown;
    try { body = JSON.parse(rawBody); } catch { return response({ ok: false, code: "INVALID_REQUEST" }, 400); }
    const path = new URL(request.url).pathname;
    if (path !== "/claim" && path !== "/resolve" && path !== "/enter-write") return response({ ok: false, code: "NOT_FOUND" }, 404);
    const verification = await this.verify(rawBody, request);
    if (!verification.ok) return response({ ok: false, code: "UNAUTHORIZED" }, 401);
    if (path === "/claim") {
      if (!validClaim(body)) return response({ ok: false, code: "INVALID_REQUEST" }, 400);
      return this.claim(body);
    }
    if (path === "/enter-write") {
      if (!validEnterWrite(body)) return response({ ok: false, code: "INVALID_REQUEST" }, 400);
      return this.enterWrite(body);
    }
    if (!validResolve(body)) return response({ ok: false, code: "INVALID_REQUEST" }, 400);
    return this.resolve(body);
  }

  private async verify(rawBody: string, request: Request) {
    const secret = text(this.env.PART2_SIGNATURE_COORDINATOR_SIGNING_SECRET);
    if (!secret) return { ok: false as const };
    return this.state.blockConcurrencyWhile(async () => verifyC0BridgeRequest({
      secret,
      method: "POST",
      path: PART2_SIGNATURE_COORDINATOR_PATH,
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

  private bindingMatches(row: Record<string, unknown>, body: ClaimBody | ResolveBody | EnterWriteBody) {
    return row.operation_id === body.operationID
      && row.storage_reference_id === body.storageReferenceID
      && row.part2_submission_id === body.part2SubmissionID
      && row.source_content_sha256 === body.sourceContentSha256
      && row.document_class === body.documentClass
      && row.fusion_id === body.FUSIONID
      && row.episode_id === body.episodeID;
  }

  private enterWrite(body: EnterWriteBody) {
    try {
      return response(this.state.storage.transactionSync(() => {
        const operation = rows(this.state.storage.sql.exec("SELECT * FROM operation_binding WHERE operation_id = ?", body.operationID))[0];
        if (!operation || !this.bindingMatches(operation, body)) return { ok: false, code: "CONFLICT" };
        if (Number(operation.active_generation) !== body.generation) return { ok: false, code: "GENERATION_RESOLVED", generation: body.generation };
        const generation = rows(this.state.storage.sql.exec("SELECT * FROM generation_history WHERE generation = ?", body.generation))[0];
        if (!generation || generation.claim_id !== body.claimID) return { ok: false, code: "CONFLICT", generation: body.generation };
        if (generation.state !== "STARTED") {
          return { ok: false, code: generation.state === "WRITE_ENTERED" ? "WRITE_ALREADY_ENTERED" : "GENERATION_RESOLVED", generation: body.generation, state: generation.state };
        }
        this.state.storage.sql.exec("UPDATE generation_history SET state = ?, updated_at = ? WHERE generation = ?", "WRITE_ENTERED", Date.now(), body.generation);
        return {
          ok: true,
          code: "WRITE_GRANTED",
          operationID: body.operationID,
          generation: body.generation,
          claimID: body.claimID,
          storageReferenceID: body.storageReferenceID,
          part2SubmissionID: body.part2SubmissionID,
          sourceContentSha256: body.sourceContentSha256,
        };
      }));
    } catch {
      return response({ ok: false, code: "INTERNAL_ERROR" }, 500);
    }
  }

  private claim(body: ClaimBody) {
    try {
      return response(this.state.storage.transactionSync(() => {
        const operation = rows(this.state.storage.sql.exec("SELECT * FROM operation_binding WHERE operation_id = ?", body.operationID))[0];
        let activeGeneration = body.generation || 1;
        if (!operation) {
          if (activeGeneration !== 1) return { ok: false, code: "CONFLICT" };
          const now = Date.now();
          this.state.storage.sql.exec(
            "INSERT INTO operation_binding (operation_id, storage_reference_id, part2_submission_id, source_content_sha256, document_class, fusion_id, episode_id, active_generation) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            body.operationID, body.storageReferenceID, body.part2SubmissionID, body.sourceContentSha256, body.documentClass, body.FUSIONID, body.episodeID, 1,
          );
          this.state.storage.sql.exec(
            "INSERT INTO generation_history (generation, state, created_at, updated_at) VALUES (?, ?, ?, ?)",
            1, "OPEN", now, now,
          );
          activeGeneration = 1;
        } else {
          if (!this.bindingMatches(operation, body)) return { ok: false, code: "CONFLICT", generation: operation.active_generation };
          activeGeneration = Number(operation.active_generation);
          if (body.generation !== undefined && body.generation !== activeGeneration) {
            const old = rows(this.state.storage.sql.exec("SELECT * FROM generation_history WHERE generation = ?", body.generation))[0];
            return { ok: false, code: old ? "GENERATION_RESOLVED" : "CONFLICT", generation: body.generation, state: old?.state };
          }
        }
        const generation = rows(this.state.storage.sql.exec("SELECT * FROM generation_history WHERE generation = ?", activeGeneration))[0];
        if (!generation) return { ok: false, code: "INTERNAL_ERROR" };
        if (generation.state !== "OPEN") return { ok: false, code: generation.state === "STARTED" ? "ALREADY_STARTED" : "GENERATION_RESOLVED", generation: activeGeneration, claimID: generation.claim_id, state: generation.state };
        const claimID = globalThis.crypto?.randomUUID?.();
        if (!claimID) return { ok: false, code: "INTERNAL_ERROR" };
        const fingerprint = canonical({ operationID: body.operationID, generation: activeGeneration, claimID });
        this.state.storage.sql.exec("UPDATE generation_history SET state = ?, claim_id = ?, claim_fingerprint = ?, updated_at = ? WHERE generation = ?", "STARTED", claimID, fingerprint, Date.now(), activeGeneration);
        return { ok: true, code: "CLAIM_GRANTED", operationID: body.operationID, generation: activeGeneration, claimID };
      }));
    } catch {
      return response({ ok: false, code: "INTERNAL_ERROR" }, 500);
    }
  }

  private resolve(body: ResolveBody) {
    try {
      return response(this.state.storage.transactionSync(() => {
        const operation = rows(this.state.storage.sql.exec("SELECT * FROM operation_binding WHERE operation_id = ?", body.operationID))[0];
        if (!operation || !this.bindingMatches(operation, body)) return { ok: false, code: "CONFLICT" };
        const generation = rows(this.state.storage.sql.exec("SELECT * FROM generation_history WHERE generation = ?", body.generation))[0];
        if (!generation || generation.claim_id !== body.claimID) return { ok: false, code: "CONFLICT" };
        const fingerprint = canonical({ operationID: body.operationID, generation: body.generation, claimID: body.claimID, resolution: body.resolution, proofType: body.proofType });
        if (generation.resolution_fingerprint) {
          if (generation.resolution_fingerprint !== fingerprint) return { ok: false, code: "CONFLICT", generation: body.generation };
          return { ok: true, code: "RESOLVED", generation: body.generation, resolution: generation.resolution, ...(generation.next_generation ? { nextGeneration: generation.next_generation } : {}) };
        }
        if (generation.state !== "STARTED" && generation.state !== "WRITE_ENTERED" && generation.state !== "UNCERTAIN") return { ok: false, code: "CONFLICT", generation: body.generation, state: generation.state };
        if (body.resolution === "NO_STORAGE_CONFIRMED" && generation.state !== "STARTED") return { ok: false, code: "CONFLICT", generation: body.generation, state: generation.state };
        if (body.resolution === "STORED_CONFIRMED" && generation.state !== "WRITE_ENTERED") return { ok: false, code: "CONFLICT", generation: body.generation, state: generation.state };
        if (body.resolution === "NO_STORAGE_CONFIRMED" && !NO_STORAGE_PROOFS.has(body.proofType)) return { ok: false, code: "CONFLICT", generation: body.generation };
        if (body.resolution === "STORED_CONFIRMED" && body.proofType !== "STORED_OBJECT_CONFIRMED") return { ok: false, code: "CONFLICT", generation: body.generation };
        const now = Date.now();
        if (body.resolution === "NO_STORAGE_CONFIRMED") {
          const nextGeneration = body.generation + 1;
          const next = rows(this.state.storage.sql.exec("SELECT * FROM generation_history WHERE generation = ?", nextGeneration))[0];
          if (next) return { ok: false, code: "CONFLICT", generation: body.generation };
          this.state.storage.sql.exec("UPDATE generation_history SET state = ?, resolution_id = ?, resolution_fingerprint = ?, resolution = ?, proof_type = ?, next_generation = ?, updated_at = ? WHERE generation = ?", "NO_STORAGE_CONFIRMED", body.resolutionID, fingerprint, body.resolution, body.proofType, nextGeneration, now, body.generation);
          this.state.storage.sql.exec("INSERT INTO generation_history (generation, state, created_at, updated_at) VALUES (?, ?, ?, ?)", nextGeneration, "OPEN", now, now);
          this.state.storage.sql.exec("UPDATE operation_binding SET active_generation = ? WHERE operation_id = ?", nextGeneration, body.operationID);
          return { ok: true, code: "RESOLVED", generation: body.generation, resolution: body.resolution, nextGeneration };
        }
        this.state.storage.sql.exec("UPDATE generation_history SET state = ?, resolution_id = ?, resolution_fingerprint = ?, resolution = ?, proof_type = ?, updated_at = ? WHERE generation = ?", body.resolution, body.resolutionID, fingerprint, body.resolution, body.proofType, now, body.generation);
        return { ok: true, code: "RESOLVED", generation: body.generation, resolution: body.resolution };
      }));
    } catch {
      return response({ ok: false, code: "INTERNAL_ERROR" }, 500);
    }
  }
}

export const __testHooks = { validClaim, validResolve, validEnterWrite, RESOLUTIONS, NO_STORAGE_PROOFS };
