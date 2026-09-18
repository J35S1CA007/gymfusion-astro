import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

const MAX_BODY_BYTES = 12 * 1024 * 1024;

export const POST: APIRoute = async ({ request }) => {
  const binding = (env as unknown as { SUPPORTING_EVIDENCE_COORDINATOR?: DurableObjectNamespace }).SUPPORTING_EVIDENCE_COORDINATOR;
  if (!binding) return Response.json({ ok: false, code: "COORDINATOR_UNAVAILABLE" }, { status: 503 });
  const body = await request.text();
  if (body.length > MAX_BODY_BYTES) return Response.json({ ok: false, code: "REQUEST_TOO_LARGE" }, { status: 413 });
  let parsed: { operation?: unknown; evidenceKey?: unknown };
  try { parsed = JSON.parse(body) as { evidenceKey?: unknown }; } catch { return Response.json({ ok: false, code: "INVALID_REQUEST" }, { status: 400 }); }
  const evidenceKey = String(parsed.evidenceKey ?? "").trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$/.test(evidenceKey)) return Response.json({ ok: false, code: "INVALID_REQUEST" }, { status: 400 });
  const id = binding.idFromName(`evidence:${evidenceKey}`);
  const stub = binding.get(id);
  const path = parsed.operation === "FENCE" || parsed.operation === "CLAIM_ACK" ? "wix-fence" : "wix-command";
  return stub.fetch(`https://supporting-evidence-coordinator/${path}`, {
    method: "POST",
    body,
    headers: request.headers,
  });
};
