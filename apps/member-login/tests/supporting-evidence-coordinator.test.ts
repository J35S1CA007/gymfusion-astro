import assert from "node:assert/strict";
import test from "node:test";
import { SupportingEvidenceCoordinator } from "../src/lib/supporting-evidence-coordinator.ts";
import { buildC0BridgeRequest } from "../src/lib/c0-bridge-hmac.ts";

class MemoryStorage {
  values = new Map<string, unknown>();
  async get<T>(key: string) { return this.values.get(key) as T | undefined; }
  async put<T>(key: string, value: T) { this.values.set(key, value); }
  async delete(key: string) { this.values.delete(key); }
  async list<T>({ prefix }: { prefix?: string } = {}) {
    return new Map([...this.values.entries()].filter(([key]) => !prefix || key.startsWith(prefix))) as Map<string, T>;
  }
}

function state(storage = new MemoryStorage()) {
  const waits: Promise<unknown>[] = [];
  return {
    storage,
    waits,
    blockConcurrencyWhile<T>(callback: () => Promise<T>) { return callback(); },
    waitUntil(promise: Promise<unknown>) { waits.push(promise); },
  } as unknown as DurableObjectState & { storage: MemoryStorage; waits: Promise<unknown>[] };
}

function command(commandID: string, evidenceKey = "evidence-a", payload: Record<string, unknown> = { fileName: `${commandID}.pdf` }, operationKey = `operation-${commandID}`) {
  return new Request("https://coordinator/member-command", {
    method: "POST",
    body: JSON.stringify({ operation: "VOLUNTARY_SUBMIT", commandID, evidenceKey, operationKey, fusionId: "F-A", wixMemberId: "member-a", payload }),
  });
}

function staffCommand(operation: string, commandID: string, operationKey: string, payload: Record<string, unknown>) {
  return new Request("https://coordinator/member-command", {
    method: "POST",
    body: JSON.stringify({ operation, commandID, evidenceKey: "evidence-staff", operationKey, payload }),
  });
}

async function body(response: Response) {
  return await response.json() as Record<string, unknown>;
}

function callbackSuccess(operationKey: string, commandID: string, requestRef = "evidence-a", status = "Submitted in Response") {
  return Response.json({ ok: true, requestRef, status, operationKey, attemptID: `attempt-${commandID}`, fileSlotIDs: [`slot-${commandID}`], closed: false });
}

function callbackSuccessFor(init: RequestInit | undefined, requestRef = "evidence-a", status = "Submitted in Response") {
  const parsed = JSON.parse(String(init?.body)) as { operationKey: string; commandID: string; operation?: string; payload?: Record<string, unknown> };
  const expectedStatus = parsed.operation === "STAFF_TRANSITION"
    || (parsed.operation === "RECONCILE" && ["STAFF_CREATE", "STAFF_TRANSITION"].includes(String(parsed.payload?.recoveryOperation)))
    ? String(parsed.payload?.toStatus || (parsed.payload?.recoveryOperation === "STAFF_CREATE" ? "Evidence Requested" : status))
    : status;
  return callbackSuccess(parsed.operationKey, parsed.commandID, requestRef, expectedStatus);
}

test("same evidence key uses one coordinator and a running command fences duplicate work", async () => {
  const current = state();
  const started = Promise.withResolvers<void>();
  const released = Promise.withResolvers<Response>();
  let calls = 0;
  const previous = globalThis.fetch;
  globalThis.fetch = async () => {
    calls += 1;
    started.resolve();
    return released.promise;
  };
  try {
    const coordinator = new SupportingEvidenceCoordinator(current, { C0_BRIDGE_SIGNING_SECRET: "test-secret" });
    const first = coordinator.fetch(command("command-a"));
    await started.promise;
    const claimed = await current.storage.get<Record<string, unknown>>("command:command-a");
    assert.equal((claimed?.sideEffectClaim as Record<string, unknown>)?.state, "ACQUIRED");
    const claimID = (claimed?.sideEffectClaim as Record<string, unknown>)?.claimID;
    const duplicate = await coordinator.fetch(command("command-a"));
    assert.deepEqual(await body(duplicate), { ok: false, state: "RUNNING", code: "COORDINATOR_BUSY" });
    assert.equal(((await current.storage.get<Record<string, unknown>>("command:command-a"))?.sideEffectClaim as Record<string, unknown>)?.claimID, claimID);
    assert.equal(calls, 1);
    released.resolve(callbackSuccess("operation-command-a", "command-a"));
    assert.deepEqual(await body(await first), { ok: true, state: "COMPLETE", requestRef: "evidence-a", status: "Submitted in Response", closed: false });
  } finally {
    globalThis.fetch = previous;
  }
});

