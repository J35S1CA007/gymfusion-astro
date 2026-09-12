import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { completeLogin, errorMessage } from "../../../lib/auth";

export const GET: APIRoute = async ({ request, cookies, redirect }) => {
  try {
    const params = new URL(request.url).searchParams;
    const code = params.get("code");
    const state = params.get("state");
    if (!code || !state) throw new Error("invalid_callback");
    const destination = await completeLogin(request, cookies, code, state, env);
    return redirect(destination, 303);
  } catch (error) {
    const result = errorMessage(error);
    return redirect(`/?auth_error=${encodeURIComponent(result.message)}`, 303);
  }
};
