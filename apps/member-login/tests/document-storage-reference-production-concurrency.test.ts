// @ts-nocheck

import assert from "node:assert/strict";
import test from "node:test";
import { DocumentStorageReferenceCoordinator } from "../src/lib/document-storage-reference-coordinator.ts";

const SECRET = "local-synthetic-bridge-secret";
const COORDINATOR_URL = "https://portal.gymfusion.com.au/api/internal/document-storage-reference-coordinator";
const CALLBACK_URL = "https://www.gymfusion.com.au/_functions/member_portal_document_storage_reference_coordinator_callback";

const {
  DOCUMENT_STORAGE_DOCUMENT_CLASSES,
  DOCUMENT_STORAGE_LIFECYCLE_STATUSES,
  createOrReuseDocumentStorageReferenceCoordinated,
  createPendingDocumentStorageReference,
  deriveCanonicalStorageReferenceID,
} = await import("/Users/ccuser/gymfusion-wix-repo/src/backend/documentStorageReferenceCore.js");
const { startDocumentStorageReferenceMutation } = await import("/Users/ccuser/gymfusion-wix-repo/src/backend/documentStorageReferenceCoordinatorClient.js");
const { createC0DocumentStorageReferenceCoordinatorHandler } = await import("/Users/ccuser/gymfusion-wix-repo/src/backend/c0DocumentStorageReferenceCoordinatorHandler.js");

const now = "2026-09-18T01:02:03.000Z";

function deferred() {
  let resolve;
  const promise = new Promise((nextResolve) => { resolve = nextResolve; });
  return { promise, resolve };
}

async function deadline(promise, label) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`TIMEOUT:${label}`)), 5000); }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function serializedState() {
  const values = new Map();
  let queue = Promise.resolve();
  return {
    storage: {
      async get(key) { return values.get(key); },
      async put(key, value) { values.set(key, value); },
    },
    blockConcurrencyWhile(callback) {
      const next = queue.then(callback);
      queue = next.catch(() => undefined);
      return next;
    },
  };
}

function dataStore(initialRows = [], { beforeFind, beforeInsert, beforeUpdate } = {}) {
  const rows = new Map(initialRows.map((row) => [String(row._id), { ...row }]));
  let inserts = 0;
  let updates = 0;
  return {
    rows,
    get counts() { return { inserts, updates }; },
    query(collection) {
      const filters = [];
      const query = {
        eq(field, value) { filters.push([field, value]); return query; },
        limit() { return query; },
        async find() {
          await beforeFind?.({ collection, filters });
          return {
            items: [...rows.values()]
              .filter((row) => filters.every(([field, value]) => row[field] === value))
              .map((row) => ({ ...row })),
          };
        },
      };
      return query;
    },
    async insert(_collection, row) {
      inserts += 1;
      await beforeInsert?.(row);
      if (rows.has(String(row._id))) throw new Error("DUPLICATE_ID");
      rows.set(String(row._id), { ...row });
      return { ...row };
    },
    async update(_collection, row) {
      updates += 1;
      await beforeUpdate?.(row);
      if (!rows.has(String(row._id))) throw new Error("MISSING_REFERENCE");
      rows.set(String(row._id), { ...row });
      return { ...row };
    },
  };
}

function createHarness(data) {
  const state = serializedState();
  const coordinator = new DocumentStorageReferenceCoordinator(state, {
    C0_BRIDGE_SIGNING_SECRET: SECRET,
    DOCUMENT_STORAGE_REFERENCE_COORDINATOR_CALLBACK_URL: CALLBACK_URL,
  });
  const usedCallbackNonces = new Set();
  const callbackRequests = [];
  const handler = createC0DocumentStorageReferenceCoordinatorHandler({
    getSecretFn: async () => SECRET,
    data,
    nonceStoreFactory: () => ({
      async has(nonce) { return usedCallbackNonces.has(nonce); },
      async reserve(nonce) {
        if (usedCallbackNonces.has(nonce)) return false;
        usedCallbackNonces.add(nonce);
        return true;
      },
    }),
    now: () => Date.now(),
  });
  const coordinatorRequests = [];
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    const rawBody = String(init.body || "");
    if (url === COORDINATOR_URL) {
      const body = JSON.parse(rawBody);
      const path = body.operation === "START" ? "start" : body.operation === "ENTER_MUTATION" ? "enter" : "resolve";
      coordinatorRequests.push({ path, storageReferenceID: body.storageReferenceID, commandID: body.commandID });
      const response = await coordinator.fetch(new Request(`https://reference-coordinator/${path}`, {
        method: "POST",
        body: rawBody,
        headers: init.headers,
      }));
      return response;
    }
    if (url === CALLBACK_URL) {
      callbackRequests.push(JSON.parse(rawBody));
      const response = await handler({
        body: { text: async () => rawBody },
        headers: new Headers(init.headers),
      });
      return response;
    }
    throw new Error(`UNEXPECTED_EXTERNAL_REQUEST:${url}`);
  };
  return {
    coordinator,
    coordinatorRequests,
    callbackRequests,
    restore() { globalThis.fetch = previousFetch; },
  };
}

