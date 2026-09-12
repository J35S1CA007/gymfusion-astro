import { betterAuth } from "better-auth";

export type PasswordEmailSender = (input: {
  recipient: string;
  displayName: string;
  resetUrl: string;
  template: "activation" | "reset";
}) => Promise<void>;

export async function getPasswordEmailTemplate(db: D1Database, userId: string) {
  const status = await db.prepare(
    "SELECT status FROM portal_account_status WHERE better_auth_user_id = ?1",
  ).bind(userId).first<{ status: "ACTIVE" | "REVOKED" }>();
  if (status?.status === "REVOKED") return null;

  const credential = await db.prepare(
    "SELECT password FROM account WHERE userId = ?1 AND providerId = 'credential' LIMIT 1",
  ).bind(userId).first<{ password: string | null }>();
  return credential?.password ? "reset" : "activation";
}

export function createEmbeddedAuth(db: D1Database, baseURL: string, sendPasswordEmail?: PasswordEmailSender) {
  return betterAuth({
    database: db,
    basePath: "/api/auth/better",
    emailAndPassword: {
      enabled: true,
      resetPasswordTokenExpiresIn: 900,
      revokeSessionsOnPasswordReset: true,
          sendResetPassword: sendPasswordEmail
        ? async ({ user, url }) => {
            const template = await getPasswordEmailTemplate(db, user.id);
            if (!template) return;
            const parsed = new URL(url);
            const token = parsed.searchParams.get("token") || parsed.pathname.split("/").filter(Boolean).pop();
            if (!token) return;
            await sendPasswordEmail({
              recipient: user.email,
              displayName: user.name,
              resetUrl: `${baseURL}/activate?token=${encodeURIComponent(token)}`,
              template,
            });
          }
        : undefined,
    },
    baseURL,
    trustedOrigins: [baseURL],
  });
}