test("different commands queue behind the active evidence command and preserve ordering", async () => {
  const current = state();
  const firstStarted = Promise.withResolvers<void>();
  const firstReleased = Promise.withResolvers<Response>();
  const calls: string[] = [];
  const previous = globalThis.fetch;
  globalThis.fetch = async (_input, init) => {
    const requestBody = JSON.parse(String(init?.body)) as { commandID: string };
    calls.push(requestBody.commandID);
    if (calls.length === 1) {
      firstStarted.resolve();
      return firstReleased.promise;
    }
    return callbackSuccessFor(init);
  };
  try {
    const coordinator = new SupportingEvidenceCoordinator(current, { C0_BRIDGE_SIGNING_SECRET: "test-secret" });
    const first = coordinator.fetch(command("command-a"));
    await firstStarted.promise;
    const queued = await coordinator.fetch(command("command-b"));
    assert.deepEqual(await body(queued), { ok: false, state: "QUEUED", code: "COORDINATOR_BUSY" });
    firstReleased.resolve(callbackSuccess("operation-command-a", "command-a"));
    await first;
    await Promise.all(current.waits);
    assert.deepEqual(calls, ["command-a", "command-b"]);
    const replay = await coordinator.fetch(command("command-b"));
    assert.deepEqual(await body(replay), { ok: true, state: "COMPLETE", requestRef: "evidence-a", status: "Submitted in Response", closed: false });
  } finally {
    globalThis.fetch = previous;
  }
});

test("different command IDs for one operation key cannot repeat the external operation", async () => {
  const current = state();
  const started = Promise.withResolvers<void>();
  const released = Promise.withResolvers<Response>();
  let calls = 0;
  const previous = globalThis.fetch;
  globalThis.fetch = async () => {
    calls += 1;
    started.resolve();
    return released.promise;
  };
  try {
    const coordinator = new SupportingEvidenceCoordinator(current, { C0_BRIDGE_SIGNING_SECRET: "test-secret" });
    const first = coordinator.fetch(command("command-a", "evidence-a", { fileName: "a.pdf" }, "operation-a"));
    await started.promise;
    const duplicate = await coordinator.fetch(command("command-b", "evidence-a", { fileName: "a.pdf" }, "operation-a"));
    assert.deepEqual(await body(duplicate), { ok: false, state: "RUNNING", code: "COORDINATOR_BUSY" });
    released.resolve(callbackSuccess("operation-a", "command-a"));
    await first;
    const replay = await coordinator.fetch(command("command-b", "evidence-a", { fileName: "a.pdf" }, "operation-a"));
    assert.deepEqual(await body(replay), { ok: true, state: "COMPLETE", requestRef: "evidence-a", status: "Submitted in Response", closed: false });
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = previous;
  }
});

test("four existing files plus two concurrent coordinator submissions never exceed five", async () => {
  const current = state();
  const started = Promise.withResolvers<void>();
  const released = Promise.withResolvers<Response>();
  let storedFiles = 4;
  let callbackInvocations = 0;
  let graphCalls = 0;
  const previous = globalThis.fetch;
  globalThis.fetch = async (_input, _init) => {
    callbackInvocations += 1;
    if (callbackInvocations === 1) {
      started.resolve();
      return released.promise;
    }
    if (storedFiles >= 5) return Response.json({ ok: false, code: "MAX_FILES_PER_ATTEMPT" }, { status: 400 });
    storedFiles += 1;
    graphCalls += 1;
    return callbackSuccessFor(_init);
  };
  try {
    const coordinator = new SupportingEvidenceCoordinator(current, { C0_BRIDGE_SIGNING_SECRET: "test-secret" });
    const first = coordinator.fetch(command("upload-a"));
    await started.promise;
    const queued = await Promise.all(["upload-b", "upload-c", "upload-d", "upload-e", "upload-f"].map((id) => coordinator.fetch(command(id))));
    assert.equal(queued.every((result) => result.status === 202), true);
    released.resolve(callbackSuccess("operation-upload-a", "upload-a"));
    storedFiles += 1;
    graphCalls += 1;
    await first;
    for (let index = 0; index < 20 && current.waits.length < 2; index += 1) await new Promise((resolve) => setTimeout(resolve, 0));
    await Promise.all(current.waits);
    assert.equal(storedFiles, 5);
    assert.equal(graphCalls, 1);
    assert.equal(callbackInvocations, 2);
  } finally {
    globalThis.fetch = previous;
  }
});

