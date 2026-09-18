import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

const MAX_BODY_BYTES = 1024 * 1024;
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$/;

export const POST: APIRoute = async ({ request }) => {
  const binding = (env as unknown as { DOCUMENT_STORAGE_REFERENCE_COORDINATOR?: DurableObjectNamespace }).DOCUMENT_STORAGE_REFERENCE_COORDINATOR;
  if (!binding) return Response.json({ ok: false, code: "COORDINATOR_UNAVAILABLE" }, { status: 503 });
  const body = await request.text();
  if (body.length > MAX_BODY_BYTES) return Response.json({ ok: false, code: "REQUEST_TOO_LARGE" }, { status: 413 });
  let parsed: { storageReferenceID?: unknown; operation?: unknown };
  try { parsed = JSON.parse(body) as { storageReferenceID?: unknown; operation?: unknown }; } catch { return Response.json({ ok: false, code: "INVALID_REQUEST" }, { status: 400 }); }
  const storageReferenceID = String(parsed.storageReferenceID ?? "").trim();
  if (!IDENTIFIER.test(storageReferenceID)) return Response.json({ ok: false, code: "INVALID_REQUEST" }, { status: 400 });
  const stub = binding.get(binding.idFromName(`storage-reference:${storageReferenceID}`));
  const path = parsed.operation === "START" ? "start" : parsed.operation === "ENTER_MUTATION" ? "enter" : parsed.operation === "RESOLVE" ? "resolve" : "unknown";
  return stub.fetch(`https://document-storage-reference-coordinator/${path}`, { method: "POST", body, headers: request.headers });
};
