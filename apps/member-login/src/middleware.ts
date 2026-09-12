import { defineMiddleware } from "astro:middleware";
import { env } from "cloudflare:workers";

const portalPaths = ["/dashboard", "/submissions", "/profile", "/account", "/help", "/eoi", "/supporting-evidence", "/api/rfm-"];
const assetPrefixes = ["/__portal_assets/", "/__portal_fonts/", "/__portal_uploads/"];

function isPortalPath(pathname: string): boolean {
  return portalPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`)) || assetPrefixes.some((path) => pathname.startsWith(path));
}

export const onRequest = defineMiddleware(async (context, next) => {
  if (!isPortalPath(context.url.pathname)) return next();
  const service = String((env as { MEMBER_PORTAL_SERVICE_URL?: string }).MEMBER_PORTAL_SERVICE_URL ?? "").trim();
  if (!service) return next();

  const sourcePath = context.url.pathname.replace(/^\/__portal_(assets|fonts|uploads)/, (_match, kind) => kind === "assets" ? "" : `/${kind}`);
  const target = new URL(sourcePath + context.url.search, service);
  const request = new Request(target, context.request);
  request.headers.set("host", target.host);
  const response = await fetch(request);
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) return response;

  const html = await response.text();
  const rewritten = html
    .replaceAll("/_astro/", "/__portal_assets/_astro/")
    .replaceAll("/assets/", "/__portal_assets/assets/")
    .replaceAll("/fonts/", "/__portal_fonts/");
  return new Response(rewritten, { status: response.status, headers: response.headers });
});

