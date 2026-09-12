import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { errorMessage, verifyTurnstileToken } from "../../../lib/auth";
import { createEmbeddedAuth } from "../../../lib/better-auth";

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json() as { email?: string; password?: string; turnstileToken?: unknown };
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    if (!/^\S+@\S+\.\S+$/.test(email) || !password) {
      return Response.json({ error: "Enter a valid email and password." }, { status: 400 });
    }
    if (!await verifyTurnstileToken(body.turnstileToken, env)) {
      return Response.json({ error: "We could not verify this login attempt. Please try again." }, { status: 403 });
    }
    const baseURL = new URL(request.url).origin;
    const db = (env as unknown as { BETTER_AUTH_DB: D1Database }).BETTER_AUTH_DB;
    const auth = createEmbeddedAuth(db, baseURL);
    const authResponse = await auth.handler(new Request(`${baseURL}/api/auth/better/sign-in/email`, {
      body: JSON.stringify({ email, password, rememberMe: true }),
      headers: { "content-type": "application/json", origin: baseURL },
      method: "POST",
    }));
    if (!authResponse.ok) return Response.json({ error: "The email or password is incorrect." }, { status: 401 });
    const redirectUrl = String((env as { MEMBERS_PORTAL_URL?: string }).MEMBERS_PORTAL_URL ?? "/dashboard");
    const response = Response.json({ redirectUrl });
    const setCookie = authResponse.headers.get("set-cookie");
    if (setCookie) response.headers.set("set-cookie", setCookie);
    return response;
  } catch (error) {
    const result = errorMessage(error);
    return Response.json({ error: result.message }, { status: result.status });
  }
};

