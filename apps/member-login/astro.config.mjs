import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";

export default defineConfig({
  session: false,
  adapter: cloudflare(),
  output: "server",
});
