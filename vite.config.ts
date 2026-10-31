import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { siteMeta } from "./scripts/site/meta.ts";

// A single-page app: Cloudflare Pages serves index.html for every path without a file, and the
// catalog under public/data is copied into the build as it is. siteMeta writes what the site says
// about itself (the head, llms.txt, the sitemap).
export default defineConfig({
  plugins: [svelte(), siteMeta()],
  build: { target: "es2022", assetsInlineLimit: 0 },
  server: { port: 5180 },
  preview: { port: 5181 },
});
