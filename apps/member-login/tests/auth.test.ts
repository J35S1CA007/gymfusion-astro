import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { beginLogin, clearSession, completeLogin, getSession, SESSION_COOKIE, __testHooks } from "../src/lib/auth.ts";
import { createInMemoryDurableObjectNamespace, type AuthRuntimeBindings, type PendingAuth } from "../src/lib/auth-store.ts";

class TestCookieStore {
  readonly values = new Map<string, string>();

  delete(name: string): void {
    this.values.delete(name);
  }

  get(name: string): { value: string } | undefined {
    const value = this.values.get(name);
    return value ? { value } : undefined;
  }

  set(name: string, value: string): void {
    this.values.set(name, value);
  }
}

const PENDING_COOKIE = "gf_member_auth_state";
const realFetch = globalThis.fetch.bind(globalThis);
const realNow = Date.now.bind(Date);
const realDateNowDescriptor = Object.getOwnPropertyDescriptor(Date, "now");
const envBackup = {
  MEMBER_LOGIN_URL: process.env.MEMBER_LOGIN_URL,
  MEMBERS_PORTAL_URL: process.env.MEMBERS_PORTAL_URL,
  WIX_AUTH_REDIRECT_URI: process.env.WIX_AUTH_REDIRECT_URI,
  WIX_HEADLESS_CLIENT_ID: process.env.WIX_HEADLESS_CLIENT_ID,
  WIX_PASSWORD_RESET_REDIRECT_URI: process.env.WIX_PASSWORD_RESET_REDIRECT_URI,
};

let now = realNow();

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status,
  });
}

function requestWithCookies(url: string, cookieHeader = ""): Request {
  return new Request(url, {
    headers: cookieHeader ? { cookie: cookieHeader } : undefined,
  });
}

function installFetch(handler: (url: string, init?: RequestInit) => Promise<Response> | Response): void {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    return handler(url, init);
  }) as typeof fetch;
}

function setNow(value: number): void {
  now = value;
  Object.defineProperty(Date, "now", {
    configurable: true,
    value: () => now,
  });
}

beforeEach(async () => {
  await __testHooks.clearState();
  process.env.MEMBER_LOGIN_URL = "https://login.example/";
  process.env.MEMBERS_PORTAL_URL = "/members";
  process.env.WIX_AUTH_REDIRECT_URI = "https://login.example/api/auth/callback";
  process.env.WIX_HEADLESS_CLIENT_ID = "test-client";
  process.env.WIX_PASSWORD_RESET_REDIRECT_URI = "https://login.example/?reset=complete";
  installFetch(async () => new Response("", { status: 500 }));
  setNow(realNow());
});

afterEach(async () => {
  globalThis.fetch = realFetch;
  process.env.MEMBER_LOGIN_URL = envBackup.MEMBER_LOGIN_URL;
  process.env.MEMBERS_PORTAL_URL = envBackup.MEMBERS_PORTAL_URL;
  process.env.WIX_AUTH_REDIRECT_URI = envBackup.WIX_AUTH_REDIRECT_URI;
  process.env.WIX_HEADLESS_CLIENT_ID = envBackup.WIX_HEADLESS_CLIENT_ID;
  process.env.WIX_PASSWORD_RESET_REDIRECT_URI = envBackup.WIX_PASSWORD_RESET_REDIRECT_URI;
  if (realDateNowDescriptor) {
    Object.defineProperty(Date, "now", realDateNowDescriptor);
  }
  await __testHooks.clearState();
});

function installAuthFlow(memberResponse: Record<string, unknown>): void {
  installFetch(async (url, init) => {
    const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
    if (url.endsWith("/oauth2/token") && body.grantType === "anonymous") {
      return jsonResponse({ access_token: "visitor-token" });
    }
    if (url.includes("/authentication/v2/login")) {
      return jsonResponse({ sessionToken: "session-token", state: "SUCCESS" });
    }
    if (url.includes("/redirect-session")) {
      return jsonResponse({ fullUrl: "https://wix.example/redirect" });
    }
    if (url.endsWith("/oauth2/token") && body.grantType === "authorization_code") {
      return jsonResponse({ access_token: "member-access", refresh_token: "member-refresh", expires_in: 14400 });
    }
    if (url.endsWith("/members/v1/members/my")) {
      return jsonResponse({ member: memberResponse });
    }
    throw new Error(`unexpected request: ${url}`);
  });
}

