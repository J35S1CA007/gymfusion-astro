import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { errorMessage } from "../../../lib/auth";
import { createEmbeddedAuth } from "../../../lib/better-auth";
import { sendActivationEmail, sendResetPasswordEmail } from "../../../lib/better-auth-graph-mail";

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json() as { email?: string };
    const email = String(body.email ?? "").trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) return Response.json({ error: "Enter a valid email address." }, { status: 400 });
    const baseURL = new URL(request.url).origin;
    const config = {
      tenantId: String((env as { GYMFUSION_TENANT_ID?: string }).GYMFUSION_TENANT_ID ?? ""),
      clientId: String((env as { GYMFUSION_AUTOMATION_APP_CLIENT_ID?: string }).GYMFUSION_AUTOMATION_APP_CLIENT_ID ?? ""),
      clientSecret: String((env as { GYMFUSION_GRAPH_CLIENT_SECRET?: string }).GYMFUSION_GRAPH_CLIENT_SECRET ?? ""),
      sender: String((env as { GYMFUSION_GRAPH_SENDER_EMAIL?: string }).GYMFUSION_GRAPH_SENDER_EMAIL ?? ""),
      replyTo: "support@gymfusion.com.au",
    };
    const betterAuthDb = (env as unknown as { BETTER_AUTH_DB: D1Database }).BETTER_AUTH_DB;
    const auth = createEmbeddedAuth(betterAuthDb, baseURL, (input) => input.template === "activation"
      ? sendActivationEmail(config, { recipient: input.recipient, displayName: input.displayName, activationUrl: input.resetUrl })
      : sendResetPasswordEmail(config, input));
    await auth.api.requestPasswordReset({
      body: { email, redirectTo: `${baseURL}/activate` },
    });
    return Response.json({ ok: true });
  } catch (error) {
    const result = errorMessage(error);
    return Response.json({ error: result.message }, { status: result.status });
  }
};
