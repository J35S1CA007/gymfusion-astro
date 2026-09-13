import assert from "node:assert/strict";
import test from "node:test";
import { getActiveIdentityMapping } from "../src/lib/identity-mapping.ts";
import { buildMemberSessionProjection } from "../src/lib/member-session-projection.ts";

function database(result: { success: boolean; results?: unknown[] }) {
  return {
    prepare(sql: string) {
      assert.match(sql, /LIMIT 2/);
      return { bind: () => ({ all: async () => result }) };
    },
  } as unknown as D1Database;
}

const mapping = {
  betterAuthUserId: "user-1",
  fusionId: "DP0926-233J",
  wixMemberId: "member-1",
  status: "ACTIVE" as const,
};

test("returns the only active identity mapping", async () => {
  assert.deepEqual(await getActiveIdentityMapping(database({ success: true, results: [mapping] }), "user-1"), mapping);
});

test("fails closed when the active mapping is missing, ambiguous, or unreadable", async () => {
  assert.equal(await getActiveIdentityMapping(database({ success: true, results: [] }), "user-1"), undefined);
  assert.equal(await getActiveIdentityMapping(database({ success: true, results: [mapping, mapping] }), "user-1"), undefined);
  assert.equal(await getActiveIdentityMapping(database({ success: false }), "user-1"), undefined);
  assert.equal(await getActiveIdentityMapping(database({ success: true, results: [{ ...mapping, wixMemberId: "" }] }), "user-1"), undefined);
});

test("projects only a member-safe display name", () => {
  assert.deepEqual(buildMemberSessionProjection({ name: " Ada Lovelace ", email: "ada@example.com" }), { displayName: "Ada Lovelace" });
  assert.deepEqual(buildMemberSessionProjection({ email: "ada@example.com", wixMemberId: "member-1" }), { displayName: "Member" });
});
