import { createHash, randomBytes } from "node:crypto";
import { createAuthStore, createMemoryAuthStore, setFallbackAuthStore, type AuthRuntimeBindings, type AuthStore, type PendingAuth, type SessionRecord } from "./auth-store.ts";

const SESSION_COOKIE = "gf_member_session";
const PENDING_COOKIE = "gf_member_auth_state";
const SESSION_TTL_SECONDS = 8 * 60 * 60;
const SESSION_TTL_MS = SESSION_TTL_SECONDS * 1000;
const PENDING_TTL_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 12_000;
const TURNSTILE_SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const TURNSTILE_MAX_TOKEN_LENGTH = 2048;
const TURNSTILE_ACTION = "member_login";
const TURNSTILE_HOSTNAME = "portal.gymfusion.com.au";

type CookieOptions = {
  httpOnly?: boolean;
  maxAge?: number;
  path?: string;
  sameSite?: "lax" | "strict" | "none";
  secure?: boolean;
};

export type CookieStore = {
  delete(name: string, options?: CookieOptions): void;
  get(name: string): { value: string } | undefined;
  set(name: string, value: string, options?: CookieOptions): void;
};

type WixConfig = {
  apiBaseUrl: string;
  authRedirectUri: string;
  clientId: string;
  loginPageUrl: string;
  passwordResetRedirectUri: string;
  portalUrl: string;
};

type RuntimeValueKey = "MEMBER_LOGIN_URL" | "MEMBERS_PORTAL_URL" | "WIX_API_BASE_URL" | "WIX_AUTH_REDIRECT_URI" | "WIX_HEADLESS_CLIENT_ID" | "WIX_PASSWORD_RESET_REDIRECT_URI";

type TurnstileRuntimeBindings = AuthRuntimeBindings & { TURNSTILE_SECRET_KEY?: string };

export class AuthProblem extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status = 502) {
    super(code);
    this.name = "AuthProblem";
    this.code = code;
    this.status = status;
  }
}

type WixMemberProfile = {
  firstName?: string;
  lastName?: string;
  nickname?: string;
};

type WixMemberRecord = {
  activityStatus?: string;
  id?: string;
  profile?: WixMemberProfile;
  status?: string;
};

function resolveTrustedMember(member: WixMemberRecord | undefined): { firstName: string; lastName: string; memberId: string } | undefined {
  const memberId = String(member?.id ?? "");
  if (!memberId) return undefined;

  const profile = member?.profile ?? {};
  const firstName = String(profile.firstName ?? profile.nickname ?? "");
  const lastName = String(profile.lastName ?? "");
  return { firstName, lastName, memberId };
}

function runtimeValue(bindings: AuthRuntimeBindings | undefined, name: RuntimeValueKey): string {
  return String(bindings?.[name] ?? process.env[name] ?? "").trim();
}

function originFromRequest(request: Request): string {
  return new URL(request.url).origin;
}

function getAuthStore(bindings?: AuthRuntimeBindings): AuthStore {
  return createAuthStore(bindings);
}

function getConfig(request: Request, bindings?: AuthRuntimeBindings): WixConfig {
  const origin = originFromRequest(request);
  const clientId = runtimeValue(bindings, "WIX_HEADLESS_CLIENT_ID");
  if (!clientId) {
    throw new AuthProblem("configuration", 503);
  }

  const authRedirectUri = runtimeValue(bindings, "WIX_AUTH_REDIRECT_URI") || `${origin}/api/auth/callback`;
  const passwordResetRedirectUri = runtimeValue(bindings, "WIX_PASSWORD_RESET_REDIRECT_URI") || `${origin}/?reset=complete`;

  return {
    apiBaseUrl: (runtimeValue(bindings, "WIX_API_BASE_URL") || "https://www.wixapis.com").replace(/\/$/, ""),
    authRedirectUri,
    clientId,
    loginPageUrl: runtimeValue(bindings, "MEMBER_LOGIN_URL") || `${origin}/`,
    passwordResetRedirectUri,
    portalUrl: runtimeValue(bindings, "MEMBERS_PORTAL_URL") || "/members",
  };
}

function isSecureRequest(request: Request): boolean {
  return new URL(request.url).protocol === "https:";
}

function cookieOptions(request: Request, maxAge: number): CookieOptions {
  return {
    httpOnly: true,
    maxAge,
    path: "/",
    sameSite: "lax",
    secure: isSecureRequest(request),
  };
}

function randomToken(bytes = 32): string {
  return Buffer.from(randomBytes(bytes)).toString("base64url");
}

