export type SessionCheckResult =
  | { kind: "authenticated"; displayName: string }
  | { kind: "redirect" }
  | { kind: "unavailable" };

type SessionPayload = { authenticated?: unknown; member?: { displayName?: unknown } };

type SessionFetch = (input: string, init: RequestInit) => Promise<Response>;

const SESSION_TIMEOUT_MS = 5_000;

function sessionCookies(request: Request): string | undefined {
  const value = request.headers.get("cookie")?.trim();
  return value || undefined;
}

export async function checkMemberLoginSession(
  request: Request,
  serviceBaseUrl: string | undefined,
  fetcher: SessionFetch = fetch,
): Promise<SessionCheckResult> {
  const cookie = sessionCookies(request);
  if (!cookie) return { kind: "redirect" };

  let endpoint: URL;
  try {
    if (!serviceBaseUrl) return { kind: "unavailable" };
    endpoint = new URL("/api/auth/session", serviceBaseUrl);
    if (endpoint.protocol !== "https:" && endpoint.hostname !== "127.0.0.1" && endpoint.hostname !== "localhost") {
      return { kind: "unavailable" };
    }
  } catch {
    return { kind: "unavailable" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SESSION_TIMEOUT_MS);
  try {
    const response = await fetcher(endpoint.href, {
      headers: { cookie },
      redirect: "manual",
      signal: controller.signal,
    });
    if (response.status === 401) return { kind: "redirect" };
    if (response.status !== 200 || response.redirected) return { kind: "unavailable" };

    const payload = await response.json() as SessionPayload;
    const displayName = typeof payload.member?.displayName === "string" ? payload.member.displayName.trim() : "";
    return payload.authenticated === true && displayName ? { kind: "authenticated", displayName } : { kind: "unavailable" };
  } catch {
    return { kind: "unavailable" };
  } finally {
    clearTimeout(timer);
  }
}
