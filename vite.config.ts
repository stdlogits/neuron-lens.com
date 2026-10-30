import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

// A single-page app: Cloudflare Pages serves index.html for every path without a file, and the
// catalog under public/data is copied into the build as it is.
export default defineConfig({
  plugins: [svelte()],
  build: { target: "es2022", assetsInlineLimit: 0 },
  server: { port: 5180 },
  preview: { port: 5181 },
});
