import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { buildC0BridgeRequest } from "../src/lib/c0-bridge-hmac.ts";
import { Part2SignatureCoordinator, PART2_SIGNATURE_COORDINATOR_PATH } from "../src/lib/part2-signature-coordinator.ts";

const forwarded: string[] = [];

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
    if (normalized.startsWith("UPDATE generation_history SET state = ?, updated_at")) {
      const row = this.generations.find((entry) => entry.generation === args[2]);
      if (row) Object.assign(row, { state: args[0], updated_at: args[1] });
      return { toArray: () => [] };
    }
    if (normalized.startsWith("UPDATE operation_binding SET active_generation")) {
      const row = this.operations.find((entry) => entry.operation_id === args[1]);
      if (row) row.active_generation = args[0];
      return { toArray: () => [] };
    }
    throw new Error(`Unhandled SQL: ${normalized}`);
  }
  clone() { const copy = new FakeSql(); copy.operations = structuredClone(this.operations); copy.generations = structuredClone(this.generations); return copy; }
  adopt(other: FakeSql) { this.operations = other.operations; this.generations = other.generations; }
}

class FakeStorage {
  sql = new FakeSql();
  values = new Map<string, unknown>();
  async get<T>(key: string) { return this.values.get(key) as T | undefined; }
  async put(key: string, value: unknown) { this.values.set(key, value); }
  transactionSync<T>(callback: () => T) { const snapshot = this.sql.clone(); try { return callback(); } catch (error) { this.sql.adopt(snapshot); throw error; } }
}

function harness() {
  const state = { storage: new FakeStorage(), blockConcurrencyWhile<T>(callback: () => Promise<T>) { return callback(); } } as unknown as DurableObjectState & { storage: FakeStorage };
  const coordinator = new Part2SignatureCoordinator(state, { PART2_SIGNATURE_COORDINATOR_SIGNING_SECRET: "coordinator-secret" });
  return { state, stub: { fetch: async (url: string, init?: RequestInit) => {
    forwarded.push(url);
    return coordinator.fetch(new Request(url, init));
  } } };
}

let active = harness();

mock.module("cloudflare:workers", {
  namedExports: {
    env: {
      PART2_SIGNATURE_COORDINATOR: {
        idFromName: (name: string) => name,
        get: () => active.stub,
      },
    },
  },
});

const { POST } = await import("../src/pages/api/internal/part2-signature-coordinator.ts");

test("internal route forwards ENTER_WRITE to the dedicated coordinator path", async () => {
  active = harness();
  const body = { operation: "ENTER_WRITE", operationID: "operation-001", storageReferenceID: "reference-001", part2SubmissionID: "submission-001", sourceContentSha256: "a".repeat(64), documentClass: "EOI_PART_2_SIGNATURE", FUSIONID: "FUSION-001", episodeID: "episode-001", generation: 1, claimID: "claim-001" };
  const raw = JSON.stringify(body);
  const signed = buildC0BridgeRequest({ secret: "coordinator-secret", body: raw, path: PART2_SIGNATURE_COORDINATOR_PATH, nonce: "a".repeat(32) });
  const response = await POST({
    request: new Request("https://portal.example/api/internal/part2-signature-coordinator", {
      method: "POST",
      body: raw,
      headers: signed.headers,
    }),
  } as never);
  assert.equal(response.status, 200);
  assert.equal(forwarded[0], "https://part2-signature-coordinator/enter-write");
});

test("ENTER_WRITE replay through the internal route cannot grant twice", async () => {
  active = harness();
  const context = { operationID: "operation-replay", storageReferenceID: "reference-replay", part2SubmissionID: "submission-replay", sourceContentSha256: "b".repeat(64), documentClass: "EOI_PART_2_SIGNATURE", FUSIONID: "FUSION-REPLAY", episodeID: "episode-replay" };
  async function route(body: Record<string, unknown>, nonce: string) {
    const raw = JSON.stringify(body);
    const signed = buildC0BridgeRequest({ secret: "coordinator-secret", body: raw, path: PART2_SIGNATURE_COORDINATOR_PATH, nonce });
    return POST({ request: new Request("https://portal.example/api/internal/part2-signature-coordinator", { method: "POST", body: raw, headers: signed.headers }) } as never);
  }
  const claimed = await route({ ...context, operation: "CLAIM" }, "c".repeat(32));
  const claim = await claimed.json() as { claimID: string; generation: number; code: string };
  assert.equal(claim.code, "CLAIM_GRANTED");
  const enter = { ...context, operation: "ENTER_WRITE", generation: claim.generation, claimID: claim.claimID };
  const first = await route(enter, "d".repeat(32));
  assert.equal((await first.json() as { code: string }).code, "WRITE_GRANTED");
  const replay = await route(enter, "d".repeat(32));
  assert.equal(replay.status, 401);
  assert.equal((await replay.json() as { code: string }).code, "UNAUTHORIZED");
  const newNonceReplay = await route(enter, "e".repeat(32));
  assert.notEqual((await newNonceReplay.json() as { code: string }).code, "WRITE_GRANTED");
  assert.equal(active.state.storage.sql.generations[0].state, "WRITE_ENTERED");
});

test("internal route rejects unsupported coordinator commands", async () => {
  const response = await POST({
    request: new Request("https://portal.example/api/internal/part2-signature-coordinator", {
      method: "POST",
      body: JSON.stringify({ operation: "UNKNOWN", operationID: "operation-001" }),
    }),
  } as never);
  assert.equal(response.status, 400);
});
