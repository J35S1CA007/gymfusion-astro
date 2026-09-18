import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { buildC0BridgeRequest } from "../src/lib/c0-bridge-hmac.ts";
import {
  DocumentStorageReferenceCoordinator,
  DOCUMENT_STORAGE_REFERENCE_COORDINATOR_PATH,
  __testHooks,
} from "../src/lib/document-storage-reference-coordinator.ts";

const SECRET = "test-coordinator-secret";

function storage() {
  const values = new Map<string, unknown>();
  return {
    values,
    async get<T>(key: string) { return values.get(key) as T | undefined; },
    async put<T>(key: string, value: T) { values.set(key, value); },
  };
}

function state(storageValue: ReturnType<typeof storage>) {
  return {
    storage: storageValue,
    blockConcurrencyWhile<T>(callback: () => Promise<T>) { return callback(); },
  } as unknown as DurableObjectState;
}

async function signedRequest(path: string, body: unknown, nonce = crypto.randomUUID().replaceAll("-", "")) {
  const raw = JSON.stringify(body);
  const signed = buildC0BridgeRequest({ secret: SECRET, path: DOCUMENT_STORAGE_REFERENCE_COORDINATOR_PATH, body: raw, nonce });
  return new Request(`https://coordinator${path}`, { method: "POST", body: raw, headers: { ...signed.headers, "content-type": "application/json" } });
}

function context(referenceID = "reference-a", operationID = "operation-a") {
  return {
    _id: referenceID,
    operationID,
    storageProvider: "SHAREPOINT_GRAPH",
    storageDriveKey: "GYMFUSION_MEMBERS",
    documentClass: "EOI_PART_2_SIGNATURE",
    FUSIONID: "fusion-a",
    episodeID: "episode-a",
  };
}

function record(referenceID: string, operationID: string, status = "STORED") {
  return { _id: referenceID, operationID, lifecycleStatus: status };
}

function createCommand(referenceID: string, operationID: string) {
  const commandContext = context(referenceID, operationID);
  const mutation = { kind: "CREATE_PENDING", candidate: { ...commandContext, lifecycleStatus: "PENDING" } };
  return { commandContext, mutation };
}

async function start(coordinator: DocumentStorageReferenceCoordinator, commandID: string, commandContext: Record<string, unknown>, mutation: Record<string, unknown>) {
  const requestDigest = await __testHooks.digest({ storageReferenceID: commandContext._id, operationID: commandContext.operationID, mutation });
  return coordinator.fetch(await signedRequest("/start", { operation: "START", commandID, storageReferenceID: commandContext._id, operationID: commandContext.operationID, requestDigest, context: commandContext, mutation }));
}