function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

async function wixRequest<T>(url: string, init: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const text = await response.text();
    let payload: unknown = {};
    let responseJson = true;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        responseJson = false;
      }
    }
    if (!response.ok) {
      if (url.endsWith("/_api/iam/authentication/v2/login")) {
        logWixLoginV2Failure(response, text, responseJson ? payload : undefined);
      }
      if (response.status === 429) throw new AuthProblem("rate_limited", 429);
      throw new AuthProblem("wix_request_failed", 502);
    }
    if (!responseJson) throw new AuthProblem("malformed_response");
    return payload as T;
  } catch (error) {
    if (error instanceof AuthProblem) throw error;
    throw new AuthProblem(error instanceof DOMException && error.name === "AbortError" ? "timeout" : "network");
  } finally {
    clearTimeout(timer);
  }
}

export async function verifyTurnstileToken(token: unknown, bindings?: TurnstileRuntimeBindings): Promise<boolean> {
  if (typeof token !== "string" || token.length === 0 || token.length > TURNSTILE_MAX_TOKEN_LENGTH) return false;
  const secret = String(bindings?.TURNSTILE_SECRET_KEY ?? process.env.TURNSTILE_SECRET_KEY ?? "").trim();
  if (!secret) return false;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(TURNSTILE_SITEVERIFY_URL, {
      body: JSON.stringify({ secret, response: token }),
      headers: { "content-type": "application/json" },
      method: "POST",
      signal: controller.signal,
    });
    if (!response.ok) return false;
    const payload = await response.json() as { action?: unknown; hostname?: unknown; success?: unknown };
    return payload.success === true && payload.action === TURNSTILE_ACTION && payload.hostname === TURNSTILE_HOSTNAME;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

const WIX_DIAGNOSTIC_KEYS = new Set([
  "code",
  "description",
  "error",
  "errorCode",
  "error_description",
  "message",
]);

function sanitizeDiagnosticValue(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const sanitized = value
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[redacted-email]")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted-token]")
    .replace(/\b(?:access|refresh|visitor|session|bearer)[-_ ]?token\b/gi, "[redacted-token]")
    .replace(/\b(?:password|passcode|secret)\b(?:\s*[:=]\s*\S+)?/gi, "[redacted-secret]")
    .slice(0, 256);
  return sanitized || undefined;
}

function collectWixDiagnosticFields(value: unknown, fields: Record<string, string>, depth = 0): void {
  if (!value || typeof value !== "object" || depth > 3) return;
  for (const [key, nested] of Object.entries(value)) {
    if (WIX_DIAGNOSTIC_KEYS.has(key)) {
      const sanitized = sanitizeDiagnosticValue(nested);
      if (sanitized && !fields[key]) fields[key] = sanitized;
    }
    if (nested && typeof nested === "object") collectWixDiagnosticFields(nested, fields, depth + 1);
  }
}

function logWixLoginV2Failure(response: Response, body: string, payload: unknown): void {
  const fields: Record<string, string> = {};
  collectWixDiagnosticFields(payload, fields);
  console.warn("wix_login_v2_failed", {
    responseBodyLength: body.length,
    responseContentType: response.headers.get("content-type") || undefined,
    upstreamStatus: response.status,
    ...fields,
  });
}