test("same command with different input is rejected and uncertain callback is reconciliation-gated", async () => {
  const current = state();
  let calls = 0;
  const previous = globalThis.fetch;
  globalThis.fetch = async () => {
    calls += 1;
    throw new Error("network uncertain");
  };
  try {
    const coordinator = new SupportingEvidenceCoordinator(current, { C0_BRIDGE_SIGNING_SECRET: "test-secret" });
    const uncertain = await coordinator.fetch(command("command-a"));
    assert.deepEqual(await body(uncertain), { ok: false, state: "RECONCILIATION_REQUIRED", code: "COORDINATOR_UNAVAILABLE" });
    const persisted = await current.storage.get<Record<string, unknown>>("command:command-a");
    assert.equal((persisted?.sideEffectClaim as Record<string, unknown>)?.state, "UNKNOWN");
    const conflict = await coordinator.fetch(command("command-a", "evidence-a", { fileName: "different.pdf" }));
    assert.equal((await body(conflict)).code, "COMMAND_ID_CONFLICT");
    assert.equal(calls, 1);
    const replay = await coordinator.fetch(command("command-a"));
    assert.equal((await body(replay)).state, "RECONCILIATION_REQUIRED");
  } finally {
    globalThis.fetch = previous;
  }
});

test("a new command cannot bypass an uncertain operation after callback loss", async () => {
  const current = state();
  const previous = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; throw new Error("network uncertain"); };
  try {
    const coordinator = new SupportingEvidenceCoordinator(current, { C0_BRIDGE_SIGNING_SECRET: "test-secret" });
    const first = await coordinator.fetch(command("command-a", "evidence-a", { fileName: "a.pdf" }, "operation-a"));
    assert.equal((await body(first)).state, "RECONCILIATION_REQUIRED");
    const bypass = await coordinator.fetch(command("command-b", "evidence-a", { fileName: "b.pdf" }, "operation-b"));
    assert.deepEqual(await body(bypass), { ok: false, state: "RECONCILIATION_REQUIRED", code: "COORDINATOR_UNAVAILABLE" });
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = previous;
  }
});

test("staff create and transition response loss require operation-specific reconciliation", async () => {
  const previous = globalThis.fetch;
  try {
    for (const operation of ["STAFF_CREATE", "STAFF_TRANSITION"]) {
      const current = state();
      const operationKey = `operation-${operation.toLowerCase()}`;
      const callbackBodies: Record<string, unknown>[] = [];
      let calls = 0;
      globalThis.fetch = async (_input, init) => {
        callbackBodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
        calls += 1;
        if (calls === 1) throw new Error("response lost");
        return callbackSuccessFor(init, "evidence-staff", "Evidence Requested");
      };
      const coordinator = new SupportingEvidenceCoordinator(current, { C0_BRIDGE_SIGNING_SECRET: "test-secret" });
      const initialPayload = operation === "STAFF_CREATE"
        ? { supportingEvidenceID: "evidence-staff", memberId: "member-a", fusionId: "F-A", episodeID: "episode-a" }
        : { supportingEvidenceID: "evidence-staff", toStatus: "Under Review" };
      const first = await coordinator.fetch(staffCommand(operation, `command-${operation}`, operationKey, initialPayload));
      assert.equal((await body(first)).state, "RECONCILIATION_REQUIRED");
      const recovery = await coordinator.fetch(staffCommand("RECONCILE", `reconcile-${operation}`, operationKey, {
        recoveryOperation: operation,
        supportingEvidenceID: "evidence-staff",
        ...(operation === "STAFF_CREATE" ? { memberId: "member-a", fusionId: "F-A", episodeID: "episode-a" } : { toStatus: "Under Review" }),
      }));
      assert.equal((await body(recovery)).state, "COMPLETE");
      assert.deepEqual(callbackBodies.map((entry) => entry.operation), [operation, "RECONCILE"]);
      assert.equal(calls, 2);
    }
  } finally {
    globalThis.fetch = previous;
  }
});