describe("DocumentStorageReferenceCoordinator", { concurrency: false }, () => {
test("stale callback is fenced before Wix mutation and does not complete over a newer generation", async () => {
  const saved = storage();
  let coordinator: DocumentStorageReferenceCoordinator;
  let releaseFirst!: () => void;
  const firstPaused = new Promise<void>((resolve) => { releaseFirst = resolve; });
  let mutationCount = 0;
  globalThis.fetch = async (_input, init) => {
    const callback = JSON.parse(String(init?.body)) as Record<string, any>;
    if (callback.commandID === "command-a") await firstPaused;
    const enterBody = {
      operation: "ENTER_MUTATION",
      commandID: callback.commandID,
      generation: callback.generation,
      storageReferenceID: callback.storageReferenceID,
      operationID: callback.operationID,
      requestDigest: callback.requestDigest,
    };
    const enterResponse = await coordinator.fetch(await signedRequest("/enter", enterBody));
    if (!enterResponse.ok) return Response.json({ ok: false, outcome: "PRE_MUTATION_REJECTED", storageReferenceID: callback.storageReferenceID, operationID: callback.operationID, requestDigest: callback.requestDigest, code: "STALE_COORDINATOR_COMMAND" }, { status: 409 });
    mutationCount += 1;
    return Response.json({ ok: true, outcome: "COMMITTED", storageReferenceID: callback.storageReferenceID, operationID: callback.operationID, requestDigest: callback.requestDigest, mutationPerformed: true, record: record(callback.storageReferenceID, callback.operationID) });
  };
  coordinator = new DocumentStorageReferenceCoordinator(state(saved), { C0_BRIDGE_SIGNING_SECRET: SECRET });
  const mutationA = { kind: "TRANSITION", toStatus: "STORED", expectedLifecycleStatus: "PENDING", storageMetadata: { driveItemId: "drive-a" } };
  const digestA = await __testHooks.digest({ storageReferenceID: "reference-a", operationID: "operation-a", mutation: mutationA });
  const startA = coordinator.fetch(await signedRequest("/start", { operation: "START", commandID: "command-a", storageReferenceID: "reference-a", operationID: "operation-a", requestDigest: digestA, context: context(), mutation: mutationA }));
  for (let attempt = 0; attempt < 20 && !(await saved.get("state")); attempt += 1) await new Promise((resolve) => setTimeout(resolve, 0));

  const mutationB = { kind: "TRANSITION", toStatus: "STORED", expectedLifecycleStatus: "PENDING", storageMetadata: { driveItemId: "drive-b" } };
  const digestB = await __testHooks.digest({ storageReferenceID: "reference-a", operationID: "operation-a", mutation: mutationB });
  const prematureAbort = await coordinator.fetch(await signedRequest("/resolve", { operation: "RESOLVE", commandID: "command-a", generation: 1, storageReferenceID: "reference-a", operationID: "operation-a", requestDigest: digestA, resolution: "ABORTED_BEFORE_MUTATION", proof: { updateInvoked: false } }));
  assert.equal(prematureAbort.ok, false);
  assert.equal((await prematureAbort.json() as { code?: string }).code, "ABORT_NOT_PROVEN");
  const current = await saved.get<any>("state");
  await saved.put("state", { ...current, generation: 2, commandID: "command-b", requestDigest: digestB, mutation: mutationB, dispatching: false });
  releaseFirst();
  const staleA = await startA;
  assert.equal(staleA.ok, false);
  assert.equal((await saved.get<any>("state"))?.generation, 2);
  const completedB = await coordinator.fetch(await signedRequest("/start", { operation: "START", commandID: "command-b", storageReferenceID: "reference-a", operationID: "operation-a", requestDigest: digestB, context: context(), mutation: mutationB }));
  assert.equal(completedB.ok, true);
  assert.equal(mutationCount, 1);
  assert.equal((await saved.get<any>("state"))?.phase, "COMMITTED_CONFIRMED");
  const saved2 = storage();
  const coordinator2 = new DocumentStorageReferenceCoordinator(state(saved2), { C0_BRIDGE_SIGNING_SECRET: SECRET });
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => { release = resolve; });
  globalThis.fetch = async () => { await waiting; throw new Error("simulated response loss"); };
  const mutation = { kind: "CREATE_PENDING", candidate: context("reference-b", "operation-b") };
  const requestDigest = await __testHooks.digest({ storageReferenceID: "reference-b", operationID: "operation-b", mutation });
  const startPromise = coordinator2.fetch(await signedRequest("/start", { operation: "START", commandID: "command-b", storageReferenceID: "reference-b", operationID: "operation-b", requestDigest, context: context("reference-b", "operation-b"), mutation }));
  for (let attempt = 0; attempt < 20 && !(await saved2.get("state")); attempt += 1) await new Promise((resolve) => setTimeout(resolve, 0));
  const firstEnter = await coordinator2.fetch(await signedRequest("/enter", { operation: "ENTER_MUTATION", commandID: "command-b", generation: 1, storageReferenceID: "reference-b", operationID: "operation-b", requestDigest }));
  assert.equal(firstEnter.ok, true);
  const secondEnter = await coordinator2.fetch(await signedRequest("/enter", { operation: "ENTER_MUTATION", commandID: "command-b", generation: 1, storageReferenceID: "reference-b", operationID: "operation-b", requestDigest }));
  assert.equal(secondEnter.ok, false);
  assert.equal((await saved2.get<any>("state"))?.phase, "MUTATION_ENTERED");
  release();
  assert.equal((await startPromise).ok, false);
  assert.equal((await saved2.get<any>("state"))?.phase, "UNKNOWN_MUTATION");
});

test("response loss after mutation remains UNKNOWN until positive reconciliation and cannot replay", async () => {
  const saved = storage();
  const coordinator = new DocumentStorageReferenceCoordinator(state(saved), { C0_BRIDGE_SIGNING_SECRET: SECRET });
  const { commandContext, mutation } = createCommand("reference-unknown", "operation-unknown");
  let mutationCount = 0;
  globalThis.fetch = async (_input, init) => {
    const callback = JSON.parse(String(init?.body)) as Record<string, any>;
    const entered = await coordinator.fetch(await signedRequest("/enter", { operation: "ENTER_MUTATION", commandID: callback.commandID, generation: callback.generation, storageReferenceID: callback.storageReferenceID, operationID: callback.operationID, requestDigest: callback.requestDigest }));
    assert.equal(entered.ok, true);
    mutationCount += 1;
    throw new Error("response lost after Wix mutation");
  };
  const first = await start(coordinator, "command-unknown", commandContext, mutation);
  assert.equal(first.ok, false);
  assert.equal((await saved.get<any>("state"))?.phase, "UNKNOWN_MUTATION");
  const replay = await start(coordinator, "command-unknown", commandContext, mutation);
  assert.equal(replay.ok, false);
  assert.equal(mutationCount, 1);
  const requestDigest = await __testHooks.digest({ storageReferenceID: commandContext._id, operationID: commandContext.operationID, mutation });
  const oldValueAbort = await coordinator.fetch(await signedRequest("/resolve", { operation: "RESOLVE", commandID: "command-unknown", generation: 1, storageReferenceID: commandContext._id, operationID: commandContext.operationID, requestDigest, resolution: "ABORTED_BEFORE_MUTATION", proof: { updateInvoked: false } }));
  assert.equal(oldValueAbort.ok, false);
  assert.equal((await oldValueAbort.json() as { code?: string }).code, "ABORT_NOT_PROVEN");
  const resolved = await coordinator.fetch(await signedRequest("/resolve", { operation: "RESOLVE", commandID: "command-unknown", generation: 1, storageReferenceID: commandContext._id, operationID: commandContext.operationID, requestDigest, resolution: "COMMITTED_CONFIRMED", proof: { record: mutation.candidate } }));
  assert.equal(resolved.ok, true);
  assert.equal((await saved.get<any>("state"))?.phase, "COMMITTED_CONFIRMED");
});

test("definite pre-mutation rejection aborts without invoking the mutation", async () => {
  const saved = storage();
  const coordinator = new DocumentStorageReferenceCoordinator(state(saved), { C0_BRIDGE_SIGNING_SECRET: SECRET });
  const { commandContext, mutation } = createCommand("reference-abort", "operation-abort");
  let mutationCount = 0;
  globalThis.fetch = async (_input, init) => {
    const callback = JSON.parse(String(init?.body)) as Record<string, any>;
    return Response.json({ ok: false, outcome: "PRE_MUTATION_REJECTED", storageReferenceID: callback.storageReferenceID, operationID: callback.operationID, requestDigest: callback.requestDigest, code: "VALIDATION_FAILED" }, { status: 409 });
  };
  const result = await start(coordinator, "command-abort", commandContext, mutation);
  mutationCount += 0;
  assert.equal(result.ok, false);
  assert.equal((await saved.get<any>("state"))?.phase, "ABORTED_BEFORE_MUTATION");
  assert.equal(mutationCount, 0);
});

test("persisted ACTIVE, ENTERED, and UNKNOWN states survive reconstruction", async () => {
  const saved = storage();
  const firstCoordinator = new DocumentStorageReferenceCoordinator(state(saved), { C0_BRIDGE_SIGNING_SECRET: SECRET });
  const { commandContext, mutation } = createCommand("reference-restart", "operation-restart");
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => { release = resolve; });
  globalThis.fetch = async () => { await waiting; throw new Error("callback unavailable"); };
  const pending = start(firstCoordinator, "command-restart", commandContext, mutation);
  for (let attempt = 0; attempt < 20 && !(await saved.get("state")); attempt += 1) await new Promise((resolve) => setTimeout(resolve, 0));
  const reconstructed = new DocumentStorageReferenceCoordinator(state(saved), { C0_BRIDGE_SIGNING_SECRET: SECRET });
  const busy = await start(reconstructed, "command-restart", commandContext, mutation);
  assert.equal(busy.ok, false);
  assert.equal((await saved.get<any>("state"))?.phase, "ACTIVE_PRE_ENTRY");
  release();
  await pending;
  assert.equal((await saved.get<any>("state"))?.phase, "UNKNOWN_MUTATION");

  const enteredStorage = storage();
  const enteredCoordinator = new DocumentStorageReferenceCoordinator(state(enteredStorage), { C0_BRIDGE_SIGNING_SECRET: SECRET });
  const enteredCommand = createCommand("reference-entered", "operation-entered");
  let releaseEntered!: () => void;
  const enteredWaiting = new Promise<void>((resolve) => { releaseEntered = resolve; });
  globalThis.fetch = async (_input, init) => {
    const callback = JSON.parse(String(init?.body)) as Record<string, any>;
    const entered = await enteredCoordinator.fetch(await signedRequest("/enter", { operation: "ENTER_MUTATION", commandID: callback.commandID, generation: callback.generation, storageReferenceID: callback.storageReferenceID, operationID: callback.operationID, requestDigest: callback.requestDigest }));
    assert.equal(entered.ok, true);
    await enteredWaiting;
    throw new Error("post-entry response loss");
  };
  const enteredPending = start(enteredCoordinator, "command-entered", enteredCommand.commandContext, enteredCommand.mutation);
  for (let attempt = 0; attempt < 20 && (await enteredStorage.get<any>("state"))?.phase !== "MUTATION_ENTERED"; attempt += 1) await new Promise((resolve) => setTimeout(resolve, 0));
  const restartedEntered = new DocumentStorageReferenceCoordinator(state(enteredStorage), { C0_BRIDGE_SIGNING_SECRET: SECRET });
  const enteredState = await enteredStorage.get<any>("state");
  const replayEnter = await restartedEntered.fetch(await signedRequest("/enter", { operation: "ENTER_MUTATION", commandID: enteredState.commandID, generation: enteredState.generation, storageReferenceID: enteredState.storageReferenceID, operationID: enteredState.operationID, requestDigest: enteredState.requestDigest }));
  assert.equal(replayEnter.ok, false);
  assert.equal((await replayEnter.json() as { code?: string }).code, "MUTATION_ALREADY_ENTERED");
  releaseEntered();
  await enteredPending;
  assert.equal((await enteredStorage.get<any>("state"))?.phase, "UNKNOWN_MUTATION");
});