test("Wix Login V2 failures emit only safe diagnostic fields", async () => {
  const warnings: unknown[][] = [];
  const realWarn = console.warn;
  console.warn = (...args: unknown[]) => warnings.push(args);
  installFetch(async (url, init) => {
    const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
    if (url.endsWith("/oauth2/token") && body.grantType === "anonymous") {
      return jsonResponse({ access_token: "visitor-token" });
    }
    return jsonResponse({
      applicationError: { code: "CAPTCHA_REQUIRED", description: "captcha for alice@example.com" },
      errorCode: "captchaRequired",
      message: "password=Password123! bearer-token visitor-token",
    }, 403);
  });

  try {
    await assert.rejects(
      () => beginLogin(requestWithCookies("https://login.example/api/auth/login"), new TestCookieStore(), "alice@example.com", "Password123!"),
      (error: unknown) => error instanceof Error && "status" in error && error.status === 502,
    );
  } finally {
    console.warn = realWarn;
  }

  assert.equal(warnings.length, 1);
  const [event, fields] = warnings[0] as [string, Record<string, unknown>];
  assert.equal(event, "wix_login_v2_failed");
  assert.equal(fields.upstreamStatus, 403);
  assert.equal(fields.errorCode, "captchaRequired");
  assert.equal(fields.code, "CAPTCHA_REQUIRED");
  const serialised = JSON.stringify(warnings);
  assert.doesNotMatch(serialised, /alice@example\.com|Password123!|visitor-token|Authorization|gf_member_session/i);
});

test("malformed Wix Login V2 failures log safe metadata only", async () => {
  const warnings: unknown[][] = [];
  const realWarn = console.warn;
  console.warn = (...args: unknown[]) => warnings.push(args);
  installFetch(async (url, init) => {
    const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
    if (url.endsWith("/oauth2/token") && body.grantType === "anonymous") {
      return jsonResponse({ access_token: "visitor-token" });
    }
    return new Response("not-json", { status: 403, headers: { "content-type": "text/plain" } });
  });

  try {
    await assert.rejects(
      () => beginLogin(requestWithCookies("https://login.example/api/auth/login"), new TestCookieStore(), "alice@example.com", "Password123!"),
      (error: unknown) => error instanceof Error && "status" in error && error.status === 502,
    );
  } finally {
    console.warn = realWarn;
  }

  assert.equal(warnings.length, 1);
  const [event, fields] = warnings[0] as [string, Record<string, unknown>];
  assert.equal(event, "wix_login_v2_failed");
  assert.equal(fields.upstreamStatus, 403);
  assert.equal(fields.responseContentType, "text/plain");
  assert.equal(fields.responseBodyLength, 8);
  assert.equal(Object.hasOwn(fields, "message"), false);
});

function createDurableBindings(sharedStorage = new Map<string, Map<string, unknown>>()): {
  bindings: AuthRuntimeBindings;
  storage: Map<string, Map<string, unknown>>;
} {
  return {
    bindings: {
      MEMBER_LOGIN_AUTH_STATE: createInMemoryDurableObjectNamespace({ sharedStorage }),
    },
    storage: sharedStorage,
  };
}

function readPendingRecord(storage: Map<string, Map<string, unknown>>, pendingKey: string): PendingAuth | undefined {
  return storage.get(`pending:${pendingKey}`)?.get("pending") as PendingAuth | undefined;
}

async function completeAuthFlow(memberResponse: Record<string, unknown>, bindings?: AuthRuntimeBindings, pendingStorage?: Map<string, Map<string, unknown>>): Promise<{ cookies: TestCookieStore; sessionId: string; portalUrl: string }> {
  const cookies = new TestCookieStore();
  installAuthFlow(memberResponse);

  const loginRequest = requestWithCookies("https://login.example/api/auth/login");
  const redirectUrl = await beginLogin(loginRequest, cookies, "member@example.com", "Password123!", bindings);
  assert.equal(redirectUrl, "https://wix.example/redirect");

  const pendingKey = cookies.get(PENDING_COOKIE)?.value;
  assert.ok(pendingKey);
  const pending = pendingStorage ? readPendingRecord(pendingStorage, pendingKey) : await __testHooks.getPendingAuth(pendingKey);
  assert.ok(pending);

  const callbackRequest = requestWithCookies(`https://login.example/api/auth/callback?code=code-123&state=${pending.state}`, `${PENDING_COOKIE}=${pendingKey}`);
  const portalUrl = await completeLogin(callbackRequest, cookies, "code-123", pending.state, bindings);
  const sessionId = cookies.get(SESSION_COOKIE)?.value;
  assert.ok(sessionId);
  return { cookies, portalUrl, sessionId };
}

