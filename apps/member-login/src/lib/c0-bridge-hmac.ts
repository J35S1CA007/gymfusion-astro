import { createHash, createHmac, timingSafeEqual, randomBytes } from "node:crypto";

export const C0_BRIDGE_PATH = "/_functions/portalActivationIdentityRead";
export const MEMBER_PORTAL_READ_PATH = "/_functions/member_portal_read";
export const MEMBER_PORTAL_SUPPORTING_EVIDENCE_PATH = "/_functions/member_portal_supporting_evidence_bridge";
export const C0_BRIDGE_CLOCK_SKEW_MS = 5 * 60 * 1000;

export type C0BridgeHeaders = Record<string, string>;
export type NonceStore = { has(nonce: string): Promise<boolean> | boolean; reserve(nonce: string, expiresAt: number): Promise<boolean> | boolean };

const hex = (value: Uint8Array) => Array.from(value, (byte) => byte.toString(16).padStart(2, "0")).join("");
export const sha256 = (body: string) => hex(createHash("sha256").update(Buffer.from(body, "utf8")).digest());
export const canonicalRequest = (method: string, path: string, timestamp: string, nonce: string, bodyHash: string) => [method.toUpperCase(), path, timestamp, nonce, bodyHash].join("\n");
export const signCanonicalRequest = (secret: string, canonical: string) => hex(createHmac("sha256", secret).update(canonical).digest());

export function buildC0BridgeRequest({ secret, body, method = "POST", path = C0_BRIDGE_PATH, now = Date.now(), nonce = hex(randomBytes(16)) }: { secret?: string; body: string; method?: string; path?: string; now?: number; nonce?: string }): { headers: C0BridgeHeaders; body: string } {
  if (!secret) throw new Error("C0 bridge secret is required");
  const timestamp = String(now);
  const bodyHash = sha256(body);
  const signature = signCanonicalRequest(secret, canonicalRequest(method, path, timestamp, nonce, bodyHash));
  return { body, headers: { "X-GF-Timestamp": timestamp, "X-GF-Nonce": nonce, "X-GF-Body-SHA256": bodyHash, "X-GF-Signature": signature } };
}

export async function verifyC0BridgeRequest({ secret, method = "POST", path = C0_BRIDGE_PATH, body, headers, nonceStore, now = Date.now() }: { secret?: string; method?: string; path?: string; body: string; headers: C0BridgeHeaders; nonceStore: NonceStore; now?: number }): Promise<{ ok: true } | { ok: false; code: "UNAUTHORIZED" }> {
  if (!secret) return { ok: false, code: "UNAUTHORIZED" };
  const timestamp = headers["X-GF-Timestamp"] || headers["x-gf-timestamp"];
  const nonce = headers["X-GF-Nonce"] || headers["x-gf-nonce"];
  const bodyHash = headers["X-GF-Body-SHA256"] || headers["x-gf-body-sha256"];
  const signature = headers["X-GF-Signature"] || headers["x-gf-signature"];
  const parsed = Number(timestamp);
  if (!timestamp || !nonce || !bodyHash || !signature || !/^[0-9a-f]{32}$/.test(nonce) || !Number.isSafeInteger(parsed) || Math.abs(now - parsed) > C0_BRIDGE_CLOCK_SKEW_MS) return { ok: false, code: "UNAUTHORIZED" };
  const actualBodyHash = sha256(body);
  if (actualBodyHash !== bodyHash) return { ok: false, code: "UNAUTHORIZED" };
  const expected = signCanonicalRequest(secret, canonicalRequest(method, path, timestamp, nonce, bodyHash));
  const a = Buffer.from(signature, "hex"); const b = Buffer.from(expected, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, code: "UNAUTHORIZED" };
  if (await nonceStore.has(nonce)) return { ok: false, code: "UNAUTHORIZED" };
  if (!(await nonceStore.reserve(nonce, parsed + C0_BRIDGE_CLOCK_SKEW_MS))) return { ok: false, code: "UNAUTHORIZED" };
  return { ok: true };
}