test("exact ENTER_MUTATION callback replay is rejected by the nonce fence", async () => {
  const saved = storage();
  const coordinator = new DocumentStorageReferenceCoordinator(state(saved), { C0_BRIDGE_SIGNING_SECRET: SECRET });
  const { commandContext, mutation } = createCommand("reference-replay", "operation-replay");
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => { release = resolve; });
  globalThis.fetch = async () => { await waiting; throw new Error("callback unavailable"); };
  const pending = start(coordinator, "command-replay", commandContext, mutation);
  for (let attempt = 0; attempt < 20 && !(await saved.get("state")); attempt += 1) await new Promise((resolve) => setTimeout(resolve, 0));
  const current = await saved.get<any>("state");
  const body = { operation: "ENTER_MUTATION", commandID: current.commandID, generation: current.generation, storageReferenceID: current.storageReferenceID, operationID: current.operationID, requestDigest: current.requestDigest };
  const replayNonce = "0123456789abcdef0123456789abcdea";
  const first = await coordinator.fetch(await signedRequest("/enter", body, replayNonce));
  const replay = await coordinator.fetch(await signedRequest("/enter", body, replayNonce));
  assert.equal(first.ok, true);
  assert.equal(replay.ok, false);
  assert.equal((await replay.json() as { code?: string }).code, "UNAUTHORIZED");
  release();
  await pending;
});

