// @ts-nocheck

import assert from "node:assert/strict";
import test from "node:test";
import { DocumentStorageReferenceCoordinator } from "../src/lib/document-storage-reference-coordinator.ts";
import { SupportingEvidenceCoordinator } from "../src/lib/supporting-evidence-coordinator.ts";
import { buildC0BridgeRequest } from "../src/lib/c0-bridge-hmac.ts";

const secret = "production-path-synthetic-secret";
const collections = {
  canonical: "CanonicalIdentityRegistry",
  episodes: "EOIEpisodes",
  submissions: "EOISubmissionsImmutable",
  supportingEvidence: "EOISupportingEvidence",
  references: "DocumentStorageReferences",
};

const tables = new Map();
const table = (name) => {
  let rows = tables.get(name);
  if (!rows) { rows = new Map(); tables.set(name, rows); }
  return rows;
};

const data = {
  query(name) {
    const filters = [];
    const query = {
      eq(field, value) { filters.push([field, value]); return query; },
      limit() { return query; },
      descending() { return query; },
      async find() {
        return { items: [...table(name).values()].filter((row) => filters.every(([field, value]) => row[field] === value)) };
      },
    };
    return query;
  },
  async insert(name, row) {
    const rows = table(name);
    if (rows.has(String(row._id))) throw new Error("DUPLICATE_ID");
    rows.set(String(row._id), { ...row });
    return { ...row };
  },
  async update(name, row) {
    table(name).set(String(row._id), { ...row });
    return { ...row };
  },
};

globalThis.__syntheticWixData = data;
const { createC0SupportingEvidenceCoordinatorHandler } = await import("/Users/ccuser/gymfusion-wix-repo/src/backend/c0SupportingEvidenceCoordinatorHandler.js");
const { createC0DocumentStorageReferenceCoordinatorHandler } = await import("/Users/ccuser/gymfusion-wix-repo/src/backend/c0DocumentStorageReferenceCoordinatorHandler.js");
const { enterDocumentStorageReferenceMutation, startDocumentStorageReferenceMutation } = await import("/Users/ccuser/gymfusion-wix-repo/src/backend/documentStorageReferenceCoordinatorClient.js");

const slotIDs = ["a", "b", "c", "d", "e"].map((value) => `slot-${value.repeat(16)}`);
const attachment = (index) => ({ storageReferenceID: `storage-${index}`, fileSlotID: slotIDs[index], fileName: `file-${index}.pdf`, fileType: "application/pdf", fileSize: 5, uploadedAt: "2026-09-15T01:02:03.000Z" });

function resetData() {
  tables.clear();
  table(collections.canonical).set("canonical-a", { _id: "canonical-a", FUSIONID: "F-A", wixMemberID: "member-a", crmContactID: "contact-a" });
  table(collections.episodes).set("episode-a", { _id: "episode-a", episodeID: "episode-a", wixMemberID: "member-a", episodeStatus: "open" });
  table(collections.submissions).set("submission-a", { _id: "submission-a", submissionID: "submission-a", episodeID: "episode-a" });
  const attemptID = "attempt-production";
  table(collections.supportingEvidence).set("evidence-production", {
    _id: "evidence-production",
    supportingEvidenceID: "evidence-production",
    FUSIONID: "F-A",
    wixMemberID: "member-a",
    crmContactID: "contact-a",
    episodeID: "episode-a",
    intakeMode: "requested",
    requestStatus: "Evidence Requested",
    requestReason: "Please provide clearance",
    submissionAttempts: [{
      attemptID,
      submittedAt: null,
      attachments: [0, 1, 2, 3].map(attachment),
      fileManifest: {
        attemptID,
        createdAt: "2026-09-15T01:02:03.000Z",
        slots: slotIDs.map((fileSlotID, index) => ({ fileSlotID, fileName: index === 4 ? "fifth.pdf" : `file-${index}.pdf`, fileType: "application/pdf", fileSize: 5, status: index === 4 ? "OPEN" : "LINKED" })),
      },
    }],
  });
  for (let index = 0; index < 4; index += 1) {
    table(collections.references).set(`storage-${index}`, {
      _id: `storage-${index}`,
      operationID: `operation-${index}`,
      storageProvider: "SHAREPOINT_GRAPH",
      storageDriveKey: "GYMFUSION_MEMBERS",
      documentClass: "EOI_SUPPORTING_EVIDENCE",
      lifecycleStatus: "LINKED",
      FUSIONID: "F-A",
      episodeID: "episode-a",
      supportingEvidenceID: "evidence-production",
      attemptID,
      fileSlotID: slotIDs[index],
      driveItemId: `drive-${index}`,
      parentDriveItemId: "folder-supporting-evidence",
      storedFileName: `file-${index}.pdf`,
      originalFileName: `file-${index}.pdf`,
      contentType: "application/pdf",
      byteSize: 5,
      uploadedAt: "2026-09-15T01:02:03.000Z",
      linkedAt: "2026-09-15T01:02:03.000Z",
    });
  }
  return { attemptID };
}

