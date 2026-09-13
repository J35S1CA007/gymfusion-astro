export type IdentityMapping = {
  betterAuthUserId: string;
  fusionId: string;
  wixMemberId: string;
  status: "ACTIVE" | "REVOKED";
};

export async function getActiveIdentityMapping(db: D1Database, betterAuthUserId: string): Promise<IdentityMapping | undefined> {
  const result = await db.prepare(
    `SELECT better_auth_user_id AS betterAuthUserId,
            fusion_id AS fusionId,
            wix_member_id AS wixMemberId,
            status
       FROM better_auth_identity_mapping
      WHERE better_auth_user_id = ?1
        AND status = 'ACTIVE'
      LIMIT 2`,
  ).bind(betterAuthUserId).all<IdentityMapping>();
  if (!result.success || !Array.isArray(result.results) || result.results.length !== 1) return undefined;
  const row = result.results[0];
  if (!row || row.status !== "ACTIVE" || row.betterAuthUserId !== betterAuthUserId) return undefined;
  if (![row.betterAuthUserId, row.fusionId, row.wixMemberId].every((value) => typeof value === "string" && value.length > 0 && value.trim() === value)) return undefined;
  return row;
}