test("different reference coordinators progress independently", async () => {
  const savedA = storage();
  const savedB = storage();
  const coordinatorA = new DocumentStorageReferenceCoordinator(state(savedA), { C0_BRIDGE_SIGNING_SECRET: SECRET });
  const coordinatorB = new DocumentStorageReferenceCoordinator(state(savedB), { C0_BRIDGE_SIGNING_SECRET: SECRET });
  const commandA = createCommand("reference-cross-a", "operation-cross-a");
  const commandB = createCommand("reference-cross-b", "operation-cross-b");
  let mutationCount = 0;
  globalThis.fetch = async (_input, init) => {
    const callback = JSON.parse(String(init?.body)) as Record<string, any>;
    const target = callback.storageReferenceID === "reference-cross-a" ? coordinatorA : coordinatorB;
    const entered = await target.fetch(await signedRequest("/enter", { operation: "ENTER_MUTATION", commandID: callback.commandID, generation: callback.generation, storageReferenceID: callback.storageReferenceID, operationID: callback.operationID, requestDigest: callback.requestDigest }));
    assert.equal(entered.ok, true);
    mutationCount += 1;
    return Response.json({ ok: true, outcome: "COMMITTED", storageReferenceID: callback.storageReferenceID, operationID: callback.operationID, requestDigest: callback.requestDigest, mutationPerformed: true, record: callback.mutation.candidate });
  };
  const [resultA, resultB] = await Promise.all([
    start(coordinatorA, "command-cross-a", commandA.commandContext, commandA.mutation),
    start(coordinatorB, "command-cross-b", commandB.commandContext, commandB.mutation),
  ]);
  assert.equal(resultA.ok, true);
  assert.equal(resultB.ok, true);
  assert.equal(mutationCount, 2);
});
});
