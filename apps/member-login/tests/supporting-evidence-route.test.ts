import assert from "node:assert/strict";
import test from "node:test";
import { POST } from "../src/pages/api/auth/supporting-evidence.ts";
import { clearSupportingEvidenceTestAdapters, setSupportingEvidenceTestAdapters } from "../src/lib/supporting-evidence.ts";

const attachment = {
  fileName: "clearance.pdf",
  fileType: "application/pdf",
  fileSize: 1200,
  contentBase64: "Y2xlYXJhbmNl",
};

async function invoke(operation: string, payload: Record<string, unknown>) {
  return POST({
    request: new Request("https://portal.example/api/auth/supporting-evidence", {
      method: "POST",
      body: JSON.stringify({ operation, payload }),
    }),
  } as never);
}

test("production mutation route derives stable voluntary evidence and operation identities", async () => {
  const bodies: Record<string, unknown>[] = [];
  setSupportingEvidenceTestAdapters({
    session: async () => ({ user: { id: "user-a" } }),
    mapping: async () => ({ fusionId: "F-A", wixMemberId: "member-a" }),
    coordinator: async (body) => {
      const parsed = JSON.parse(body) as Record<string, unknown>;
      bodies.push(parsed);
      const payload = parsed.payload as Record<string, unknown>;
      return Response.json({ ok: true, state: "COMPLETE", requestRef: payload.supportingEvidenceID, status: "Submitted in Response", closed: false });
    },
  });
  try {
    const payload = { idempotencyKey: "voluntary-correlation", attachment };
    const first = await invoke("VOLUNTARY_SUBMIT", payload);
    const second = await invoke("VOLUNTARY_SUBMIT", payload);
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.equal(bodies.length, 2);
    assert.equal(bodies[0].commandID, bodies[1].commandID);
    assert.equal(bodies[0].evidenceKey, bodies[1].evidenceKey);
    assert.equal(bodies[0].operationKey, bodies[1].operationKey);
    assert.equal((bodies[0].payload as Record<string, unknown>).supportingEvidenceID, bodies[0].evidenceKey);
  } finally {
    clearSupportingEvidenceTestAdapters();
  }
});

test("production response route derives a stable command for the same request operation", async () => {
  const bodies: Record<string, unknown>[] = [];
  setSupportingEvidenceTestAdapters({
    session: async () => ({ user: { id: "user-a" } }),
    mapping: async () => ({ fusionId: "F-A", wixMemberId: "member-a" }),
    coordinator: async (body) => {
      bodies.push(JSON.parse(body) as Record<string, unknown>);
      return Response.json({ ok: true, state: "COMPLETE", requestRef: "evidence-request", status: "Submitted in Response", closed: false });
    },
  });
  try {
    const payload = { requestRef: "evidence-request", idempotencyKey: "response-correlation", attachment };
    const first = await invoke("RESPOND", payload);
    const second = await invoke("RESPOND", payload);
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.equal(bodies[0].commandID, bodies[1].commandID);
    assert.equal(bodies[0].evidenceKey, "evidence-request");
    assert.equal(bodies[0].operationKey, bodies[1].operationKey);
  } finally {
    clearSupportingEvidenceTestAdapters();
  }
});