function command(commandID, operationKey, attemptID) {
  return new Request("https://coordinator/member-command", {
    method: "POST",
    body: JSON.stringify({
      operation: "RESPOND",
      commandID,
      evidenceKey: "evidence-production",
      operationKey,
      fusionId: "F-A",
      wixMemberId: "member-a",
      payload: {
        requestRef: "evidence-production",
        attemptID,
        attachment: { reference: `synthetic-${commandID}`, fileName: "fifth.pdf", fileType: "application/pdf", fileSize: 5, fileSlotID: slotIDs[4], contentBase64: Buffer.from("fifth").toString("base64") },
        idempotencyKey: commandID,
      },
    }),
  });
}

async function jsonBody(response) { return response.json(); }

test("Wix callback rejects a bare successful claim acknowledgement", async () => {
  let domainReads = 0;
  const handler = createC0SupportingEvidenceCoordinatorHandler({
    getSecretFn: async () => secret,
    data,
    verifyFn: async () => ({ ok: true }),
    canonicalLookup: async () => { domainReads += 1; return { ok: true, canonicalRecord: { FUSIONID: "F-A" } }; },
    fenceFn: async () => ({ ok: true }),
  });
  const claim = { claimID: "claim-a", commandID: "command-a", evidenceKey: "evidence-a", operationKey: "operation-a", generation: 1, phase: "RESPOND" };
  const result = await handler({
    body: { text: async () => JSON.stringify({ operation: "RESPOND", commandID: "command-a", evidenceKey: "evidence-a", operationKey: "operation-a", fusionId: "F-A", wixMemberId: "member-a", coordinatorClaim: claim, payload: { requestRef: "evidence-a", attachment: { reference: "file-a", fileName: "a.pdf", fileType: "application/pdf", fileSize: 1 } } }) },
    headers: new Headers(),
  });
  assert.equal(result.status, 400);
  assert.equal((await result.json()).code, "STALE_COMMAND_GENERATION");
  assert.equal(domainReads, 0);
});

