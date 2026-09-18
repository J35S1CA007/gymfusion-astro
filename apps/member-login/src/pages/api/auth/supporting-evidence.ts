import type { APIRoute } from "astro";
import { runSupportingEvidenceOperation, SUPPORTING_EVIDENCE_OPERATIONS, type SupportingEvidenceOperation } from "../../../lib/supporting-evidence";

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json() as { operation?: unknown; payload?: unknown };
    const operation = body?.operation;
    if (typeof operation !== "string" || !SUPPORTING_EVIDENCE_OPERATIONS.includes(operation as SupportingEvidenceOperation)) {
      return Response.json({ ok: false, code: "INVALID_REQUEST" }, { status: 400 });
    }
    const result = await runSupportingEvidenceOperation(request, operation as SupportingEvidenceOperation, body.payload ?? {});
    return Response.json(result.ok ? result : { ok: false, code: result.code }, { status: result.status });
  } catch {
    return Response.json({ ok: false, code: "INVALID_REQUEST" }, { status: 400 });
  }
};
