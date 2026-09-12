import type { APIRoute } from "astro";
import { submitPortalPart } from "../../../lib/portal-submission";

export const POST: APIRoute = async ({ request }) => {
  try {
    const result = await submitPortalPart(request, "4", await request.json());
    return Response.json(result.ok ? result : { ok: false, code: result.code }, { status: result.status });
  } catch { return Response.json({ ok: false, code: "INVALID_SUBMISSION" }, { status: 400 }); }
};
