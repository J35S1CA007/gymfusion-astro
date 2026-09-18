import assert from "node:assert/strict";
import test from "node:test";
import { Part2SignatureCoordinator, PART2_SIGNATURE_COORDINATOR_PATH } from "../src/lib/part2-signature-coordinator.ts";
import { buildC0BridgeRequest } from "../src/lib/c0-bridge-hmac.ts";

type Row = Record<string, unknown>;

class FakeSql {
  operations: Row[] = [];
  generations: Row[] = [];
  exec(query: string, ...args: unknown[]) {
    const normalized = query.replace(/\s+/g, " ").trim();
    if (normalized.startsWith("CREATE TABLE")) return { toArray: () => [] };
    if (normalized.startsWith("SELECT * FROM operation_binding")) return { toArray: () => this.operations.filter((row) => row.operation_id === args[0]) };
    if (normalized.startsWith("SELECT * FROM generation_history")) return { toArray: () => this.generations.filter((row) => row.generation === args[0]) };
    if (normalized.startsWith("INSERT INTO operation_binding")) {
      this.operations.push({ operation_id: args[0], storage_reference_id: args[1], part2_submission_id: args[2], source_content_sha256: args[3], document_class: args[4], fusion_id: args[5], episode_id: args[6], active_generation: args[7] });
      return { toArray: () => [] };
    }
    if (normalized.startsWith("INSERT INTO generation_history")) {
      this.generations.push({ generation: args[0], state: args[1], created_at: args[2], updated_at: args[3] });
      return { toArray: () => [] };
    }
    if (normalized.startsWith("UPDATE generation_history SET state = ?, claim_id")) {
      const row = this.generations.find((entry) => entry.generation === args[4]);
      if (row) Object.assign(row, { state: args[0], claim_id: args[1], claim_fingerprint: args[2], updated_at: args[3] });
      return { toArray: () => [] };
    }
    if (normalized.startsWith("UPDATE generation_history SET state = ?, updated_at")) {
      const row = this.generations.find((entry) => entry.generation === args[2]);
      if (row) Object.assign(row, { state: args[0], updated_at: args[1] });
      return { toArray: () => [] };
    }
    if (normalized.startsWith("UPDATE generation_history SET state = ?, resolution_id") && normalized.includes("next_generation")) {
      const row = this.generations.find((entry) => entry.generation === args[7]);
      if (row) Object.assign(row, { state: args[0], resolution_id: args[1], resolution_fingerprint: args[2], resolution: args[3], proof_type: args[4], next_generation: args[5], updated_at: args[6] });
      return { toArray: () => [] };
    }
    if (normalized.startsWith("UPDATE generation_history SET state = ?, resolution_id")) {
      const row = this.generations.find((entry) => entry.generation === args[6]);
      if (row) Object.assign(row, { state: args[0], resolution_id: args[1], resolution_fingerprint: args[2], resolution: args[3], proof_type: args[4], updated_at: args[5] });
      return { toArray: () => [] };
    }
    if (normalized.startsWith("UPDATE operation_binding SET active_generation")) {
      const row = this.operations.find((entry) => entry.operation_id === args[1]);
      if (row) row.active_generation = args[0];
      return { toArray: () => [] };
    }
    throw new Error(`Unhandled SQL: ${normalized}`);
  }
  clone() {
    const copy = new FakeSql();
    copy.operations = structuredClone(this.operations);
    copy.generations = structuredClone(this.generations);
    return copy;
  }
  adopt(other: FakeSql) {
    this.operations = other.operations;
    this.generations = other.generations;
  }
}

class FakeStorage {
  sql = new FakeSql();
  values = new Map<string, unknown>();
  failTransaction = false;
  async get<T>(key: string) { return this.values.get(key) as T | undefined; }
  async put(key: string, value: unknown) { this.values.set(key, value); }
  transactionSync<T>(callback: () => T) {
    if (this.failTransaction) { this.failTransaction = false; throw new Error("transaction failed"); }
    const snapshot = this.sql.clone();
    try { return callback(); } catch (error) { this.sql.adopt(snapshot); throw error; }
  }
}

function state(storage = new FakeStorage()) {
  return {
    storage,
    blockConcurrencyWhile<T>(callback: () => Promise<T>) { return callback(); },
  } as unknown as DurableObjectState & { storage: FakeStorage };
}

