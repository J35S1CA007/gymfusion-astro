export type PortalReadResult = { kind: "authenticated"; view: string; data: Record<string, unknown> } | { kind: "unauthenticated" | "unavailable" };

export async function readMemberPortalView(request: Request, serviceBaseUrl: string | undefined, view: string, fetcher: typeof fetch = fetch): Promise<PortalReadResult> {
  if (!serviceBaseUrl) return { kind: "unavailable" };
  let endpoint: URL;
  try {
    endpoint = new URL("/api/auth/portal-read", serviceBaseUrl);
  } catch {
    return { kind: "unavailable" };
  }
  try {
    const cookie = request.headers.get("cookie")?.trim();
    if (!cookie) return { kind: "unauthenticated" };
    const response = await fetcher(endpoint.href, { method: "POST", headers: { cookie, "content-type": "application/json" }, body: JSON.stringify({ view }), redirect: "manual" });
    if (response.status === 401) return { kind: "unauthenticated" };
    if (response.status !== 200) return { kind: "unavailable" };
    const payload = await response.json() as { authenticated?: unknown; view?: unknown; data?: unknown };
    return payload.authenticated === true && typeof payload.view === "string" && payload.data && typeof payload.data === "object"
      ? { kind: "authenticated", view: payload.view, data: payload.data as Record<string, unknown> }
      : { kind: "unavailable" };
  } catch {
    return { kind: "unavailable" };
  }
}
