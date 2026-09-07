import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { getMemberContext, getSession } from "../../../lib/auth";

export const GET: APIRoute = async ({ request }) => {
  try {
    const session = await getSession(request, env);
    if (!session) return Response.json({ authenticated: false }, { status: 401 });
    const member = await getMemberContext(session);
    if (!member) return Response.json({ authenticated: false }, { status: 401 });
    return Response.json({ authenticated: true, member }, { status: 200 });
  } catch {
    return Response.json({ authenticated: false }, { status: 401 });
  }
};