async function assertMemberLoginRejected(memberResponse: Record<string, unknown>, bindings?: AuthRuntimeBindings): Promise<void> {
  const cookies = new TestCookieStore();
  installAuthFlow(memberResponse);

  const loginRequest = requestWithCookies("https://login.example/api/auth/login");
  await beginLogin(loginRequest, cookies, "member@example.com", "Password123!", bindings);
  const pendingKey = cookies.get(PENDING_COOKIE)?.value;
  assert.ok(pendingKey);
  const pending = await __testHooks.getPendingAuth(pendingKey);
  assert.ok(pending);
  const callbackRequest = requestWithCookies(`https://login.example/api/auth/callback?code=code-456&state=${pending.state}`, `${PENDING_COOKIE}=${pendingKey}`);
  await assert.rejects(
    () => completeLogin(callbackRequest, cookies, "code-456", pending.state, bindings),
    (error: unknown) => error instanceof Error && error.message === "member_unavailable",
  );
}

test("member.id is canonical and approved status allows login while activityStatus is ignored", async () => {
  const { portalUrl, sessionId } = await completeAuthFlow({
    activityStatus: "MUTED",
    id: "member-123",
    profile: {
      firstName: "Ada",
      lastName: "Lovelace",
    },
    status: "APPROVED",
  });

  assert.equal(portalUrl, "/members");
  assert.deepEqual((await __testHooks.getSession(sessionId))?.member, {
    firstName: "Ada",
    lastName: "Lovelace",
    memberId: "member-123",
  });
});

test("member.memberId without member.id fails closed", async () => {
  await assertMemberLoginRejected({
    activityStatus: "ACTIVE",
    memberId: "member-123",
    profile: {
      firstName: "Ada",
      lastName: "Lovelace",
    },
    status: "APPROVED",
  });
});

test("non-approved statuses fail closed regardless of activityStatus", async () => {
  await assertMemberLoginRejected({
    activityStatus: "ACTIVE",
    id: "member-123",
    profile: {
      firstName: "Ada",
      lastName: "Lovelace",
    },
    status: "BLOCKED",
  });

  await assertMemberLoginRejected({
    activityStatus: "ACTIVE",
    id: "member-123",
    profile: {
      firstName: "Ada",
      lastName: "Lovelace",
    },
    status: "PENDING",
  });

  await assertMemberLoginRejected({
    activityStatus: "ACTIVE",
    id: "member-123",
    profile: {
      firstName: "Ada",
      lastName: "Lovelace",
    },
  });

  await assertMemberLoginRejected({
    activityStatus: "ACTIVE",
    id: "member-123",
    profile: {
      firstName: "Ada",
      lastName: "Lovelace",
    },
    status: "SOMETHING_ELSE",
  });
});

test("Durable Object-backed pending auth is single-use and survives restart", async () => {
  const durable = createDurableBindings();
  const cookies = new TestCookieStore();
  installAuthFlow({
    id: "member-123",
    profile: {
      firstName: "Ada",
      lastName: "Lovelace",
    },
    status: "APPROVED",
  });

  const loginRequest = requestWithCookies("https://login.example/api/auth/login");
  await beginLogin(loginRequest, cookies, "member@example.com", "Password123!", durable.bindings);
  const pendingKey = cookies.get(PENDING_COOKIE)?.value;
  assert.ok(pendingKey);
  const pending = readPendingRecord(durable.storage, pendingKey);
  assert.ok(pending);

  const callbackRequest = requestWithCookies(`https://login.example/api/auth/callback?code=code-123&state=${pending.state}`, `${PENDING_COOKIE}=${pendingKey}`);
  const first = completeLogin(callbackRequest, cookies, "code-123", pending.state, durable.bindings);
  const second = completeLogin(callbackRequest, cookies, "code-123", pending.state, durable.bindings);

  await assert.rejects(second, (error: unknown) => error instanceof Error && error.message === "invalid_callback");
  assert.equal(await first, "/members");

  const restarted = createDurableBindings(durable.storage);
  const sessionId = cookies.get(SESSION_COOKIE)?.value;
  assert.ok(sessionId);
  const sessionRequest = requestWithCookies("https://login.example/api/auth/session", `${SESSION_COOKIE}=${sessionId}`);
  assert.equal((await getSession(sessionRequest, restarted.bindings))?.accessToken, "member-access");
});