test("real coordinator-to-Wix callback path permits one fifth file under genuine overlap", async () => {
  resetData();
  const entered = Promise.withResolvers();
  const release = Promise.withResolvers();
  let storageCalls = 0;
  let callbackCalls = 0;
  const storageAdapter = {
    async storeFile(input) {
      storageCalls += 1;
      entered.resolve();
      await release.promise;
      return { ok: true, metadata: { driveItemId: "drive-fifth", parentItemId: "folder-supporting-evidence", storedFileName: input.fileName, contentType: input.contentType, byteSize: input.fileSize, uploadedAt: "2026-09-15T01:02:03.000Z" } };
    },
  };
  let coordinator;
  let referenceCoordinator;
  let referenceHandler;
  const fenceFn = async ({ coordinatorClaim }) => {
    const body = JSON.stringify({ operation: "CLAIM_ACK", ...coordinatorClaim });
    const signed = buildC0BridgeRequest({ secret, path: "/api/internal/supporting-evidence-coordinator", body });
    const result = await coordinator.fetch(new Request("https://coordinator/wix-fence", { method: "POST", body, headers: signed.headers }));
    return result.json();
  };
  const handler = createC0SupportingEvidenceCoordinatorHandler({
    getSecretFn: async () => secret,
    data,
    verifyFn: async () => ({ ok: true }),
    canonicalLookup: async () => ({ ok: true, canonicalRecord: { FUSIONID: "F-A", wixMemberID: "member-a" } }),
    fenceFn,
    storageAdapter,
    writeAuditEvent: async () => {},
    referenceCoordinatorClient: {
      startDocumentStorageReferenceMutation: (options) => startDocumentStorageReferenceMutation({ ...options, fetchFn: globalThis.fetch, getSecretFn: async () => secret }),
    },
    now: () => Date.now(),
  });
  referenceCoordinator = new DocumentStorageReferenceCoordinator({
    storage: {
      values: new Map(),
      async get(key) { return this.values.get(key); },
      async put(key, value) { this.values.set(key, value); },
    },
    blockConcurrencyWhile(callback) { return callback(); },
  }, {
    C0_BRIDGE_SIGNING_SECRET: secret,
    DOCUMENT_STORAGE_REFERENCE_COORDINATOR_CALLBACK_URL: "https://document-callback",
  });
  const enterReference = (options) => enterDocumentStorageReferenceMutation({ ...options, fetchFn: globalThis.fetch, getSecretFn: async () => secret });
  referenceHandler = createC0DocumentStorageReferenceCoordinatorHandler({
    getSecretFn: async () => secret,
    data,
    verifyFn: async () => ({ ok: true }),
    enterFn: enterReference,
  });
  const previous = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    const url = String(_url);
    const rawBody = String(init?.body || "");
    if (url.includes("/api/internal/document-storage-reference-coordinator")) {
      const body = JSON.parse(rawBody);
      const path = body.operation === "START" ? "start" : body.operation === "ENTER_MUTATION" ? "enter" : "resolve";
      return referenceCoordinator.fetch(new Request(`https://reference-coordinator/${path}`, { method: "POST", body: rawBody, headers: init?.headers }));
    }
    if (url === "https://document-callback") {
      return referenceHandler({ body: { text: async () => rawBody }, headers: new Headers(init?.headers) });
    }
    callbackCalls += 1;
    return handler({ body: { text: async () => rawBody }, headers: new Headers(init?.headers) });
  };
  try {
    coordinator = new SupportingEvidenceCoordinator({
      storage: {
        values: new Map(),
        async get(key) { return this.values.get(key); },
        async put(key, value) { this.values.set(key, value); },
        async delete(key) { this.values.delete(key); },
        async list({ prefix } = {}) { return new Map([...this.values.entries()].filter(([key]) => !prefix || key.startsWith(prefix))); },
      },
      blockConcurrencyWhile(callback) { return callback(); },
      waitUntil(promise) { this.waits ||= []; this.waits.push(promise); },
      waits: [],
    }, { C0_BRIDGE_SIGNING_SECRET: secret, SUPPORTING_EVIDENCE_COORDINATOR_CALLBACK_URL: "https://local-callback" });
    const first = coordinator.fetch(command("production-a", "operation-production-a", "attempt-production"));
    await entered.promise;
    const second = await coordinator.fetch(command("production-b", "operation-production-b", "attempt-production"));
    assert.equal(second.status, 202);
    release.resolve();
    const firstResult = await jsonBody(await first);
    await Promise.all(coordinator.state?.waits || []);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const secondResult = await jsonBody(await coordinator.fetch(command("production-b", "operation-production-b", "attempt-production")));
    assert.equal(firstResult.state, "COMPLETE");
    assert.equal(secondResult.state, "RECONCILIATION_REQUIRED");
    assert.equal(storageCalls, 1);
    assert.equal(callbackCalls, 2);
    assert.equal(table(collections.supportingEvidence).get("evidence-production").submissionAttempts[0].attachments.length, 5);
    assert.equal(table(collections.references).size, 5);
  } finally {
    globalThis.fetch = previous;
  }
});
