import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { createEmbeddedAuth } from "../../../../lib/better-auth";
import { sendActivationEmail, sendResetPasswordEmail } from "../../../../lib/better-auth-graph-mail";

export const ALL: APIRoute = ({ request }) => {
  const baseURL = new URL(request.url).origin;
  const config = {
    tenantId: String((env as { GYMFUSION_TENANT_ID?: string }).GYMFUSION_TENANT_ID ?? ""),
    clientId: String((env as { GYMFUSION_AUTOMATION_APP_CLIENT_ID?: string }).GYMFUSION_AUTOMATION_APP_CLIENT_ID ?? ""),
    clientSecret: String((env as { GYMFUSION_GRAPH_CLIENT_SECRET?: string }).GYMFUSION_GRAPH_CLIENT_SECRET ?? ""),
    sender: String((env as { GYMFUSION_GRAPH_SENDER_EMAIL?: string }).GYMFUSION_GRAPH_SENDER_EMAIL ?? ""),
    replyTo: "support@gymfusion.com.au",
  };
  const betterAuthDb = (env as unknown as { BETTER_AUTH_DB: D1Database }).BETTER_AUTH_DB;
  return createEmbeddedAuth(betterAuthDb, baseURL, (input) => input.template === "activation"
    ? sendActivationEmail(config, { recipient: input.recipient, displayName: input.displayName, activationUrl: input.resetUrl })
    : sendResetPasswordEmail(config, input)
  ).handler(request);
};

