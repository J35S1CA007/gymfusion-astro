import assert from "node:assert/strict";
import test from "node:test";
import { readMemberPortalView } from "./member-portal-read.ts";

const completePart3 = {
  completed: true,
  formVersion: 1,
  submittedAt: "2026-09-20T00:00:00.000Z",
  answers: {
    injuries: ["current_injury"],
    injuryDetails: "A current limitation that affects safe training and needs to be considered.",
    needs: ["health_condition"],
    needsDetails: "An ongoing health condition that requires suitable training adjustments.",
  },
};

const responseFor = (view: string, part3: unknown = { completed: false }, extraData: Record<string, unknown> = {}) => Response.json({
  authenticated: true,
  ok: true,
  view,
  data: { ...extraData, part3 },
});

const response = (part3: unknown = { completed: false }, extraData: Record<string, unknown> = {}) => responseFor("eoi", part3, extraData);

const request = () => new Request("https://portal.gymfusion.com.au/eoi", { headers: { cookie: "gf_member_session=test" } });

test("accepts valid EOI reads and preserves trusted completion data", async () => {
  for (const upstream of [response(), response(completePart3), response({ completed: false }, { state: "no_active_episode" })]) {
    const result = await readMemberPortalView(request(), "https://login.example", "eoi", async () => upstream.clone());
    assert.equal(result.kind, "authenticated");
    if (result.kind === "authenticated") {
      assert.equal(result.view, "eoi");
      assert.ok(result.data.part3);
    }
  }
});

test("accepts the dashboard Part 3 completion contract", async () => {
  for (const completed of [false, true]) {
    const result = await readMemberPortalView(request(), "https://login.example", "dashboard", async () => responseFor("dashboard", { completed }));
    assert.equal(result.kind, "authenticated");
    if (result.kind === "authenticated") assert.deepEqual(result.data.part3, { completed });
  }
});

test("rejects malformed authenticated success, wrong view, service failure, and invalid Part 3", async () => {
  const malformed = [
    Response.json({ authenticated: true, ok: true, view: "eoi", data: {} }),
    Response.json({ authenticated: true, ok: true, view: "eoi", data: { part3: { completed: true } } }),
    Response.json({ authenticated: true, ok: true, view: "dashboard", data: { part3: { completed: false } } }),
    Response.json({ authenticated: true, ok: true, view: "eoi", data: { part3: { completed: true, formVersion: 2, submittedAt: "2026-09-20T00:00:00.000Z", answers: completePart3.answers } } }),
  ];
  for (const upstream of malformed) {
    const result = await readMemberPortalView(request(), "https://login.example", "eoi", async () => upstream.clone());
    assert.deepEqual(result, { kind: "unavailable" });
  }

  assert.deepEqual(await readMemberPortalView(request(), "https://login.example", "eoi", async () => new Response(JSON.stringify({ authenticated: false }), { status: 401 })), { kind: "unauthenticated" });
  assert.deepEqual(await readMemberPortalView(request(), "https://login.example", "eoi", async () => new Response(JSON.stringify({ ok: false }), { status: 503 })), { kind: "unavailable" });
  assert.deepEqual(await readMemberPortalView(request(), "https://login.example", "not-a-view", async () => Response.json({})), { kind: "unavailable" });
});

test("rejects malformed Part 3 shapes at the Portal trust boundary", async () => {
  const { needsDetails: _missingNeedsDetails, ...answersWithoutNeedsDetails } = completePart3.answers;
  const malformedParts: Array<[string, unknown]> = [
    ["duplicate injury values", { ...completePart3, answers: { ...completePart3.answers, injuries: ["current_injury", "current_injury"] } }],
    ["mixed no_issues selection", { ...completePart3, answers: { ...completePart3.answers, injuries: ["no_issues", "current_injury"] } }],
    ["non-array injuries", { ...completePart3, answers: { ...completePart3.answers, injuries: "current_injury" } }],
    ["missing required needs details", { ...completePart3, answers: answersWithoutNeedsDetails }],
    ["short required needs details", { ...completePart3, answers: { ...completePart3.answers, needsDetails: "short" } }],
    ["long required needs details", { ...completePart3, answers: { ...completePart3.answers, needsDetails: "x".repeat(501) } }],
    ["hidden details are not canonical empty", { ...completePart3, answers: { ...completePart3.answers, injuries: ["no_issues"], injuryDetails: "hidden", needs: ["none"], needsDetails: "hidden" } }],
  ];

  for (const [name, part3] of malformedParts) {
    const result = await readMemberPortalView(request(), "https://login.example", "eoi", async () => response(part3));
    assert.deepEqual(result, { kind: "unavailable" }, name);
  }
  for (const malformedEnvelope of [null, []]) {
    const result = await readMemberPortalView(request(), "https://login.example", "eoi", async () => Response.json(malformedEnvelope));
    assert.deepEqual(result, { kind: "unavailable" }, "non-object response envelope");
  }
});

test("missing session remains unauthenticated before contacting Member Login", async () => {
  let calls = 0;
  const result = await readMemberPortalView(new Request("https://portal.gymfusion.com.au/eoi"), "https://login.example", "eoi", async () => {
    calls += 1;
    return Response.json({});
  });
  assert.deepEqual(result, { kind: "unauthenticated" });
  assert.equal(calls, 0);
});
