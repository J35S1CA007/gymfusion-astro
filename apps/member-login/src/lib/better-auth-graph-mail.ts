import { createPortalActivationEmail } from "./portal-activation-email.ts";
import { createPortalResetPasswordEmail } from "./portal-reset-password-email.ts";

export type GraphMailConfig = {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  sender: string;
  replyTo?: string;
};

type Mail = ReturnType<typeof createPortalActivationEmail>;

async function graphFailureDetails(response: Response) {
  const payload = await response.clone().json().catch(() => null) as { error?: { code?: string } | string } | null;
  const error = payload?.error;
  return {
    status: response.status,
    code: typeof error === "string" ? error : error?.code ?? "unknown",
  };
}

async function sendGraphMail(config: GraphMailConfig, mail: Mail) {
  const tokenResponse = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(config.tenantId)}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    }),
  });

  if (!tokenResponse.ok) {
    const details = await graphFailureDetails(tokenResponse);
    console.error("Microsoft Graph token request failed", details);
    throw new Error(`Microsoft Graph token request failed (${details.status})`);
  }
  const token = (await tokenResponse.json() as { access_token?: string }).access_token;
  if (!token) throw new Error("Microsoft Graph token response was incomplete");

  const mailResponse = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(config.sender)}/sendMail`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      message: {
        subject: mail.subject,
        body: { contentType: "HTML", content: mail.html },
        toRecipients: [{ emailAddress: { address: mail.to } }],
        ...(config.replyTo ? { replyTo: [{ emailAddress: { address: config.replyTo } }] } : {}),
      },
      saveToSentItems: false,
    }),
  });

  if (!mailResponse.ok) {
    const details = await graphFailureDetails(mailResponse);
    console.error("Microsoft Graph email delivery failed", details);
    throw new Error(`Microsoft Graph email delivery failed (${details.status})`);
  }
}

export async function sendActivationEmail(config: GraphMailConfig, input: {
  recipient: string;
  displayName: string;
  activationUrl: string;
}) {
  await sendGraphMail(config, createPortalActivationEmail(input));
}

export async function sendResetPasswordEmail(config: GraphMailConfig, input: {
  recipient: string;
  displayName: string;
  resetUrl: string;
}) {
  await sendGraphMail(config, createPortalResetPasswordEmail(input));
}

