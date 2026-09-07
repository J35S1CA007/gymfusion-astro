import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { getSession, submitRfmPart2 } from "../../../lib/auth";

export const POST: APIRoute = async ({ request }) => {
  try {
    const session = await getSession(request, env);
    if (!session) return Response.json({ ok: false, code: "UNAUTHENTICATED" }, { status: 401 });
    const payload = await request.json();
    const result = await submitRfmPart2(session, payload);
    return result ? Response.json({ ok: true, ...result }) : Response.json({ ok: false, code: "TEMPORARY_PROCESSING_ERROR" }, { status: 502 });
  } catch {
    return Response.json({ ok: false, code: "INVALID_SUBMISSION" }, { status: 400 });
  }
};
