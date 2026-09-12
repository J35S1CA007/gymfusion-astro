import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const POST: APIRoute = async ({ request }) => {
  const cookie = request.headers.get("cookie")?.trim();
  if (!cookie || !env.MEMBER_LOGIN_SERVICE_URL) return Response.json({ ok: false, code: "UNAUTHENTICATED" }, { status: 401 });
  try {
    const endpoint = new URL("/api/auth/rfm-part2", env.MEMBER_LOGIN_SERVICE_URL);
    const response = await fetch(endpoint, { method: "POST", headers: { cookie, "content-type": "application/json" }, body: JSON.stringify(await request.json()), redirect: "manual" });
    return new Response(await response.text(), { status: response.status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
  } catch {
    return Response.json({ ok: false, code: "TEMPORARY_PROCESSING_ERROR" }, { status: 502 });
  }
};