function logicalReferenceInput() {
  return {
    operationID: "operation-concurrent-create",
    storageProvider: "SHAREPOINT_GRAPH",
    storageDriveKey: "GYMFUSION_MEMBERS",
    documentClass: DOCUMENT_STORAGE_DOCUMENT_CLASSES.EOI_SUPPORTING_EVIDENCE,
    FUSIONID: "FUSION-CONCURRENT",
    episodeID: "episode-concurrent",
    supportingEvidenceID: "evidence-concurrent",
    attemptID: "attempt-concurrent",
    fileSlotID: "slot-concurrent",
  };
}

function transitionContext() {
  return createPendingDocumentStorageReference({
    _id: "storage-reference-transition",
    operationID: "operation-transition",
    storageProvider: "SHAREPOINT_GRAPH",
    storageDriveKey: "GYMFUSION_MEMBERS",
    documentClass: DOCUMENT_STORAGE_DOCUMENT_CLASSES.EOI_SUPPORTING_EVIDENCE,
    FUSIONID: "FUSION-TRANSITION",
    episodeID: "episode-transition",
    supportingEvidenceID: "evidence-transition",
    attemptID: "attempt-transition",
    fileSlotID: "slot-transition",
  }, { now: new Date(now) });
}

function mutationClient(commandPrefix) {
  let sequence = 0;
  return {
    startDocumentStorageReferenceMutation(options) {
      sequence += 1;
      return startDocumentStorageReferenceMutation({
        ...options,
        commandID: `${commandPrefix}-${sequence}`,
        fetchFn: globalThis.fetch,
        getSecretFn: async () => SECRET,
      });
    },
  };
}

test("same-operation creation uses one real coordinator identity and one Wix insert", async () => {
  const bothInitialReads = deferred();
  const releaseInsert = deferred();
  let operationReads = 0;
  let insertEntered;
  const insertStarted = new Promise((resolve) => { insertEntered = resolve; });
  const data = dataStore([], {
    beforeFind: async ({ filters }) => {
      if (filters.some(([field, value]) => field === "operationID" && value === "operation-concurrent-create")) {
        operationReads += 1;
        if (operationReads === 2) bothInitialReads.resolve();
        if (operationReads <= 2) await bothInitialReads.promise;
      }
    },
    beforeInsert: async () => {
      insertEntered();
      await releaseInsert.promise;
    },
  });
  const harness = createHarness(data);
  try {
    const input = logicalReferenceInput();
    const expectedReferenceID = await deriveCanonicalStorageReferenceID(input);
    const client = mutationClient("create-concurrent");
    const first = createOrReuseDocumentStorageReferenceCoordinated({ data, input, coordinatorClient: client, now: new Date(now) });
    const second = createOrReuseDocumentStorageReferenceCoordinated({ data, input, coordinatorClient: client, now: new Date(now) });
    await deadline(bothInitialReads.promise, "both-initial-reads");
    assert.equal(data.counts.inserts, 0);
    try {
      await deadline(insertStarted, "insert-started");
    } catch (error) {
      releaseInsert.resolve();
      throw error;
    }
    assert.equal(data.counts.inserts, 1);
    releaseInsert.resolve();
    const results = await Promise.all([first, second]);
    assert.equal(results.filter((result) => result.ok).length, 1);
    assert.equal(results.filter((result) => !result.ok).length, 1);
    const winner = results.find((result) => result.ok);
    assert.equal(winner.record._id, expectedReferenceID);
    assert.equal(data.rows.size, 1);
    assert.deepEqual([...data.rows.keys()], [expectedReferenceID]);
    assert.equal(new Set(harness.coordinatorRequests.map((request) => request.storageReferenceID)).size, 1);
    assert.equal(new Set(harness.coordinatorRequests.map((request) => request.path)).has("enter"), true);
    assert.equal(data.counts.inserts, 1);
    const retry = await createOrReuseDocumentStorageReferenceCoordinated({ data, input, coordinatorClient: client, now: new Date(now) });
    assert.equal(retry.ok, true);
    assert.equal(retry.reused, true);
    assert.equal(retry.record._id, expectedReferenceID);
    assert.equal(data.counts.inserts, 1);
  } finally {
    harness.restore();
  }
});

