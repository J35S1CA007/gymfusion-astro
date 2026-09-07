import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { getMemberPortalRead, getSession } from "../../../lib/auth";

const allowedViews = new Set(["dashboard", "submissions", "profile", "account", "eoi", "supporting-evidence", "profile-change-requests"]);

export const POST: APIRoute = async ({ request }) => {
  try {
    const session = await getSession(request, env);
    if (!session) return Response.json({ authenticated: false }, { status: 401 });
    const body = await request.json().catch(() => ({})) as { view?: unknown };
    const view = typeof body?.view === "string" && allowedViews.has(body.view) ? body.view : "dashboard";
    const result = await getMemberPortalRead(session, view);
    if (!result) return Response.json({ authenticated: false }, { status: 401 });
    return Response.json({ authenticated: true, ...result as object }, { status: 200 });
  } catch {
    return Response.json({ authenticated: false }, { status: 401 });
  }
};
