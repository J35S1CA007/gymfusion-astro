import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { errorMessage, sendRecoveryEmail } from "../../../lib/auth";

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json() as { email?: string };
    const email = String(body.email ?? "").trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) return Response.json({ error: "Enter a valid email address." }, { status: 400 });
    await sendRecoveryEmail(request, email, env);
    return Response.json({ ok: true });
  } catch (error) {
    const result = errorMessage(error);
    return Response.json({ error: result.message }, { status: result.status });
  }
};