test("reconciliation command can recover an operation fenced in reconciliation-required state", async () => {
  const current = state();
  const previous = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    if (calls === 1) return Response.json({ ok: false, code: "STORAGE_RECONCILIATION_REQUIRED" }, { status: 409 });
    return callbackSuccess("operation-a", "reconcile-a");
  };
  try {
    const coordinator = new SupportingEvidenceCoordinator(current, { C0_BRIDGE_SIGNING_SECRET: "test-secret" });
    const operationKey = "operation-a";
    const first = await coordinator.fetch(command("command-a", "evidence-a", { fileName: "a.pdf" }, operationKey));
    assert.deepEqual(await body(first), { ok: false, state: "RECONCILIATION_REQUIRED", code: "STORAGE_RECONCILIATION_REQUIRED" });
    const recovery = await coordinator.fetch(new Request("https://coordinator/member-command", {
      method: "POST",
      body: JSON.stringify({
        operation: "RECONCILE",
        commandID: "reconcile-a",
        evidenceKey: "evidence-a",
        operationKey,
        fusionId: "F-A",
        wixMemberId: "member-a",
        payload: { supportingEvidenceID: "evidence-a", attemptID: "attempt-reconcile-a", fileSlotID: "slot-reconcile-a" },
      }),
    }));
    assert.deepEqual(await body(recovery), { ok: true, state: "COMPLETE", requestRef: "evidence-a", status: "Submitted in Response", closed: false });
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = previous;
  }
});

test("a stale generation cannot finalize after external work returns", async () => {
  const current = state();
  const started = Promise.withResolvers<void>();
  const released = Promise.withResolvers<Response>();
  const previous = globalThis.fetch;
  globalThis.fetch = async () => {
    started.resolve();
    return released.promise;
  };
  try {
    const coordinator = new SupportingEvidenceCoordinator(current, { C0_BRIDGE_SIGNING_SECRET: "test-secret" });
    const first = coordinator.fetch(command("command-a"));
    await started.promise;
    const running = await current.storage.get<Record<string, unknown>>("command:command-a");
    assert.ok(running);
    await current.storage.put("command:command-a", { ...running, generation: 2 });
    released.resolve(callbackSuccess("operation-command-a", "command-a"));
    assert.deepEqual(await body(await first), { ok: false, code: "STALE_COMMAND_GENERATION" });
  } finally {
    globalThis.fetch = previous;
  }
});

test("a stale generation is fenced before the Wix mutation boundary", async () => {
  const current = state();
  const previous = globalThis.fetch;
  let mutationCount = 0;
  let fenceResponse: Record<string, unknown> | null = null;
  let coordinator: SupportingEvidenceCoordinator;
  globalThis.fetch = async (_input, init) => {
    const callback = JSON.parse(String(init?.body)) as { coordinatorFence: Record<string, unknown> };
    const running = await current.storage.get<Record<string, unknown>>("command:command-a");
    await current.storage.put("command:command-a", { ...running, generation: 2 });
    const fenceBody = JSON.stringify({ operation: "FENCE", ...callback.coordinatorFence });
    const signed = buildC0BridgeRequest({ secret: "test-secret", path: "/api/internal/supporting-evidence-coordinator", body: fenceBody });
    const response = await coordinator.fetch(new Request("https://coordinator/wix-fence", { method: "POST", body: fenceBody, headers: signed.headers }));
    fenceResponse = await body(response);
    if ((fenceResponse as { ok?: boolean }).ok !== true) return Response.json({ ok: false, code: "STALE_COMMAND_GENERATION" }, { status: 409 });
    mutationCount += 1;
    return callbackSuccess("operation-command-a", "command-a");
  };
  try {
    coordinator = new SupportingEvidenceCoordinator(current, { C0_BRIDGE_SIGNING_SECRET: "test-secret" });
    const result = await coordinator.fetch(command("command-a"));
    assert.deepEqual(fenceResponse, { ok: false, code: "STALE_COMMAND_GENERATION" });
    assert.equal(mutationCount, 0);
    assert.deepEqual(await body(result), { ok: false, code: "STALE_COMMAND_GENERATION" });
  } finally {
    globalThis.fetch = previous;
  }
});

