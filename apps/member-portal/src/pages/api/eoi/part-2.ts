import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { normalizePart2ProxyResult } from "../../../lib/eoi-part-2-completion";

export const POST: APIRoute = async ({ request }) => {
  const cookie = request.headers.get("cookie")?.trim();
  if (!cookie || !env.MEMBER_LOGIN_SERVICE_URL) return Response.json({ ok: false, code: "UNAUTHENTICATED" }, { status: 401 });
  try {
    const endpoint = new URL("/api/auth/eoi-part-2", env.MEMBER_LOGIN_SERVICE_URL);
    const response = await fetch(endpoint, { method: "POST", headers: { cookie, "content-type": "application/json" }, body: JSON.stringify(await request.json()), redirect: "manual" });
    const result = await response.json().catch(() => null) as { ok?: unknown; code?: unknown; submissionID?: unknown; duplicate?: unknown } | null;
    const normalized = normalizePart2ProxyResult(response.status, result);
    return Response.json(normalized.body, { status: normalized.status, headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ ok: false, code: "TEMPORARY_PROCESSING_ERROR" }, { status: 502 });
  }
};
