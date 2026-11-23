import { defineConfig, type Plugin } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { serveCatalog } from "./scripts/catalog/serve.ts";
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

/** The Latin faces every page sets its first screen in, preloaded from the page's head: Ledger's faces swap in when
 * they arrive, and arriving with the page (rather than after its CSS) keeps the first screen from reflowing as they do. */
function preloadFaces(): Plugin {
  const FIRST = [/^WixMadeforText-normal-latin-/, /^WixMadeforDisplay-latin-/];
  return {
    name: "preload-faces",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      handler(_html, { bundle }) {
        return Object.keys(bundle ?? {})
          .filter((name) => FIRST.some((face) => face.test(name.split("/").pop()!)) && !name.includes("latin-ext") && name.endsWith(".woff2"))
          .map((name) => ({ tag: "link", attrs: { rel: "preload", as: "font", type: "font/woff2", href: `/${name}`, crossorigin: "" }, injectTo: "head" as const }));
      },
    },
  };
}

// A single-page app: Cloudflare Pages serves index.html for every path without a file. The catalog
// isn't in the build: the site reads it from R2 (src/lib/data.ts), and the dev server serves the local
// copy at /data (serveCatalog). siteMeta writes what the site says about itself (the head, llms.txt,
// the sitemap).
export default defineConfig({
  plugins: [svelte(), siteMeta(), themePreflight(), serveCatalog(), preloadFaces()],
  // Ledger ships .svelte.ts modules, which vite-plugin-svelte's dependency pre-bundling (7.0 to 7.3)
  // hands to Svelte with their types still in. The dev server serves it as source instead.
  optimizeDeps: { exclude: ["@stdlogits/ledger"] },
  build: { target: "es2022", assetsInlineLimit: 0 },
  server: { port: 5180 },
  preview: { port: 5181 },
});
