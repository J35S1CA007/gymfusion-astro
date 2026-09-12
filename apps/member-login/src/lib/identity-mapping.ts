export type IdentityMapping = {
  betterAuthUserId: string;
  fusionId: string;
  wixMemberId: string;
  status: "ACTIVE" | "REVOKED";
};

export async function getActiveIdentityMapping(db: D1Database, betterAuthUserId: string): Promise<IdentityMapping | undefined> {
  const row = await db.prepare(
    `SELECT better_auth_user_id AS betterAuthUserId,
            fusion_id AS fusionId,
            wix_member_id AS wixMemberId,
            status
       FROM better_auth_identity_mapping
      WHERE better_auth_user_id = ?1
        AND status = 'ACTIVE'
      LIMIT 1`,
  ).bind(betterAuthUserId).first<IdentityMapping>();
  return row ?? undefined;
}