const context = {
  operation: "CLAIM",
  operationID: "operation-001",
  storageReferenceID: "reference-001",
  part2SubmissionID: "submission-001",
  sourceContentSha256: "a".repeat(64),
  documentClass: "EOI_PART_2_SIGNATURE",
  FUSIONID: "FUSION-001",
  episodeID: "episode-001",
};
const secret = "coordinator-secret";

async function call(coordinator: Part2SignatureCoordinator, body: Record<string, unknown>, path: "/claim" | "/resolve" | "/enter-write", nonce: string) {
  const raw = JSON.stringify(body);
  const signed = buildC0BridgeRequest({ secret, body: raw, path: PART2_SIGNATURE_COORDINATOR_PATH, nonce });
  return coordinator.fetch(new Request(`https://coordinator${path}`, { method: "POST", body: raw, headers: signed.headers }));
}

async function json(response: Response) { return await response.json() as Record<string, unknown>; }

test("atomic overlapping claims grant one generation exactly once", async () => {
  const current = state();
  const coordinator = new Part2SignatureCoordinator(current, { PART2_SIGNATURE_COORDINATOR_SIGNING_SECRET: secret });
  const [first, second] = await Promise.all([
    call(coordinator, context, "/claim", "a".repeat(32)),
    call(coordinator, context, "/claim", "b".repeat(32)),
  ]);
  const results = await Promise.all([json(first), json(second)]);
  assert.equal(results.filter((result) => result.code === "CLAIM_GRANTED").length, 1);
  assert.equal(results.filter((result) => result.code === "ALREADY_STARTED").length, 1);
});

test("restart preserves a started generation and old grant cannot be replayed", async () => {
  const current = state();
  const firstCoordinator = new Part2SignatureCoordinator(current, { PART2_SIGNATURE_COORDINATOR_SIGNING_SECRET: secret });
  const granted = await json(await call(firstCoordinator, context, "/claim", "c".repeat(32)));
  const restarted = new Part2SignatureCoordinator(current, { PART2_SIGNATURE_COORDINATOR_SIGNING_SECRET: secret });
  const replay = await json(await call(restarted, context, "/claim", "d".repeat(32)));
  assert.equal(granted.code, "CLAIM_GRANTED");
  assert.equal(replay.code, "ALREADY_STARTED");
  assert.equal(replay.claimID, granted.claimID);
  assert.equal(replay.generation, 1);
});

test("a reused operation with a different storage reference is rejected", async () => {
  const current = state();
  const coordinator = new Part2SignatureCoordinator(current, { PART2_SIGNATURE_COORDINATOR_SIGNING_SECRET: secret });
  assert.equal((await json(await call(coordinator, context, "/claim", "9".repeat(32)))).code, "CLAIM_GRANTED");
  const conflict = await json(await call(coordinator, { ...context, storageReferenceID: "reference-other" }, "/claim", "a".repeat(32)));
  assert.equal(conflict.code, "CONFLICT");
});

test("coordinator request nonces are route-specific replay protection", async () => {
  const current = state();
  const coordinator = new Part2SignatureCoordinator(current, { PART2_SIGNATURE_COORDINATOR_SIGNING_SECRET: secret });
  const nonce = "b".repeat(32);
  assert.equal((await json(await call(coordinator, context, "/claim", nonce))).code, "CLAIM_GRANTED");
  assert.equal((await json(await call(coordinator, context, "/claim", nonce))).code, "UNAUTHORIZED");
});

test("transaction failure grants no claim and a later retry can claim", async () => {
  const current = state();
  const coordinator = new Part2SignatureCoordinator(current, { PART2_SIGNATURE_COORDINATOR_SIGNING_SECRET: secret });
  current.storage.failTransaction = true;
  assert.equal((await json(await call(coordinator, context, "/claim", "e".repeat(32)))).code, "INTERNAL_ERROR");
  assert.equal((await json(await call(coordinator, context, "/claim", "f".repeat(32)))).code, "CLAIM_GRANTED");
});

