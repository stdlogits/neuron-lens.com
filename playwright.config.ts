import { defineConfig, devices } from "@playwright/test";

// The e2e specs run the dev server on the mock catalog (e2e/fixtures): `npm run test:e2e`.
// scripts/verify-deployment.mjs checks a deployed site instead.
const port = 5195;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx vite --port ${port} --strictPort --host 127.0.0.1`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: true,
  },
});
