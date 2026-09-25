const DIRECT_PORTAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isDirectPortalHost(hostname?: string): boolean {
  return !hostname || DIRECT_PORTAL_HOSTS.has(hostname) || hostname.endsWith(".workers.dev");
}

export const MEMBERS_PORTAL_LOGO_ASSET = "/assets/branding/gf-members-portal-transparent%20logo.png";

export function resolvePortalAssetUrl(pathname: string, hostname?: string): string {
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return isDirectPortalHost(hostname) ? normalizedPath : `/__portal_assets${normalizedPath}`;
}