test("an acquired side-effect claim prevents stale takeover or generation advance", async () => {
  const current = state();
  const started = Promise.withResolvers<void>();
  const released = Promise.withResolvers<Response>();
  const previous = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    started.resolve();
    return released.promise;
  };
  try {
    const coordinator = new SupportingEvidenceCoordinator(current, { C0_BRIDGE_SIGNING_SECRET: "test-secret" });
    const first = coordinator.fetch(command("claimed-a"));
    await started.promise;
    const running = await current.storage.get<Record<string, unknown>>("command:claimed-a");
    await current.storage.put("command:claimed-a", { ...running, updatedAt: 0 });
    const second = await coordinator.fetch(command("claimed-b"));
    assert.equal(second.status, 202);
    assert.equal((await body(second)).state, "QUEUED");
    assert.equal(calls, 1);
    released.resolve(callbackSuccess("operation-claimed-a", "claimed-a"));
    await first;
  } finally {
    globalThis.fetch = previous;
  }
});

test("a reconstructed coordinator preserves an acquired claim and blocks duplicate side effects", async () => {
  const current = state();
  const started = Promise.withResolvers<void>();
  const released = Promise.withResolvers<Response>();
  const previous = globalThis.fetch;
  let callbackCount = 0;
  globalThis.fetch = async (_input, init) => {
    const parsed = JSON.parse(String(init?.body)) as { commandID?: string };
    if (parsed.commandID !== "restart-claim") throw new Error("UNEXPECTED_BACKGROUND_CALLBACK");
    callbackCount += 1;
    started.resolve();
    return released.promise;
  };
  try {
    const original = new SupportingEvidenceCoordinator(current, { C0_BRIDGE_SIGNING_SECRET: "test-secret" });
    const first = original.fetch(command("restart-claim", "evidence-a", { fileName: "restart.pdf" }, "operation-restart"));
    await started.promise;
    const persisted = await current.storage.get<Record<string, unknown>>("command:restart-claim");
    const persistedClaim = persisted?.sideEffectClaim as Record<string, unknown>;
    assert.equal(persistedClaim.state, "ACQUIRED");

    const reconstructed = new SupportingEvidenceCoordinator(current, { C0_BRIDGE_SIGNING_SECRET: "test-secret" });
    assert.notEqual(reconstructed, original);
    const reloaded = await current.storage.get<Record<string, unknown>>("command:restart-claim");
    const reloadedClaim = reloaded?.sideEffectClaim as Record<string, unknown>;
    for (const [field, value] of Object.entries({
      claimID: persistedClaim.claimID,
      commandID: persistedClaim.commandID,
      evidenceKey: persistedClaim.evidenceKey,
      operationKey: persistedClaim.operationKey,
      generation: persistedClaim.generation,
      phase: persistedClaim.phase,
    })) assert.equal(reloadedClaim[field], value, field);

    const retry = await reconstructed.fetch(command("restart-claim", "evidence-a", { fileName: "restart.pdf" }, "operation-restart"));
    assert.deepEqual(await body(retry), { ok: false, state: "RUNNING", code: "COORDINATOR_BUSY" });
    const conflicting = await reconstructed.fetch(command("restart-conflict", "evidence-a", { fileName: "restart.pdf" }, "operation-restart"));
    assert.deepEqual(await body(conflicting), { ok: false, state: "RUNNING", code: "COORDINATOR_BUSY" });
    assert.equal(callbackCount, 1);

    released.resolve(callbackSuccess("operation-restart", "restart-claim"));
    await first;
    assert.equal(callbackCount - 1, 0);
  } finally {
    globalThis.fetch = previous;
  }
});