test("Durable Object-backed malformed callback state fails closed", async () => {
  const durable = createDurableBindings();
  const cookies = new TestCookieStore();
  installAuthFlow({
    id: "member-123",
    profile: {
      firstName: "Ada",
      lastName: "Lovelace",
    },
    status: "APPROVED",
  });

  const loginRequest = requestWithCookies("https://login.example/api/auth/login");
  await beginLogin(loginRequest, cookies, "member@example.com", "Password123!", durable.bindings);
  const pendingKey = cookies.get(PENDING_COOKIE)?.value;
  assert.ok(pendingKey);
  const pending = readPendingRecord(durable.storage, pendingKey);
  assert.ok(pending);

  const callbackRequest = requestWithCookies(`https://login.example/api/auth/callback?code=code-123&state=wrong-state`, `${PENDING_COOKIE}=${pendingKey}`);
  await assert.rejects(
    () => completeLogin(callbackRequest, cookies, "code-123", "wrong-state", durable.bindings),
    (error: unknown) => error instanceof Error && error.message === "invalid_callback",
  );
  assert.ok(readPendingRecord(durable.storage, pendingKey));
});

test("Durable Object-backed sessions preserve refresh, logout, and absolute expiry semantics", async () => {
  const durable = createDurableBindings();
  installAuthFlow({
    id: "member-123",
    profile: {
      firstName: "Ada",
      lastName: "Lovelace",
    },
    status: "APPROVED",
  });

  const { sessionId } = await completeAuthFlow({
    id: "member-123",
    profile: {
      firstName: "Ada",
      lastName: "Lovelace",
    },
    status: "APPROVED",
  }, durable.bindings, durable.storage);

  const sessionRequest = requestWithCookies("https://login.example/api/auth/session", `${SESSION_COOKIE}=${sessionId}`);
  const sessionStore = durable.storage.get(`session:${sessionId}`);
  assert.ok(sessionStore);
  const currentSession = sessionStore.get("session") as { expiresAt: number } & Record<string, unknown>;
  sessionStore.set("session", { ...currentSession, expiresAt: now - 1 });

  installFetch(async (url, init) => {
    const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
    if (url.endsWith("/oauth2/token") && body.grantType === "refresh_token") {
      return jsonResponse({ access_token: "refreshed-access", refresh_token: "refreshed-refresh", expires_in: 14400 });
    }
    throw new Error(`unexpected request: ${url}`);
  });
  const refreshed = await getSession(sessionRequest, durable.bindings);
  assert.equal(refreshed?.accessToken, "refreshed-access");

  await clearSession(sessionRequest, new TestCookieStore(), durable.bindings);
  await clearSession(sessionRequest, new TestCookieStore(), durable.bindings);
  assert.equal(await getSession(sessionRequest, durable.bindings), undefined);

  const staleRequest = requestWithCookies("https://login.example/api/auth/session", `${SESSION_COOKIE}=${sessionId}`);
  assert.equal(await getSession(staleRequest, createDurableBindings(durable.storage).bindings), undefined);
});

test("callback replay is single-use even when two callbacks race", async () => {
  const cookies = new TestCookieStore();
  installFetch(async (url, init) => {
    const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
    if (url.endsWith("/oauth2/token") && body.grantType === "anonymous") {
      return jsonResponse({ access_token: "visitor-token" });
    }
    if (url.includes("/authentication/v2/login")) {
      return jsonResponse({ sessionToken: "session-token", state: "SUCCESS" });
    }
    if (url.includes("/redirect-session")) {
      return jsonResponse({ fullUrl: "https://wix.example/redirect" });
    }
    if (url.endsWith("/oauth2/token") && body.grantType === "authorization_code") {
      return new Promise<Response>((resolve) => {
        setTimeout(() => {
          resolve(jsonResponse({ access_token: "member-access", refresh_token: "member-refresh", expires_in: 14400 }));
        }, 10);
      });
    }
    if (url.endsWith("/members/v1/members/my")) {
      return jsonResponse({
        member: {
          id: "member-123",
          profile: {
            firstName: "Ada",
            lastName: "Lovelace",
          },
          status: "APPROVED",
        },
      });
    }
    throw new Error(`unexpected request: ${url}`);
  });

  const loginRequest = requestWithCookies("https://login.example/api/auth/login");
  await beginLogin(loginRequest, cookies, "member@example.com", "Password123!");
  const pendingKey = cookies.get(PENDING_COOKIE)?.value;
  assert.ok(pendingKey);
  const pending = await __testHooks.getPendingAuth(pendingKey);
  assert.ok(pending);

  const callbackRequest = requestWithCookies(`https://login.example/api/auth/callback?code=code-123&state=${pending.state}`, `${PENDING_COOKIE}=${pendingKey}`);
  const first = completeLogin(callbackRequest, cookies, "code-123", pending.state);
  const second = completeLogin(callbackRequest, cookies, "code-123", pending.state);

  await assert.rejects(second, (error: unknown) => error instanceof Error && error.message === "invalid_callback");
  const destination = await first;
  assert.equal(destination, "/members");
  assert.equal(await __testHooks.getPendingAuth(pendingKey), undefined);
});