test("only proven no-storage resolution opens one next generation", async () => {
  const current = state();
  const coordinator = new Part2SignatureCoordinator(current, { PART2_SIGNATURE_COORDINATOR_SIGNING_SECRET: secret });
  const claim = await json(await call(coordinator, context, "/claim", "1".repeat(32)));
  const resolveBody = { ...context, operation: "RESOLVE_ATTEMPT", generation: 1, claimID: claim.claimID, resolutionID: "resolution-1-NO_STORAGE_CONFIRMED", resolution: "NO_STORAGE_CONFIRMED", proofType: "PROVEN_ABSENT" };
  const [first, second] = await Promise.all([
    call(coordinator, resolveBody, "/resolve", "2".repeat(32)),
    call(coordinator, resolveBody, "/resolve", "3".repeat(32)),
  ]);
  const results = await Promise.all([json(first), json(second)]);
  assert.equal(results.every((result) => result.ok === true && result.nextGeneration === 2), true);
  assert.equal(current.storage.sql.generations.filter((row) => row.generation === 2).length, 1);
  const oldClaim = await json(await call(coordinator, { ...context, generation: 1 }, "/claim", "4".repeat(32)));
  assert.equal(oldClaim.code, "GENERATION_RESOLVED");
  const nextClaim = await json(await call(coordinator, { ...context, generation: 2 }, "/claim", "5".repeat(32)));
  assert.equal(nextClaim.code, "CLAIM_GRANTED");
});

test("overlapping recovery claims grant generation N+1 exactly once", async () => {
  const current = state();
  const coordinator = new Part2SignatureCoordinator(current, { PART2_SIGNATURE_COORDINATOR_SIGNING_SECRET: secret });
  const initial = await json(await call(coordinator, context, "/claim", "c".repeat(32)));
  const resolved = { ...context, operation: "RESOLVE_ATTEMPT", generation: 1, claimID: initial.claimID, resolutionID: "resolution-1-NO_STORAGE_CONFIRMED", resolution: "NO_STORAGE_CONFIRMED", proofType: "PROVEN_ABSENT" };
  await json(await call(coordinator, resolved, "/resolve", "d".repeat(32)));
  const [first, second] = await Promise.all([
    call(coordinator, { ...context, generation: 2 }, "/claim", "e".repeat(32)),
    call(coordinator, { ...context, generation: 2 }, "/claim", "f".repeat(32)),
  ]);
  const results = await Promise.all([json(first), json(second)]);
  assert.equal(results.filter((result) => result.code === "CLAIM_GRANTED").length, 1);
  assert.equal(results.filter((result) => result.code === "ALREADY_STARTED").length, 1);
});

test("uncertain evidence cannot be misclassified as no-storage recovery", async () => {
  const current = state();
  const coordinator = new Part2SignatureCoordinator(current, { PART2_SIGNATURE_COORDINATOR_SIGNING_SECRET: secret });
  const claim = await json(await call(coordinator, context, "/claim", "1".repeat(31) + "a"));
  const rejected = await json(await call(coordinator, {
    ...context,
    operation: "RESOLVE_ATTEMPT",
    generation: 1,
    claimID: claim.claimID,
    resolutionID: "resolution-1-invalid-proof",
    resolution: "NO_STORAGE_CONFIRMED",
    proofType: "RECONCILIATION_UNKNOWN",
  }, "/resolve", "2".repeat(31) + "a"));
  assert.equal(rejected.code, "CONFLICT");
  assert.equal((await json(await call(coordinator, context, "/claim", "3".repeat(31) + "a"))).code, "ALREADY_STARTED");
  assert.equal(current.storage.sql.generations.length, 1);
});

test("uncertain resolution never opens a recovery generation", async () => {
  const current = state();
  const coordinator = new Part2SignatureCoordinator(current, { PART2_SIGNATURE_COORDINATOR_SIGNING_SECRET: secret });
  const claim = await json(await call(coordinator, context, "/claim", "6".repeat(32)));
  const resolved = await json(await call(coordinator, { ...context, operation: "RESOLVE_ATTEMPT", generation: 1, claimID: claim.claimID, resolutionID: "resolution-1-UNCERTAIN", resolution: "UNCERTAIN", proofType: "RECONCILIATION_UNKNOWN" }, "/resolve", "7".repeat(32)));
  assert.equal(resolved.nextGeneration, undefined);
  assert.equal((await json(await call(coordinator, { ...context }, "/claim", "8".repeat(32)))).code, "GENERATION_RESOLVED");
  assert.equal(current.storage.sql.generations.length, 1);
});

test("ENTER_WRITE atomically grants the side-effect boundary exactly once", async () => {
  const current = state();
  const coordinator = new Part2SignatureCoordinator(current, { PART2_SIGNATURE_COORDINATOR_SIGNING_SECRET: secret });
  const claim = await json(await call(coordinator, context, "/claim", "9".repeat(32)));
  const enter = { ...context, operation: "ENTER_WRITE", generation: 1, claimID: claim.claimID };
  const granted = await json(await call(coordinator, enter, "/enter-write", "a".repeat(32)));
  assert.equal(granted.code, "WRITE_GRANTED");
  assert.equal(granted.generation, 1);
  assert.equal(current.storage.sql.generations[0].state, "WRITE_ENTERED");
});

