import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { clearSession, createLogoutUrl, getSession } from "../../../lib/auth";

export const GET: APIRoute = async ({ request, cookies, redirect }) => {
  const session = await getSession(request, env);
  const logoutUrl = session ? await createLogoutUrl(request, session, env) : undefined;
  await clearSession(request, cookies, env);
  return logoutUrl ? redirect(logoutUrl, 303) : redirect("/", 303);
};
