import assert from "node:assert/strict";
import test from "node:test";
import { checkMemberLoginSession } from "./member-login-session.ts";

const request = (cookie?: string) => new Request("http://127.0.0.1:4322/dashboard", cookie ? { headers: { cookie } } : undefined);

test("missing session cookie redirects without contacting Members Login", async () => {
  let called = false;
  const result = await checkMemberLoginSession(request(), "http://127.0.0.1:4555", async () => {
    called = true;
    return new Response();
  });
  assert.deepEqual(result, { kind: "redirect" });
  assert.equal(called, false);
});

test("authenticated session permits the neutral Dashboard shell and forwards the Better Auth cookie header", async () => {
  let receivedCookie = "";
  const result = await checkMemberLoginSession(request("gf_member_session=test-session; unrelated=blocked"), "http://127.0.0.1:4555", async (_url, init) => {
    receivedCookie = String(new Headers(init.headers).get("cookie"));
    return Response.json({ authenticated: true, member: { displayName: "Jess" } });
  });
  assert.deepEqual(result, { kind: "authenticated", displayName: "Jess" });
  assert.equal(receivedCookie, "gf_member_session=test-session; unrelated=blocked");
});

test("401, malformed, redirect and upstream failures fail closed", async () => {
  const responses = [
    new Response(JSON.stringify({ authenticated: false }), { status: 401 }),
    new Response("not-json", { status: 200 }),
    new Response(null, { status: 302, headers: { location: "/login" } }),
  ];
  for (const response of responses) {
    const result = await checkMemberLoginSession(request("gf_member_session=test-session"), "http://127.0.0.1:4555", async () => response);
    assert.ok(result.kind === "redirect" || result.kind === "unavailable");
  }
  assert.deepEqual(await checkMemberLoginSession(request("gf_member_session=test-session"), "http://127.0.0.1:4555", async () => { throw new Error("upstream"); }), { kind: "unavailable" });
});