test("two simultaneous ENTER_WRITE calls grant exactly one write permission", async () => {
  const current = state();
  const coordinator = new Part2SignatureCoordinator(current, { PART2_SIGNATURE_COORDINATOR_SIGNING_SECRET: secret });
  const claim = await json(await call(coordinator, context, "/claim", "b".repeat(32)));
  const enter = { ...context, operation: "ENTER_WRITE", generation: 1, claimID: claim.claimID };
  const responses = await Promise.all([
    call(coordinator, enter, "/enter-write", "c".repeat(32)),
    call(coordinator, enter, "/enter-write", "d".repeat(32)),
  ]);
  const results = await Promise.all(responses.map(json));
  assert.equal(results.filter((result) => result.code === "WRITE_GRANTED").length, 1);
  assert.equal(results.filter((result) => result.code !== "WRITE_GRANTED").length, 1);
  assert.equal(current.storage.sql.generations[0].state, "WRITE_ENTERED");
});

test("stale ENTER_WRITE after recovery to the next generation is rejected", async () => {
  const current = state();
  const coordinator = new Part2SignatureCoordinator(current, { PART2_SIGNATURE_COORDINATOR_SIGNING_SECRET: secret });
  const claim = await json(await call(coordinator, context, "/claim", "e".repeat(32)));
  const resolved = await json(await call(coordinator, {
    ...context,
    operation: "RESOLVE_ATTEMPT",
    generation: 1,
    claimID: claim.claimID,
    resolutionID: "resolution-1-NO_STORAGE_CONFIRMED",
    resolution: "NO_STORAGE_CONFIRMED",
    proofType: "PROVEN_ABSENT",
  }, "/resolve", "f".repeat(32)));
  assert.equal(resolved.nextGeneration, 2);
  const stale = await json(await call(coordinator, { ...context, operation: "ENTER_WRITE", generation: 1, claimID: claim.claimID }, "/enter-write", "0".repeat(32)));
  assert.notEqual(stale.code, "WRITE_GRANTED");
  assert.equal(current.storage.sql.generations.filter((row) => row.generation === 2).length, 1);
});

test("ENTER_WRITE rejects a wrong claim ID", async () => {
  const current = state();
  const coordinator = new Part2SignatureCoordinator(current, { PART2_SIGNATURE_COORDINATOR_SIGNING_SECRET: secret });
  await json(await call(coordinator, context, "/claim", "1".repeat(32)));
  const rejected = await json(await call(coordinator, { ...context, operation: "ENTER_WRITE", generation: 1, claimID: "claim-wrong" }, "/enter-write", "2".repeat(32)));
  assert.notEqual(rejected.code, "WRITE_GRANTED");
  assert.equal(current.storage.sql.generations[0].state, "STARTED");
});

test("WRITE_ENTERED cannot be recovered as NO_STORAGE_CONFIRMED or open N+1", async () => {
  const current = state();
  const coordinator = new Part2SignatureCoordinator(current, { PART2_SIGNATURE_COORDINATOR_SIGNING_SECRET: secret });
  const claim = await json(await call(coordinator, context, "/claim", "3".repeat(32)));
  const entered = await json(await call(coordinator, { ...context, operation: "ENTER_WRITE", generation: 1, claimID: claim.claimID }, "/enter-write", "4".repeat(32)));
  assert.equal(entered.code, "WRITE_GRANTED");
  const rejected = await json(await call(coordinator, {
    ...context,
    operation: "RESOLVE_ATTEMPT",
    generation: 1,
    claimID: claim.claimID,
    resolutionID: "resolution-1-NO_STORAGE_CONFIRMED",
    resolution: "NO_STORAGE_CONFIRMED",
    proofType: "PROVEN_ABSENT",
  }, "/resolve", "5".repeat(32)));
  assert.equal(rejected.code, "CONFLICT");
  assert.equal(current.storage.sql.generations.length, 1);
});

