import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { createEmbeddedAuth } from "../../../lib/better-auth";
import { getActiveIdentityMapping } from "../../../lib/identity-mapping";
import { buildC0BridgeRequest, MEMBER_PORTAL_READ_BRIDGE_PATH } from "../../../lib/c0-bridge-hmac";

const allowedViews = new Set(["dashboard", "submissions", "profile", "account", "eoi", "supporting-evidence", "profile-change-requests"]);

export const POST: APIRoute = async ({ request }) => {
  try {
    const baseURL = new URL(request.url).origin;
    const db = (env as unknown as { BETTER_AUTH_DB: D1Database }).BETTER_AUTH_DB;
    const auth = createEmbeddedAuth(db, baseURL);
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) return Response.json({ authenticated: false }, { status: 401 });
    const mapping = await getActiveIdentityMapping(db, session.user.id);
    if (!mapping) return Response.json({ authenticated: false }, { status: 401 });
    const body = await request.json().catch(() => ({})) as { view?: unknown };
    const view = typeof body?.view === "string" && allowedViews.has(body.view) ? body.view : "dashboard";
    const path = MEMBER_PORTAL_READ_BRIDGE_PATH;
    const bridge = buildC0BridgeRequest({
      secret: String((env as { C0_BRIDGE_SIGNING_SECRET?: string }).C0_BRIDGE_SIGNING_SECRET ?? ""),
      path,
      body: JSON.stringify({ fusionId: mapping.fusionId, wixMemberId: mapping.wixMemberId, view }),
    });
    const bridgeResponse = await fetch(`https://www.gymfusion.com.au${path}`, {
      body: bridge.body,
      headers: { ...bridge.headers, "content-type": "application/json" },
      method: "POST",
    });
    const result = await bridgeResponse.json().catch(() => null) as Record<string, unknown> | null;
    if (!bridgeResponse.ok || !result?.ok) return Response.json({ authenticated: false }, { status: 401 });
    return Response.json({ authenticated: true, ...result }, { status: 200 });
  } catch {
    return Response.json({ authenticated: false }, { status: 401 });
  }
};
