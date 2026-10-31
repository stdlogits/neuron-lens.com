import { defineConfig, type Plugin } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { siteMeta } from "./scripts/site/meta.ts";

/** Ledger's pre-paint theme script, served from the site's own origin at /theme-preflight.js (the CSP
 * allows no inline script) and written into the build as it is. index.html names the theme's key. */
function themePreflight(): Plugin {
  const PATH = "theme-preflight.js";
  const source = () => readFileSync(createRequire(import.meta.url).resolve(`@stdlogits/ledger/${PATH}`));
  return {
    name: "theme-preflight",
    configureServer(server) {
      server.middlewares.use(`/${PATH}`, (_request, response) => {
        response.setHeader("Content-Type", "text/javascript");
        response.end(source());
      });
    },
    generateBundle() {
      this.emitFile({ type: "asset", fileName: PATH, source: source() });
    },
  };
}

// A single-page app: Cloudflare Pages serves index.html for every path without a file, and the
// catalog under public/data is copied into the build as it is. siteMeta writes what the site says
// about itself (the head, llms.txt, the sitemap).
export default defineConfig({
  plugins: [svelte(), siteMeta(), themePreflight()],
  // Ledger ships .svelte.ts modules, which vite-plugin-svelte's dependency pre-bundling (7.0 to 7.3)
  // hands to Svelte with their types still in. The dev server serves it as source instead.
  optimizeDeps: { exclude: ["@stdlogits/ledger"] },
  build: { target: "es2022", assetsInlineLimit: 0 },
  server: { port: 5180 },
  preview: { port: 5181 },
});
