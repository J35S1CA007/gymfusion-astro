import type { APIRoute } from "astro";
import { normalizeAndValidatePart3Payload } from "../../../lib/part3-contract";
import { submitPortalPart } from "../../../lib/portal-submission";

export const POST: APIRoute = async ({ request }) => {
  try {
    const result = await submitPortalPart(request, "3", await request.json(), {
      validate: (payload) => {
        const validation = normalizeAndValidatePart3Payload(payload);
        return validation.ok ? validation : { ok: false as const, status: 400, code: validation.code };
      },
    });
    return Response.json(result.ok ? result : { ok: false, code: result.code }, { status: result.status });
  } catch { return Response.json({ ok: false, code: "INVALID_SUBMISSION" }, { status: 400 }); }
};
