import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

const MAX_BODY_BYTES = 64 * 1024;
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$/;

export const POST: APIRoute = async ({ request }) => {
  const binding = (env as unknown as { PART2_SIGNATURE_COORDINATOR?: DurableObjectNamespace }).PART2_SIGNATURE_COORDINATOR;
  if (!binding) return Response.json({ ok: false, code: "COORDINATOR_UNAVAILABLE" }, { status: 503 });
  const body = await request.text();
  if (body.length > MAX_BODY_BYTES) return Response.json({ ok: false, code: "REQUEST_TOO_LARGE" }, { status: 413 });
  let parsed: { operation?: unknown; operationID?: unknown };
  try { parsed = JSON.parse(body) as { operation?: unknown; operationID?: unknown }; } catch { return Response.json({ ok: false, code: "INVALID_REQUEST" }, { status: 400 }); }
  const operationID = String(parsed.operationID ?? "").trim();
  if (!IDENTIFIER.test(operationID)) return Response.json({ ok: false, code: "INVALID_REQUEST" }, { status: 400 });
  if (parsed.operation !== "CLAIM" && parsed.operation !== "RESOLVE_ATTEMPT" && parsed.operation !== "ENTER_WRITE") return Response.json({ ok: false, code: "INVALID_REQUEST" }, { status: 400 });
  const id = binding.idFromName(`part2-signature:${operationID}`);
  const stub = binding.get(id);
  const path = parsed.operation === "CLAIM" ? "claim" : parsed.operation === "ENTER_WRITE" ? "enter-write" : "resolve";
  return stub.fetch(`https://part2-signature-coordinator/${path}`, { method: "POST", body, headers: request.headers });
};