test("absolute server expiry rejects stale cookies and never extends the session", async () => {
  const sessionId = "session-absolute";
  const futureExpiry = now + 5_000;
  await __testHooks.setSession(sessionId, {
    accessToken: "expired-access",
    absoluteExpiresAt: futureExpiry,
    expiresAt: now - 1,
    member: {
      firstName: "Ada",
      lastName: "Lovelace",
      memberId: "member-123",
    },
    refreshToken: "refresh-token",
    version: 1,
  });

  installFetch(async (url, init) => {
    const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
    if (url.endsWith("/oauth2/token") && body.grantType === "refresh_token") {
      return jsonResponse({ access_token: "refreshed-access", refresh_token: "refreshed-refresh", expires_in: 14400 });
    }
    throw new Error(`unexpected request: ${url}`);
  });

  const request = requestWithCookies("https://login.example/api/auth/session", `${SESSION_COOKIE}=${sessionId}`);
  const refreshed = await getSession(request);
  assert.ok(refreshed);
  assert.equal(refreshed?.accessToken, "refreshed-access");
  assert.equal((await __testHooks.getSession(sessionId))?.accessToken, "refreshed-access");

  setNow(futureExpiry + 1);
  const expired = await getSession(request);
  assert.equal(expired, undefined);
  assert.equal(await __testHooks.getSession(sessionId), undefined);
});

test("logout and expiry prevent stale Alice context before Bob replaces the session", async () => {
  const aliceId = "session-alice";
  const bobId = "session-bob";
  const session = (firstName: string, memberId: string, absoluteExpiresAt = now + 10_000) => ({
    accessToken: `${memberId}-access`,
    absoluteExpiresAt,
    expiresAt: now + 10_000,
    member: { firstName, lastName: "Member", memberId },
    refreshToken: `${memberId}-refresh`,
    version: 1,
  });

  await __testHooks.setSession(aliceId, session("Alice", "A"));
  const aliceRequest = requestWithCookies("https://login.example/api/auth/session", `${SESSION_COOKIE}=${aliceId}`);
  assert.equal((await getSession(aliceRequest))?.member.firstName, "Alice");
  await clearSession(aliceRequest, new TestCookieStore());
  await __testHooks.setSession(bobId, session("Bob", "B"));
  const bobRequest = requestWithCookies("https://login.example/api/auth/session", `${SESSION_COOKIE}=${bobId}`);
  const bob = await getSession(bobRequest);
  assert.equal(bob?.member.firstName, "Bob");
  assert.equal(JSON.stringify(bob).includes("Alice"), false);

  const expiringAliceId = "session-alice-expiring";
  await __testHooks.setSession(expiringAliceId, session("Alice", "A", now + 1));
  const expiringRequest = requestWithCookies("https://login.example/api/auth/session", `${SESSION_COOKIE}=${expiringAliceId}`);
  setNow(now + 2);
  assert.equal(await getSession(expiringRequest), undefined);
  await __testHooks.setSession(bobId, session("Bob", "B"));
  const afterExpiry = await getSession(bobRequest);
  assert.equal(afterExpiry?.member.firstName, "Bob");
  assert.equal(JSON.stringify(afterExpiry).includes("Alice"), false);
});

test("storage snapshot and restore preserve authoritative session state across reloads", async () => {
  const sessionId = "session-snapshot";
  await __testHooks.setSession(sessionId, {
    accessToken: "snapshot-access",
    absoluteExpiresAt: now + 10_000,
    expiresAt: now + 10_000,
    member: {
      firstName: "Ada",
      lastName: "Lovelace",
      memberId: "member-123",
    },
    refreshToken: "snapshot-refresh",
    version: 1,
  });
  await __testHooks.setPendingAuth("pending-snapshot", {
    codeVerifier: "verifier",
    email: "member@example.com",
    expiresAt: now + 10_000,
    state: "state",
  });

  const snapshot = await __testHooks.exportSnapshot();
  const freshStore = __testHooks.createStore();
  await freshStore.restore(snapshot);
  __testHooks.setStore(freshStore);

  assert.equal((await __testHooks.getSession(sessionId))?.accessToken, "snapshot-access");
  assert.equal((await __testHooks.getPendingAuth("pending-snapshot"))?.email, "member@example.com");
});

