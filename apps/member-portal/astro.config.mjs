// @ts-check
import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";

import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  session: false,
  integrations: [react()],
  adapter: cloudflare(),
  output: "server",

  vite: {
    plugins: [tailwindcss()],
  },
});
