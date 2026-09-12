import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { createEmbeddedAuth } from "../../../lib/better-auth";

export const GET: APIRoute = async ({ request, redirect }) => {
  const baseURL = new URL(request.url).origin;
  const db = (env as unknown as { BETTER_AUTH_DB: D1Database }).BETTER_AUTH_DB;
  const auth = createEmbeddedAuth(db, baseURL);
  const authResponse = await auth.handler(new Request(`${baseURL}/api/auth/better/sign-out`, {
    headers: request.headers,
    method: "POST",
  }));
  const response = redirect("/login", 303);
  const setCookie = authResponse.headers.get("set-cookie");
  if (setCookie) {
    for (const cookie of setCookie.split(/,\s*(?=[^;]+=)/)) response.headers.append("set-cookie", cookie);
  }
  for (const name of ["__Secure-better-auth.session_token", "__Secure-better-auth.session_data", "__Secure-better-auth.dont_remember"]) {
    response.headers.append("set-cookie", `${name}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`);
  }
  return response;
};