test("an uncertain side-effect claim remains persisted and cannot be retried blindly after restart", async () => {
  const current = state();
  const previous = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("response lost after side effect"); };
  try {
    const coordinator = new SupportingEvidenceCoordinator(current, { C0_BRIDGE_SIGNING_SECRET: "test-secret" });
    const first = await coordinator.fetch(command("unknown-claim"));
    assert.equal((await body(first)).state, "RECONCILIATION_REQUIRED");
    const persisted = await current.storage.get<Record<string, unknown>>("command:unknown-claim");
    assert.equal((persisted?.sideEffectClaim as Record<string, unknown>)?.state, "UNKNOWN");
    const restarted = new SupportingEvidenceCoordinator(current, { C0_BRIDGE_SIGNING_SECRET: "test-secret" });
    const replay = await restarted.fetch(command("unknown-claim"));
    assert.equal((await body(replay)).code, "COORDINATOR_UNAVAILABLE");
  } finally {
    globalThis.fetch = previous;
  }
});

test("a successful callback with mismatched attempt or slot cannot complete storage", async () => {
  const current = state();
  const previous = globalThis.fetch;
  globalThis.fetch = async (_input, init) => {
    const parsed = JSON.parse(String(init?.body)) as { operationKey: string };
    return Response.json({ ok: true, requestRef: "evidence-a", status: "Submitted in Response", operationKey: parsed.operationKey, attemptID: "wrong-attempt", fileSlotIDs: ["wrong-slot"], closed: false });
  };
  try {
    const coordinator = new SupportingEvidenceCoordinator(current, { C0_BRIDGE_SIGNING_SECRET: "test-secret" });
    const result = await coordinator.fetch(command("mismatched-success", "evidence-a", { attemptID: "expected-attempt", fileSlotID: "expected-slot" }));
    assert.deepEqual(await body(result), { ok: false, state: "RECONCILIATION_REQUIRED", code: "CALLBACK_RESULT_INVALID" });
  } finally {
    globalThis.fetch = previous;
  }
});

test("callback success validation rejects arbitrary status, wrong operation, and wrong command schema", async () => {
  const cases = [
    { command: command("arbitrary-status"), result: { status: "Anything Goes" } },
    { command: command("wrong-operation"), result: { operationKey: "other-operation" } },
    { command: staffCommand("STAFF_CREATE", "wrong-command-type", "operation-wrong-command-type", { supportingEvidenceID: "evidence-staff", memberId: "member-a", fusionId: "F-A", episodeID: "episode-a" }), result: { status: "Submitted in Response", attemptID: "attempt-wrong-command-type", fileSlotIDs: ["slot-wrong-command-type"] } },
  ];
  const previous = globalThis.fetch;
  globalThis.fetch = async (_input, init) => {
    const parsed = JSON.parse(String(init?.body)) as { operationKey: string; commandID: string };
    const current = parsed.commandID === "arbitrary-status" ? cases[0].result : parsed.commandID === "wrong-operation" ? cases[1].result : cases[2].result;
    return Response.json({ ok: true, requestRef: "evidence-a", status: "Submitted in Response", operationKey: parsed.operationKey, attemptID: `attempt-${parsed.commandID}`, fileSlotIDs: [`slot-${parsed.commandID}`], closed: false, ...(current || {}) });
  };
  try {
    for (const entry of cases) {
      const coordinator = new SupportingEvidenceCoordinator(state(), { C0_BRIDGE_SIGNING_SECRET: "test-secret" });
      const result = await coordinator.fetch(entry.command);
      assert.deepEqual(await body(result), { ok: false, state: "RECONCILIATION_REQUIRED", code: "CALLBACK_RESULT_INVALID" });
    }
  } finally {
    globalThis.fetch = previous;
  }
});

test("a malformed successful Wix callback cannot complete a command", async () => {
  const current = state();
  const previous = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ ok: true });
  try {
    const coordinator = new SupportingEvidenceCoordinator(current, { C0_BRIDGE_SIGNING_SECRET: "test-secret" });
    const result = await coordinator.fetch(command("malformed-success"));
    assert.deepEqual(await body(result), { ok: false, state: "RECONCILIATION_REQUIRED", code: "CALLBACK_RESULT_INVALID" });
  } finally {
    globalThis.fetch = previous;
  }
});

