// @ts-nocheck

import assert from "node:assert/strict";
import { mock, test } from "node:test";

const secret = "local-synthetic-bridge-secret";
const PNG_DATA_URL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
const collections = new Map<string, Map<string, Record<string, unknown>>>();
const table = (name: string) => {
  let value = collections.get(name);
  if (!value) { value = new Map(); collections.set(name, value); }
  return value;
};
const data = {
  query(name: string) {
    const filters: Array<[string, string, unknown]> = [];
    const query = {
      eq(field: string, value: unknown) { filters.push(["eq", field, value]); return query; },
      gt(field: string, value: unknown) { filters.push(["gt", field, value]); return query; },
      lt(field: string, value: unknown) { filters.push(["lt", field, value]); return query; },
      limit(_value: number) { return query; },
      async find() {
        const items = [...table(name).values()].filter((item) => filters.every(([op, field, value]) => {
          if (op === "eq") return item[field] === value;
          return op === "gt" ? new Date(String(item[field])).getTime() > new Date(String(value)).getTime() : new Date(String(item[field])).getTime() < new Date(String(value)).getTime();
        }));
        return { items };
      },
    };
    return query;
  },
  async insert(name: string, item: Record<string, unknown>) {
    const target = table(name); const id = String(item._id);
    if (target.has(id)) throw new Error("DUPLICATE");
    target.set(id, { ...item }); return item;
  },
  async update(name: string, item: Record<string, unknown>) { table(name).set(String(item._id), { ...item }); return item; },
};

mock.module("cloudflare:workers", { namedExports: { env: { BETTER_AUTH_DB: {} , C0_BRIDGE_SIGNING_SECRET: secret } } });
mock.module("wix-secrets-backend", { namedExports: { getSecret: async () => secret } });
mock.module("wix-data", { defaultExport: data });
mock.module("wix-http-functions", { namedExports: {
  ok: ({ body, headers = {} }: any) => Response.json(body, { status: 200, headers }),
  badRequest: ({ body, headers = {} }: any) => Response.json(body, { status: 400, headers }),
  serverError: ({ body, headers = {} }: any) => Response.json(body, { status: 500, headers }),
} });

const { POST: post2 } = await import("../src/pages/api/auth/eoi-part-2.ts");
const { POST: post3 } = await import("../src/pages/api/auth/rfm-part3.ts");
const { POST: post4 } = await import("../src/pages/api/auth/rfm-part4.ts");
const { setPortalSubmissionTestAdapters, clearPortalSubmissionTestAdapters } = await import("../src/lib/portal-submission.ts");
const { createC0PortalSubmissionBridgeHandler } = await import("/Users/ccuser/gymfusion-wix-repo/src/backend/c0PortalSubmissionBridgeHandler.js");
const { submitEoiParts234Submission } = await import("/Users/ccuser/gymfusion-wix-repo/src/backend/eoiParts234SubmissionCore.js");

const mapping = new Map([["synthetic-user-a", { fusionId: "synthetic-fusion-a", wixMemberId: "synthetic-wix-member-a" }], ["synthetic-user-b", { fusionId: "synthetic-fusion-b", wixMemberId: "synthetic-wix-member-b" }]]);
const canonical = new Map([...mapping.values()].map((item) => [item.wixMemberId, { FUSIONID: item.fusionId, wixMemberID: item.wixMemberId }]));
table("MembersCurrent").set("synthetic-member-a", { _id: "synthetic-member-a", FUSIONID: "synthetic-fusion-a", eoiParts234SummaryJson: "{}" });
table("MembersCurrent").set("synthetic-member-b", { _id: "synthetic-member-b", FUSIONID: "synthetic-fusion-b", eoiParts234SummaryJson: "{}" });
table("EOIEpisodes").set("synthetic-episode-a", { _id: "synthetic-episode-a", episodeID: "synthetic-episode-a", wixMemberID: "synthetic-wix-member-a", episodeStatus: "open" });
const signatureReferences = new Map<string, any>();
let signatureStoreCalls = 0;
const signatureStoreFn = async ({ episodeID, part2SubmissionID, fusionId, signatureDataUrl }: any) => {
  signatureStoreCalls += 1;
  const sourceContentSha256 = signatureDataUrl === PNG_DATA_URL ? "a".repeat(64) : "b".repeat(64);
  const storageReferenceID = `synthetic-reference-${sourceContentSha256[0]}`;
  const reference = signatureReferences.get(storageReferenceID) || {
    _id: storageReferenceID,
    operationID: `synthetic-operation-${sourceContentSha256[0]}`,
    documentClass: "EOI_PART_2_SIGNATURE",
    lifecycleStatus: "STORED",
    FUSIONID: fusionId,
    episodeID,
    part2SubmissionID,
    sourceContentSha256,
  };
  signatureReferences.set(storageReferenceID, reference);
  return { ok: true, storageStatus: reference.lifecycleStatus, storageReferenceID, episodeID, part2SubmissionID, reference };
};
const linkStorageReferenceFn = async ({ storageReferenceID }: any) => {
  const reference = signatureReferences.get(storageReferenceID);
  if (!reference) return { ok: false, code: "STORAGE_REFERENCE_NOT_FOUND" };
  reference.lifecycleStatus = "LINKED";
  return { ok: true, record: reference };
};
const storageReferenceReadFn = async ({ storageReferenceID }: any) => {
  const record = signatureReferences.get(storageReferenceID);
  return record ? { ok: true, record } : { ok: false, code: "STORAGE_REFERENCE_NOT_FOUND" };
};
const usedNonces = new Set<string>();
const bridge = createC0PortalSubmissionBridgeHandler({
  getSecretFn: async () => secret,
  data,
  nonceStoreFactory: () => ({ has: async (nonce: string) => usedNonces.has(nonce), reserve: async (nonce: string) => { if (usedNonces.has(nonce)) return false; usedNonces.add(nonce); return true; } }),
  canonicalLookup: async (memberId: string) => ({ ok: canonical.has(memberId), canonicalRecord: canonical.get(memberId) }),
  submitFn: (input: any) => submitEoiParts234Submission({ ...input, collections: { eoiParts234Submissions: "EOIParts234SubmissionsImmutable", eoiParts234Answers: "EOIParts234SubmissionAnswers", eoiParts234CalculatedFields: "EOIParts234CalculatedFields", eoiParts234ConditionalFollowups: "EOIParts234ConditionalFollowups", membersCurrent: "MembersCurrent", documentStorageReferences: "DocumentStorageReferences" }, data, signatureDigestResolver: async (value: string) => ({ ok: true, sourceContentSha256: value === PNG_DATA_URL ? "a".repeat(64) : "b".repeat(64) }), signatureStoreFn, linkStorageReferenceFn, storageReferenceReadFn }),
});