test("duplicate logout remains revoked", async () => {
  const sessionId = "session-logout";
  await __testHooks.setSession(sessionId, {
    accessToken: "logout-access",
    absoluteExpiresAt: now + 10_000,
    expiresAt: now + 10_000,
    member: {
      firstName: "Ada",
      lastName: "Lovelace",
      memberId: "member-123",
    },
    refreshToken: "logout-refresh",
    version: 1,
  });

  const request = requestWithCookies("https://login.example/api/auth/logout", `${SESSION_COOKIE}=${sessionId}`);
  await clearSession(request, new TestCookieStore());
  await clearSession(request, new TestCookieStore());

  assert.equal(await __testHooks.getSession(sessionId), undefined);
  assert.equal(await __testHooks.getSessionVersion(sessionId), 3);
});

test("logout wins against an in-flight refresh and stale refreshes cannot resurrect the session", async () => {
  const sessionId = "session-race";
  const futureExpiry = now + 10_000;
  await __testHooks.setSession(sessionId, {
    accessToken: "expired-access",
    absoluteExpiresAt: futureExpiry,
    expiresAt: now - 1,
    member: {
      firstName: "Ada",
      lastName: "Lovelace",
      memberId: "member-123",
    },
    refreshToken: "refresh-token",
    version: 1,
  });

  let resolveRefresh!: (response: Response) => void;
  const refreshPromise = new Promise<Response>((resolve) => {
    resolveRefresh = resolve;
  });

  installFetch(async (url, init) => {
    const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
    if (url.endsWith("/oauth2/token") && body.grantType === "refresh_token") {
      return refreshPromise;
    }
    throw new Error(`unexpected request: ${url}`);
  });

  const request = requestWithCookies("https://login.example/api/auth/session", `${SESSION_COOKIE}=${sessionId}`);
  const refreshInFlight = getSession(request);
  await clearSession(request, new TestCookieStore());
  resolveRefresh(jsonResponse({ access_token: "resurrected-access", refresh_token: "resurrected-refresh", expires_in: 14400 }));
  const result = await refreshInFlight;
  assert.equal(result, undefined);
  assert.equal(await __testHooks.getSession(sessionId), undefined);

  const concurrentSessionId = "session-concurrent";
  await __testHooks.setSession(concurrentSessionId, {
    accessToken: "expired-access",
    absoluteExpiresAt: now + 10_000,
    expiresAt: now - 1,
    member: {
      firstName: "Ada",
      lastName: "Lovelace",
      memberId: "member-123",
    },
    refreshToken: "refresh-token",
    version: 1,
  });

  let resolveFirst!: (response: Response) => void;
  let resolveSecond!: (response: Response) => void;
  const firstRefresh = new Promise<Response>((resolve) => {
    resolveFirst = resolve;
  });
  const secondRefresh = new Promise<Response>((resolve) => {
    resolveSecond = resolve;
  });
  let refreshCount = 0;
  installFetch(async (url, init) => {
    const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
    if (url.endsWith("/oauth2/token") && body.grantType === "refresh_token") {
      refreshCount += 1;
      return refreshCount === 1 ? firstRefresh : secondRefresh;
    }
    throw new Error(`unexpected request: ${url}`);
  });

  const concurrentRequest = requestWithCookies("https://login.example/api/auth/session", `${SESSION_COOKIE}=${concurrentSessionId}`);
  const firstLookup = getSession(concurrentRequest);
  const secondLookup = getSession(concurrentRequest);
  resolveFirst(jsonResponse({ access_token: "first-refresh", refresh_token: "first-refresh-token", expires_in: 14400 }));
  const firstResult = await firstLookup;
  resolveSecond(jsonResponse({ access_token: "second-refresh", refresh_token: "second-refresh-token", expires_in: 14400 }));
  const secondResult = await secondLookup;

  assert.equal(firstResult?.accessToken, "first-refresh");
  assert.equal(secondResult, undefined);
  assert.equal((await __testHooks.getSession(concurrentSessionId))?.accessToken, "first-refresh");
});
