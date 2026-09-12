import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { createEmbeddedAuth } from "../../../lib/better-auth";
import { getActiveIdentityMapping } from "../../../lib/identity-mapping";

export const GET: APIRoute = async ({ request }) => {
  try {
    const db = (env as unknown as { BETTER_AUTH_DB: D1Database }).BETTER_AUTH_DB;
    const auth = createEmbeddedAuth(db, new URL(request.url).origin);
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) return Response.json({ authenticated: false }, { status: 401 });
    const mapping = await getActiveIdentityMapping(db, session.user.id);
    if (!mapping) return Response.json({ authenticated: false }, { status: 401 });
    return Response.json({ authenticated: true, member: { displayName: session.user.name || session.user.email, memberId: mapping.wixMemberId } }, { status: 200 });
  } catch {
    return Response.json({ authenticated: false }, { status: 401 });
  }
};

