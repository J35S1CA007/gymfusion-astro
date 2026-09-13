// @ts-nocheck

import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve as pathResolve } from "node:path";

const root = pathResolve(fileURLToPath(new URL("../../../", import.meta.url)));
const adapters = {
  "wix-secrets-backend": "wix-secrets-backend.mjs",
  "wix-data": "wix-data.mjs",
  "wix-http-functions": "wix-http-functions.mjs",
};

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "cloudflare:workers") return { url: pathToFileURL(pathResolve(root, "apps/member-login/tests/cloudflare-workers.mjs")).href, shortCircuit: true };
  if (adapters[specifier]) return { url: pathToFileURL(pathResolve(root, "apps/member-login/tests", adapters[specifier])).href, shortCircuit: true };
  try { return await nextResolve(specifier, context); } catch (error) {
    if (specifier.startsWith(".") && !specifier.endsWith(".js") && !specifier.endsWith(".ts")) {
      try { return { url: new URL(`${specifier}.ts`, context.parentURL).href, shortCircuit: true }; } catch {}
    }
    throw error;
  }
}
