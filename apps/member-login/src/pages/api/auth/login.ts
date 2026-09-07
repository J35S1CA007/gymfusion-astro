import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { beginLogin, errorMessage } from "../../../lib/auth";

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const body = await request.json() as { email?: string; password?: string };
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    if (!/^\S+@\S+\.\S+$/.test(email) || !password) {
      return Response.json({ error: "Enter a valid email and password." }, { status: 400 });
    }
    const redirectUrl = await beginLogin(request, cookies, email, password, env);
    return Response.json({ redirectUrl });
  } catch (error) {
    const result = errorMessage(error);
    return Response.json({ error: result.message }, { status: result.status });
  }
};