let lastRequest: Request;
const sessionAdapter = async (request: Request) => ({ user: { id: request.headers.get("x-synthetic-user") || "synthetic-user-a" } });
const mappingAdapter = async (_db: D1Database, userId: string) => mapping.get(userId);
const bridgeFetch = async (_url: string, init?: RequestInit) => {
  lastRequest = new Request("http://local/_functions/member_portal_submission_bridge", init);
  return await bridge({ body: { text: async () => String(init?.body) }, headers: new Headers(init?.headers) } as any);
};
setPortalSubmissionTestAdapters({
  session: sessionAdapter,
  mapping: mappingAdapter,
  fetch: bridgeFetch,
});

function payload(part: "2" | "3" | "4", id: string, answer: string) {
  if (part === "2") return {
    formPart: "2",
    formVersion: 1,
    submissionID: id,
    answers: {
      healthInformationFirstName: "Synthetic",
      healthInformationLastName: "Member",
      healthInformationDate: "2026-09-18",
      healthInformationConsent: ["yes"],
      healthInformationSignature: PNG_DATA_URL,
      heartConditionStroke: "No",
      chestPainDiscomfort: "No",
      dizzyBalanceEpisodes: "No",
      bloodSugarCondition: "No",
      smokingVapingSkip: ["skip"],
      declaration: ["yes"],
    },
    normalizedAnswers: [{ fieldName: "syntheticAnswer", value: answer }],
    calculatedFields: {},
    conditionalFollowups: [],
  };
  return { formPart: part, formVersion: "synthetic-v1", submissionID: id, answers: { answer }, normalizedAnswers: [{ fieldName: "syntheticAnswer", value: answer }], calculatedFields: {}, conditionalFollowups: [] };
}
async function execute(route: any, part: "2" | "3" | "4", id: string, answer: string, user = "synthetic-user-a", injected: Record<string, unknown> = {}) {
  return route({ request: new Request("http://local/api", { method: "POST", headers: { "content-type": "application/json", "x-synthetic-user": user }, body: JSON.stringify({ ...payload(part, id, answer), ...injected }) }) });
}

test("imports real routes, client and Wix bridge in one runtime", () => assert.ok(post2 && post3 && post4));

test("malformed successful bridge responses never become canonical submission success", async () => {
  setPortalSubmissionTestAdapters({
    session: sessionAdapter,
    mapping: mappingAdapter,
    fetch: async () => Response.json({ ok: true }, { status: 200 }),
  });
  const result = await execute(post2, "2", "synthetic-malformed-success", "x");
  assert.equal(result.status, 502);
  assert.deepEqual(await result.json(), { ok: false, code: "SUBMISSION_UNAVAILABLE" });
  setPortalSubmissionTestAdapters({ session: sessionAdapter, mapping: mappingAdapter, fetch: bridgeFetch });
});

for (const [name, route, part] of [["Part 2", post2, "2"], ["Part 3", post3, "3"], ["Part 4", post4, "4"]] as const) {
  test(`${name} full chain, ownership and idempotency`, async () => {
    const id = `synthetic-${part}-a`;
    const first = await execute(route, part, id, `${name}-payload`);
    assert.equal(first.status, 200);
    const body = await first.json() as any;
    assert.equal(body.ok, true);
    const duplicate = await execute(route, part, id, `${name}-payload`);
    assert.equal(duplicate.status, 200);
    assert.equal((await duplicate.json() as any).duplicate, true);
    const signed = JSON.parse(String((await lastRequest.clone().text())));
    assert.equal(signed.fusionId, "synthetic-fusion-a");
    assert.equal(signed.wixMemberId, "synthetic-wix-member-a");
    const persisted = [...table("EOIParts234SubmissionsImmutable").values()].find((item) => item.wixMemberID === "synthetic-wix-member-a" && item.eoiPart === part);
    assert.equal(persisted?.wixMemberID, "synthetic-wix-member-a");
  });
}

test("browser identity injection and cross-member attempt fail closed", async () => {
  const result = await execute(post2, "2", "synthetic-forged", "x", "synthetic-user-b", { fusionId: "synthetic-fusion-a", wixMemberId: "synthetic-wix-member-a" });
  assert.equal(result.status, 400);
  assert.equal(table("EOIParts234SubmissionsImmutable").has("synthetic-forged"), false);
  clearPortalSubmissionTestAdapters();
});