async function getVisitorAccessToken(config: WixConfig): Promise<string> {
  const payload = await wixRequest<{ access_token?: string }>(`${config.apiBaseUrl}/oauth2/token`, {
    body: JSON.stringify({ clientId: config.clientId, grantType: "anonymous" }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  if (!payload.access_token) throw new AuthProblem("malformed_response");
  return payload.access_token;
}

function mapLoginFailure(payload: { errorCode?: string; state?: string }): never {
  if (payload.state === "REQUIRE_EMAIL_VERIFICATION") throw new AuthProblem("email_verification", 400);
  if (payload.state === "REQUIRE_OWNER_APPROVAL") throw new AuthProblem("owner_approval", 400);
  if (payload.errorCode === "resetPassword") throw new AuthProblem("reset_required", 400);
  throw new AuthProblem("invalid_credentials", 401);
}

export async function beginLogin(request: Request, cookies: CookieStore, email: string, password: string, bindings?: AuthRuntimeBindings): Promise<string> {
  const authStore = getAuthStore(bindings);
  const config = getConfig(request, bindings);
  const visitorToken = await getVisitorAccessToken(config);
  const payload = await wixRequest<{ errorCode?: string; sessionToken?: string; state?: string }>(`${config.apiBaseUrl}/_api/iam/authentication/v2/login`, {
    body: JSON.stringify({ loginId: { email }, password }),
    headers: {
      authorization: `Bearer ${visitorToken}`,
      "content-type": "application/json",
    },
    method: "POST",
  });
  if (payload.state !== "SUCCESS" || !payload.sessionToken) mapLoginFailure(payload);

  const codeVerifier = randomToken(48);
  const state = randomToken(32);
  const pendingKey = randomToken(32);
  await authStore.setPendingAuth(pendingKey, { codeVerifier, email, expiresAt: Date.now() + PENDING_TTL_MS, state });
  cookies.set(PENDING_COOKIE, pendingKey, cookieOptions(request, 5 * 60));

  const redirectPayload = await wixRequest<{ fullUrl?: string; redirectSession?: { fullUrl?: string } }>(`${config.apiBaseUrl}/_api/redirects-api/v1/redirect-session`, {
    body: JSON.stringify({
      auth: {
        authRequest: {
          clientId: config.clientId,
          codeChallenge: pkceChallenge(codeVerifier),
          codeChallengeMethod: "S256",
          redirectUri: config.authRedirectUri,
          responseMode: "query",
          responseType: "code",
          scope: "offline_access",
          sessionToken: payload.sessionToken,
          state,
        },
      },
    }),
    headers: {
      authorization: `Bearer ${visitorToken}`,
      "content-type": "application/json",
    },
    method: "POST",
  });
  const redirectUrl = redirectPayload.fullUrl || redirectPayload.redirectSession?.fullUrl;
  if (!redirectUrl) throw new AuthProblem("malformed_response");
  return redirectUrl;
}

export async function completeLogin(request: Request, cookies: CookieStore, code: string, state: string, bindings?: AuthRuntimeBindings): Promise<string> {
  const authStore = getAuthStore(bindings);
  const config = getConfig(request, bindings);
  const pendingKey = cookies.get(PENDING_COOKIE)?.value;
  const pending = pendingKey ? await authStore.consumePendingAuth(pendingKey, state, Date.now()) : undefined;
  if (!pending) {
    throw new AuthProblem("invalid_callback", 400);
  }
  cookies.delete(PENDING_COOKIE, cookieOptions(request, 0));

  const tokenPayload = await wixRequest<{ access_token?: string; expires_in?: number; refresh_token?: string }>(`${config.apiBaseUrl}/oauth2/token`, {
    body: JSON.stringify({
      clientId: config.clientId,
      code,
      codeVerifier: pending.codeVerifier,
      grantType: "authorization_code",
      redirectUri: config.authRedirectUri,
    }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  if (!tokenPayload.access_token || !tokenPayload.refresh_token) throw new AuthProblem("malformed_response");

  const memberPayload = await wixRequest<{ member?: WixMemberRecord }>(`${config.apiBaseUrl}/members/v1/members/my`, {
    headers: { authorization: `Bearer ${tokenPayload.access_token}` },
    method: "GET",
  });
  const member = memberPayload.member;
  const trustedMember = resolveTrustedMember(member);
  const memberStatus = String(member?.status ?? "").trim().toUpperCase();
  if (!trustedMember || memberStatus !== "APPROVED") throw new AuthProblem("member_unavailable", 403);

  const sessionId = randomToken(32);
  const version = 1;
  await authStore.createSession(sessionId, {
    accessToken: tokenPayload.access_token,
    absoluteExpiresAt: Date.now() + SESSION_TTL_MS,
    expiresAt: Date.now() + Math.max(60, Number(tokenPayload.expires_in ?? 14_400) - 30) * 1000,
    member: {
      firstName: trustedMember.firstName,
      lastName: trustedMember.lastName,
      memberId: trustedMember.memberId,
    },
    refreshToken: tokenPayload.refresh_token,
    version,
  });
  cookies.set(SESSION_COOKIE, sessionId, cookieOptions(request, SESSION_TTL_SECONDS));
  return config.portalUrl;
}

export async function sendRecoveryEmail(request: Request, email: string, bindings?: AuthRuntimeBindings): Promise<void> {
  const config = getConfig(request, bindings);
  const visitorToken = await getVisitorAccessToken(config);
  await wixRequest(`${config.apiBaseUrl}/_api/iam/recovery/v1/send-email`, {
    body: JSON.stringify({
      email,
      redirect: { clientId: config.clientId, url: config.passwordResetRedirectUri },
    }),
    headers: {
      authorization: `Bearer ${visitorToken}`,
      "content-type": "application/json",
    },
    method: "POST",
  });
}

async function refreshSession(sessionId: string, session: SessionRecord, config: WixConfig, bindings?: AuthRuntimeBindings): Promise<SessionRecord | undefined> {
  const authStore = getAuthStore(bindings);
  if (session.absoluteExpiresAt <= Date.now()) {
    await authStore.revokeSession(sessionId);
    return undefined;
  }
  if (session.expiresAt > Date.now()) return session;
  const currentVersion = await authStore.getSessionVersion(sessionId);
  const currentSession = currentVersion === session.version ? await authStore.getSession(sessionId) : undefined;
  if (!currentSession || currentSession.version !== session.version) return undefined;
  try {
    const payload = await wixRequest<{ access_token?: string; expires_in?: number; refresh_token?: string }>(`${config.apiBaseUrl}/oauth2/token`, {
      body: JSON.stringify({ clientId: config.clientId, grantType: "refresh_token", refreshToken: session.refreshToken }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    if (!payload.access_token || !payload.refresh_token) throw new AuthProblem("malformed_response");
    const authoritativeVersion = await authStore.getSessionVersion(sessionId);
    const authoritativeSession = authoritativeVersion === session.version ? await authStore.getSession(sessionId) : undefined;
    if (!authoritativeSession || authoritativeSession.version !== session.version) return undefined;
    if (session.absoluteExpiresAt <= Date.now()) {
      await authStore.revokeSession(sessionId);
      return undefined;
    }
    const refreshed = {
      ...session,
      accessToken: payload.access_token,
      expiresAt: Date.now() + Math.max(60, Number(payload.expires_in ?? 14_400) - 30) * 1000,
      refreshToken: payload.refresh_token,
      version: session.version + 1,
    };
    const committed = await authStore.updateSessionIfCurrent(sessionId, session.version, refreshed);
    return committed ? refreshed : undefined;
  } catch {
    const activeVersion = await authStore.getSessionVersion(sessionId);
    const activeSession = activeVersion === session.version ? await authStore.getSession(sessionId) : undefined;
    if (activeSession && activeSession.version === session.version) await authStore.revokeSession(sessionId);
    return undefined;
  }
}

export async function getSession(request: Request, bindings?: AuthRuntimeBindings): Promise<SessionRecord | undefined> {
  const authStore = getAuthStore(bindings);
  const sessionId = request.headers.get("cookie")?.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`))?.[1];
  if (!sessionId) return undefined;
  const session = await authStore.getSession(sessionId);
  if (!session) return undefined;
  if (session.absoluteExpiresAt <= Date.now()) {
    await authStore.revokeSession(sessionId);
    return undefined;
  }
  return refreshSession(sessionId, session, getConfig(request, bindings), bindings);
}

export async function getMemberContext(session: SessionRecord): Promise<{ displayName: string } | undefined> {
  try {
    const payload = await wixRequest<{ ok?: boolean; member?: { displayName?: string } }>("https://www.wixapis.com/velo/v1/http/invoke/member_portal_context", {
      headers: { authorization: `Bearer ${session.accessToken}` },
      method: "GET",
    });
    const displayName = String(payload.member?.displayName ?? "").trim();
    return payload.ok === true && displayName ? { displayName } : undefined;
  } catch {
    return undefined;
  }
}

export async function getMemberPortalRead(session: SessionRecord, view: string): Promise<unknown | undefined> {
  try {
    return await wixRequest<unknown>("https://www.wixapis.com/velo/v1/http/invoke/member_portal_read", {
      body: JSON.stringify({ view }),
      headers: { authorization: `Bearer ${session.accessToken}`, "content-type": "application/json" },
      method: "POST",
    });
  } catch {
    return undefined;
  }
}

export async function submitRfmPart2(session: SessionRecord, payload: unknown): Promise<{ submissionID?: string; duplicate?: boolean } | undefined> {
  try {
    return await wixRequest<{ submissionID?: string; duplicate?: boolean }>("https://www.wixapis.com/velo/v1/http/invoke/rfm_part2_health_safety_submit", {
      body: JSON.stringify(payload),
      headers: { authorization: `Bearer ${session.accessToken}`, "content-type": "application/json" },
      method: "POST",
    });
  } catch {
    return undefined;
  }
}

export async function submitRfmPart3(session: SessionRecord, payload: unknown): Promise<{ submissionID?: string; duplicate?: boolean } | undefined> {
  try {
    return await wixRequest<{ submissionID?: string; duplicate?: boolean }>("https://www.wixapis.com/velo/v1/http/invoke/rfm_part3_accessibility_submit", {
      body: JSON.stringify(payload), headers: { authorization: `Bearer ${session.accessToken}`, "content-type": "application/json" }, method: "POST",
    });
  } catch { return undefined; }
}

export async function submitRfmPart4(session: SessionRecord, payload: unknown): Promise<{ submissionID?: string; duplicate?: boolean } | undefined> {
  try {
    return await wixRequest<{ submissionID?: string; duplicate?: boolean }>("https://www.wixapis.com/velo/v1/http/invoke/rfm_part4_fitness_goals_submit", {
      body: JSON.stringify(payload), headers: { authorization: `Bearer ${session.accessToken}`, "content-type": "application/json" }, method: "POST",
    });
  } catch { return undefined; }
}

export function getPortalUrl(request: Request, bindings?: AuthRuntimeBindings): string {
  return getConfig(request, bindings).portalUrl;
}

export async function clearSession(request: Request, cookies: CookieStore, bindings?: AuthRuntimeBindings): Promise<void> {
  const authStore = getAuthStore(bindings);
  const sessionId = request.headers.get("cookie")?.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`))?.[1];
  if (sessionId) await authStore.revokeSession(sessionId);
  cookies.delete(SESSION_COOKIE, cookieOptions(request, 0));
}

export async function createLogoutUrl(request: Request, session: SessionRecord, bindings?: AuthRuntimeBindings): Promise<string | undefined> {
  const config = getConfig(request, bindings);
  try {
    const payload = await wixRequest<{ fullUrl?: string; redirectSession?: { fullUrl?: string } }>(`${config.apiBaseUrl}/_api/redirects-api/v1/redirect-session`, {
      body: JSON.stringify({ callbacks: { postFlowUrl: config.loginPageUrl }, logout: { clientId: config.clientId } }),
      headers: { authorization: `Bearer ${session.accessToken}`, "content-type": "application/json" },
      method: "POST",
    });
    return payload.fullUrl || payload.redirectSession?.fullUrl;
  } catch {
    return undefined;
  }
}

export function errorMessage(error: unknown): { message: string; status: number } {
  if (!(error instanceof AuthProblem)) return { message: "We could not complete that request. Please try again.", status: 502 };
  const messages: Record<string, string> = {
    configuration: "Member login is temporarily unavailable.",
    email_verification: "Please verify your email address before logging in.",
    invalid_callback: "That login session has expired. Please try again.",
    invalid_credentials: "The email or password is incorrect.",
    member_unavailable: "This member account is not currently available.",
    malformed_response: "We could not complete that request. Please try again.",
    network: "We could not reach the member service. Please try again.",
    owner_approval: "Your membership is awaiting approval.",
    rate_limited: "Too many attempts. Please wait and try again.",
    reset_required: "Please reset your password before logging in.",
    timeout: "The member service took too long to respond. Please try again.",
    wix_request_failed: "We could not complete that request. Please try again.",
  };
  return { message: messages[error.code] || "We could not complete that request. Please try again.", status: error.status };
}

export { SESSION_COOKIE };

export const __testHooks = {
  async clearState(): Promise<void> {
    await createAuthStore().clear();
  },
  createStore() {
    return createAuthStore();
  },
  async exportSnapshot() {
    return createAuthStore().snapshot();
  },
  async getPendingAuth(pendingKey: string): Promise<PendingAuth | undefined> {
    return createAuthStore().getPendingAuth(pendingKey);
  },
  async getSession(sessionId: string): Promise<SessionRecord | undefined> {
    return createAuthStore().getSession(sessionId);
  },
  async getSessionVersion(sessionId: string): Promise<number | undefined> {
    return createAuthStore().getSessionVersion(sessionId);
  },
  setStore(store: AuthStore): void {
    setFallbackAuthStore(store);
  },
  async setPendingAuth(pendingKey: string, value: PendingAuth): Promise<void> {
    await createAuthStore().setPendingAuth(pendingKey, value);
  },
  async setSession(sessionId: string, value: SessionRecord): Promise<void> {
    await createAuthStore().createSession(sessionId, value);
  },
  async restoreSnapshot(snapshot: Awaited<ReturnType<AuthStore["snapshot"]>>): Promise<void> {
    const store = createMemoryAuthStore();
    await store.restore(snapshot);
    setFallbackAuthStore(store);
  },
};