test("uncertain outcome after WRITE_ENTERED remains reconciliation-gated", async () => {
  const current = state();
  const coordinator = new Part2SignatureCoordinator(current, { PART2_SIGNATURE_COORDINATOR_SIGNING_SECRET: secret });
  const claim = await json(await call(coordinator, context, "/claim", "d".repeat(32)));
  const entered = await json(await call(coordinator, { ...context, operation: "ENTER_WRITE", generation: 1, claimID: claim.claimID }, "/enter-write", "e".repeat(32)));
  assert.equal(entered.code, "WRITE_GRANTED");
  const uncertain = await json(await call(coordinator, {
    ...context,
    operation: "RESOLVE_ATTEMPT",
    generation: 1,
    claimID: claim.claimID,
    resolutionID: "resolution-1-UNCERTAIN",
    resolution: "UNCERTAIN",
    proofType: "STORAGE_RESULT_UNCERTAIN",
  }, "/resolve", "f".repeat(32)));
  assert.equal(uncertain.code, "RESOLVED");
  assert.equal(current.storage.sql.generations[0].state, "UNCERTAIN");
  assert.equal(current.storage.sql.generations.length, 1);
});

test("STORED_CONFIRMED cannot bypass ENTER_WRITE from STARTED", async () => {
  const current = state();
  const coordinator = new Part2SignatureCoordinator(current, { PART2_SIGNATURE_COORDINATOR_SIGNING_SECRET: secret });
  const claim = await json(await call(coordinator, context, "/claim", "0".repeat(32)));
  const rejected = await json(await call(coordinator, {
    ...context,
    operation: "RESOLVE_ATTEMPT",
    generation: 1,
    claimID: claim.claimID,
    resolutionID: "resolution-1-STORED_CONFIRMED",
    resolution: "STORED_CONFIRMED",
    proofType: "STORED_OBJECT_CONFIRMED",
  }, "/resolve", "1".repeat(32)));
  assert.equal(rejected.code, "CONFLICT");
  assert.equal(current.storage.sql.generations[0].state, "STARTED");
});

test("ENTER_WRITE transaction failure rolls back without granting permission", async () => {
  const current = state();
  const coordinator = new Part2SignatureCoordinator(current, { PART2_SIGNATURE_COORDINATOR_SIGNING_SECRET: secret });
  const claim = await json(await call(coordinator, context, "/claim", "6".repeat(32)));
  current.storage.failTransaction = true;
  const failed = await json(await call(coordinator, { ...context, operation: "ENTER_WRITE", generation: 1, claimID: claim.claimID }, "/enter-write", "7".repeat(32)));
  assert.equal(failed.code, "INTERNAL_ERROR");
  assert.equal(current.storage.sql.generations[0].state, "STARTED");
});

test("coordinator restart preserves WRITE_ENTERED and grants no second entry", async () => {
  const current = state();
  const firstCoordinator = new Part2SignatureCoordinator(current, { PART2_SIGNATURE_COORDINATOR_SIGNING_SECRET: secret });
  const claim = await json(await call(firstCoordinator, context, "/claim", "8".repeat(32)));
  const entered = await json(await call(firstCoordinator, { ...context, operation: "ENTER_WRITE", generation: 1, claimID: claim.claimID }, "/enter-write", "9".repeat(32)));
  const restarted = new Part2SignatureCoordinator(current, { PART2_SIGNATURE_COORDINATOR_SIGNING_SECRET: secret });
  const replay = await json(await call(restarted, { ...context, operation: "ENTER_WRITE", generation: 1, claimID: claim.claimID }, "/enter-write", "a".repeat(32)));
  assert.equal(entered.code, "WRITE_GRANTED");
  assert.notEqual(replay.code, "WRITE_GRANTED");
  assert.equal(current.storage.sql.generations[0].state, "WRITE_ENTERED");
});

test("ENTER_WRITE HMAC replay is rejected and cannot grant a second permission", async () => {
  const current = state();
  const coordinator = new Part2SignatureCoordinator(current, { PART2_SIGNATURE_COORDINATOR_SIGNING_SECRET: secret });
  const claim = await json(await call(coordinator, context, "/claim", "b".repeat(32)));
  const enter = { ...context, operation: "ENTER_WRITE", generation: 1, claimID: claim.claimID };
  const nonce = "c".repeat(32);
  const first = await json(await call(coordinator, enter, "/enter-write", nonce));
  const replay = await json(await call(coordinator, enter, "/enter-write", nonce));
  assert.equal(first.code, "WRITE_GRANTED");
  assert.equal(replay.code, "UNAUTHORIZED");
});
