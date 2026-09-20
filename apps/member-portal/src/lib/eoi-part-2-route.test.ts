import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { mock } from "node:test";

mock.module("cloudflare:workers", {
  namedExports: {
    env: { MEMBER_LOGIN_SERVICE_URL: "https://member-login.example" },
  },
});
const { POST } = await import("../pages/api/eoi/part-2.ts");

const submissionID = `eoi-p2-submission-${"a".repeat(64)}`;
const originalFetch = globalThis.fetch;

function routeRequest() {
  return {
    request: new Request("https://portal.example/api/eoi/part-2", {
      method: "POST",
      headers: { cookie: "gf_member_session=test-session", "content-type": "application/json" },
      body: JSON.stringify({ answers: { firstName: "Test" } }),
    }),
  } as never;
}

async function runWithUpstream(body: unknown, status = 200, rawBody = JSON.stringify(body)) {
  globalThis.fetch = async (_input, init) => {
    assert.equal(init?.method, "POST");
    assert.equal(new Headers(init?.headers).get("cookie"), "gf_member_session=test-session");
    return new Response(rawBody, { status, headers: { "content-type": "application/json" } });
  };
  const response = await POST(routeRequest());
  return { status: response.status, body: await response.json() };
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("Member Portal Part 2 route rejects success responses without a usable submission ID", async () => {
  for (const body of [
    { ok: true },
    { ok: true, submissionID: "" },
    { ok: true, submissionID: "   " },
    { ok: true, submissionID: "legacy-id" },
  ]) {
    assert.deepEqual(await runWithUpstream(body), {
      status: 502,
      body: { ok: false, code: "SUBMISSION_UNAVAILABLE" },
    });
  }
});

test("Member Portal Part 2 route rejects malformed success-shaped 2xx responses", async () => {
  assert.deepEqual(await runWithUpstream(null, 200, "not-json"), {
    status: 502,
    body: { ok: false, code: "SUBMISSION_UNAVAILABLE" },
  });
  assert.deepEqual(await runWithUpstream({ ok: false, submissionID }), {
    status: 502,
    body: { ok: false, code: "SUBMISSION_UNAVAILABLE" },
  });
});

test("Member Portal Part 2 route returns canonical success and duplicate success", async () => {
  assert.deepEqual(await runWithUpstream({ ok: true, submissionID }), {
    status: 200,
    body: { ok: true, submissionID },
  });
  assert.deepEqual(await runWithUpstream({ ok: true, submissionID, duplicate: true }), {
    status: 200,
    body: { ok: true, submissionID, duplicate: true },
  });
});

test("Member Portal Part 2 route preserves backend validation and recovery categories", async () => {
  for (const [status, code] of [
    [400, "INVALID_SUBMISSION"],
    [400, "SUBMISSION_CONFLICT"],
    [400, "RECONCILIATION_REQUIRED"],
    [502, "TEMPORARY_PROCESSING_ERROR"],
  ] as const) {
    assert.deepEqual(await runWithUpstream({ ok: false, code }, status), {
      status,
      body: { ok: false, code },
    });
  }
});