test("stale running state cannot grant a new external-operation owner", async () => {
  const current = state();
  await current.storage.put("activeCommand", "old-command");
  await current.storage.put("command:old-command", {
    operation: "VOLUNTARY_SUBMIT",
    commandID: "old-command",
    evidenceKey: "evidence-a",
    fusionId: "F-A",
    wixMemberId: "member-a",
    payload: {},
    requestHash: "old-hash",
    state: "RUNNING",
    phase: "RUNNING",
    generation: 1,
    createdAt: 0,
    updatedAt: 0,
  });
  const previous = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; return Response.json({ ok: true }); };
  try {
    const coordinator = new SupportingEvidenceCoordinator(current, { C0_BRIDGE_SIGNING_SECRET: "test-secret" });
    const result = await coordinator.fetch(command("new-command"));
    assert.deepEqual(await body(result), { ok: false, state: "RECONCILIATION_REQUIRED", code: "ACTIVE_COMMAND_RECONCILIATION_REQUIRED" });
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = previous;
  }
});

test("the coordinator claim acknowledgement must identify the current persisted claim", async () => {
  const current = state();
  const started = Promise.withResolvers<void>();
  const released = Promise.withResolvers<Response>();
  const previous = globalThis.fetch;
  let coordinator: SupportingEvidenceCoordinator;
  globalThis.fetch = async () => {
    started.resolve();
    return released.promise;
  };
  try {
    coordinator = new SupportingEvidenceCoordinator(current, { C0_BRIDGE_SIGNING_SECRET: "test-secret" });
    const first = coordinator.fetch(command("claim-ack"));
    await started.promise;
    const persisted = await current.storage.get<Record<string, unknown>>("command:claim-ack");
    const claim = persisted?.sideEffectClaim as Record<string, unknown>;
    const claimBody = JSON.stringify({ operation: "CLAIM_ACK", ...claim, claimID: "wrong-claim" });
    const signed = buildC0BridgeRequest({ secret: "test-secret", path: "/api/internal/supporting-evidence-coordinator", body: claimBody });
    const result = await coordinator.fetch(new Request("https://coordinator/wix-fence", { method: "POST", body: claimBody, headers: signed.headers }));
    assert.equal(result.status, 409);
    assert.equal((await body(result)).code, "STALE_COMMAND_GENERATION");
    released.resolve(callbackSuccess("operation-claim-ack", "claim-ack"));
    await first;
  } finally {
    globalThis.fetch = previous;
  }
});

test("foreign claim acknowledgements cannot cross the evidence command boundary", async () => {
  const current = state();
  const started = Promise.withResolvers<void>();
  const released = Promise.withResolvers<Response>();
  const previous = globalThis.fetch;
  let coordinator: SupportingEvidenceCoordinator;
  globalThis.fetch = async () => { started.resolve(); return released.promise; };
  try {
    coordinator = new SupportingEvidenceCoordinator(current, { C0_BRIDGE_SIGNING_SECRET: "test-secret" });
    const first = coordinator.fetch(command("bound-claim"));
    await started.promise;
    const persisted = await current.storage.get<Record<string, unknown>>("command:bound-claim");
    const claim = persisted?.sideEffectClaim as Record<string, unknown>;
    for (const [field, value] of [["commandID", "other-command"], ["evidenceKey", "other-evidence"], ["operationKey", "other-operation"], ["generation", 2], ["phase", "STAFF_CREATE"]]) {
      const altered = JSON.stringify({ operation: "CLAIM_ACK", ...claim, [field]: value });
      const signed = buildC0BridgeRequest({ secret: "test-secret", path: "/api/internal/supporting-evidence-coordinator", body: altered });
      const result = await coordinator.fetch(new Request("https://coordinator/wix-fence", { method: "POST", body: altered, headers: signed.headers }));
      assert.equal(result.status, 409);
      assert.equal((await body(result)).code, "STALE_COMMAND_GENERATION");
    }
    released.resolve(callbackSuccess("operation-bound-claim", "bound-claim"));
    await first;
  } finally {
    globalThis.fetch = previous;
  }
});