test("same-reference incompatible transitions serialize at the real coordinator and Wix boundary", async () => {
  const initial = transitionContext();
  const updateStarted = deferred();
  const releaseUpdate = deferred();
  let inFlight = 0;
  let maximumInFlight = 0;
  let startRequests = 0;
  const bothStartRequests = deferred();
  const data = dataStore([initial], {
    beforeUpdate: async () => {
      inFlight += 1;
      maximumInFlight = Math.max(maximumInFlight, inFlight);
      updateStarted.resolve();
      await releaseUpdate.promise;
      inFlight -= 1;
    },
  });
  const harness = createHarness(data);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    if (url === COORDINATOR_URL) {
      const body = JSON.parse(String(init.body || ""));
      if (body.operation === "START") {
        startRequests += 1;
        if (startRequests === 2) bothStartRequests.resolve();
      }
    }
    return originalFetch(input, init);
  };
  try {
    const storedMutation = {
      kind: "TRANSITION",
      toStatus: DOCUMENT_STORAGE_LIFECYCLE_STATUSES.STORED,
      expectedLifecycleStatus: DOCUMENT_STORAGE_LIFECYCLE_STATUSES.PENDING,
      storageMetadata: {
        driveItemId: "drive-transition",
        parentDriveItemId: "folder-transition",
        storedFileName: "transition.pdf",
        contentType: "application/pdf",
        byteSize: 5,
      },
    };
    const reconciliationMutation = {
      kind: "TRANSITION",
      toStatus: DOCUMENT_STORAGE_LIFECYCLE_STATUSES.RECONCILIATION_REQUIRED,
      expectedLifecycleStatus: DOCUMENT_STORAGE_LIFECYCLE_STATUSES.PENDING,
      lastErrorCode: "UNKNOWN_RESULT",
    };
    const first = startDocumentStorageReferenceMutation({
      context: initial,
      mutation: storedMutation,
      commandID: "transition-stored",
      fetchFn: globalThis.fetch,
      getSecretFn: async () => SECRET,
    });
    const second = startDocumentStorageReferenceMutation({
      context: initial,
      mutation: reconciliationMutation,
      commandID: "transition-reconcile",
      fetchFn: globalThis.fetch,
      getSecretFn: async () => SECRET,
    });
    await deadline(bothStartRequests.promise, "both-start-requests");
    await deadline(updateStarted.promise, "update-started");
    assert.equal(maximumInFlight, 1);
    assert.equal(data.counts.updates, 1);
    releaseUpdate.resolve();
    const [firstResult, secondResult] = await Promise.all([first, second]);
    assert.equal(firstResult.ok, true);
    assert.equal(secondResult.ok, false);
    assert.equal(secondResult.code, "REFERENCE_MUTATION_BUSY");
    const retry = await startDocumentStorageReferenceMutation({
      context: initial,
      mutation: reconciliationMutation,
      commandID: "transition-reconcile",
      fetchFn: globalThis.fetch,
      getSecretFn: async () => SECRET,
    });
    assert.equal(retry.ok, false);
    assert.equal(retry.code, "COORDINATOR_BUSY");
    assert.equal(harness.callbackRequests.length, 2);
    assert.equal(harness.coordinatorRequests.filter((request) => request.path === "enter").length, 1);
    assert.equal(data.counts.updates, 1);
    assert.equal(data.rows.get(initial._id).lifecycleStatus, DOCUMENT_STORAGE_LIFECYCLE_STATUSES.STORED);
    assert.equal(maximumInFlight, 1);
  } finally {
    harness.restore();
  }
});
