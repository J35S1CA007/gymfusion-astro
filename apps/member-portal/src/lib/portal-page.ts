import { checkMemberLoginSession } from "./member-login-session";

import { env } from "cloudflare:workers";

function serviceUrl() {
  return (String((env as { MEMBER_LOGIN_SERVICE_URL?: string }).MEMBER_LOGIN_SERVICE_URL ?? "").trim() || undefined)
    || (import.meta.env.MEMBER_LOGIN_SERVICE_URL as string | undefined)
    || (typeof process !== "undefined" ? process.env.MEMBER_LOGIN_SERVICE_URL : undefined)
    || (import.meta.env.DEV ? "http://127.0.0.1:4321" : undefined);
}

export async function loadPortalPage(request: Request, _locals?: object) {
  const session = await checkMemberLoginSession(request, serviceUrl());
  return session;
}
