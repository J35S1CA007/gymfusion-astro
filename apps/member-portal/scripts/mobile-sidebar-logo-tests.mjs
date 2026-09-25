import assert from "node:assert/strict";
import fs from "node:fs";
import { MEMBERS_PORTAL_LOGO_ASSET, resolvePortalAssetUrl } from "../src/lib/portal-asset.ts";

assert.equal(
  resolvePortalAssetUrl(MEMBERS_PORTAL_LOGO_ASSET, "portal.gymfusion.com.au"),
  "/__portal_assets/assets/branding/gf-members-portal-transparent%20logo.png",
);
assert.equal(
  resolvePortalAssetUrl(MEMBERS_PORTAL_LOGO_ASSET, "gymfusion-member-portal.jess-forte-98.workers.dev"),
  MEMBERS_PORTAL_LOGO_ASSET,
);
assert.equal(resolvePortalAssetUrl(MEMBERS_PORTAL_LOGO_ASSET, "localhost"), MEMBERS_PORTAL_LOGO_ASSET);
assert.equal(resolvePortalAssetUrl(MEMBERS_PORTAL_LOGO_ASSET), MEMBERS_PORTAL_LOGO_ASSET);

const shell = fs.readFileSync(new URL("../src/components/portal/PortalShell.tsx", import.meta.url), "utf8");
assert.equal(shell.match(/src=\{membersPortalLogo\}/g)?.length, 2);
assert.equal(shell.includes("src=\"/assets/branding/gf-members-portal-transparent%20logo.png\""), false);

console.log("mobile sidebar logo tests: PASS");
