import { expect, test, type Page } from "@playwright/test";
import { serveCatalog } from "./fixtures/catalog.mjs";

// The site around the explorer: its pages, what it says about itself, a clean console, and phone widths.

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await serveCatalog(page);
});

const settle = (page: Page) => page.waitForLoadState("networkidle");
const explorerTitle = (page: Page) => page.getByRole("heading", { level: 1, name: "Explorer", exact: true });

for (const [path, name] of [["/about", "About"], ["/credits", "Credits"]] as const) {
  test(`${path} renders`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator("main h1")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Site" }).getByRole("link", { name, exact: true })).toHaveAttribute("aria-current", "page");
    await expect(explorerTitle(page)).toHaveCount(0);
  });
}

for (const path of ["/no-such-page", "/qwen3-8b/L99", "/gemma-4-12b/L8/n99999"]) {
  test(`an unknown path renders the missing page: ${path}`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page.locator("main h1")).toBeVisible();
    await expect(explorerTitle(page)).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Site" }).locator('[aria-current="page"]')).toHaveCount(0);
    expect(new URL(page.url()).pathname).toBe(path);
  });
}

for (const [path, canonical] of [["/", "/"], ["/qwen3-8b", "/"], ["/gemma-4-12b/L14/n8313?all", "/gemma-4-12b/L14/n8313"], ["/neurons?layer=20&head=17", "/qwen3-8b/L20/h17"], ["/about", "/about"]]) {
  test(`${path} names its canonical address`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `https://neuron-lens.com${canonical}`);
    await expect(page.locator('meta[name="robots"][content="noindex"]')).toHaveCount(0);
  });
}

test("the missing page asks not to be indexed", async ({ page }) => {
  await page.goto("/no-such-page");
  await expect(page.locator('meta[name="robots"][content="noindex"]')).toHaveCount(1);
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
});

test("the summary is for readers that run no script", async ({ browser }) => {
  const bare = await browser.newPage({ javaScriptEnabled: false });
  await bare.goto("/qwen3-8b/L8/n344");
  await expect(bare.getByRole("heading", { level: 1, name: "Neuron Lens" })).toBeVisible();
  await expect(bare.getByRole("link", { name: "Neuron Lens for language models" })).toHaveAttribute("href", "/llms.txt");
  await bare.close();
  // With script, the app replaces it.
  const page = await browser.newPage();
  await page.goto("/about");
  await expect(page.locator("main h1")).toBeVisible();
  await expect(page.locator("#app > .summary")).toHaveCount(0);
  await page.close();
});

test("llms.txt and the sitemap are served", async ({ request }) => {
  const llms = await request.get("/llms.txt");
  expect(llms.ok()).toBe(true);
  expect(await llms.text()).toMatch(/^# Neuron Lens\n\n> What each neuron/);
  expect(await (await request.get("/sitemap.xml")).text()).toContain("<loc>https://neuron-lens.com/about</loc>");
});

const TOUR = ["/", "/gemma-4-12b", "/qwen3-8b/L8/n344", "/qwen3-8b/L20/h17", "/gemma-4-12b/L33/n12225", "/gemma-4-12b/L28/heads", "/gemma-4-12b/L14/n8313?all", "/about", "/credits", "/no-such-page"];

test("no console errors anywhere on the tour", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(`${page.url()}: ${message.text()}`); });
  page.on("pageerror", (error) => errors.push(`${page.url()}: ${error.message}`));
  for (const path of TOUR) {
    await page.goto(path);
    await settle(page);
  }
  expect(errors).toEqual([]);
});

for (const width of [390, 320]) {
  test(`nothing scrolls sideways at ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    const wide: string[] = [];
    for (const path of TOUR) {
      await page.goto(path);
      await settle(page);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (overflow > 0) wide.push(`${path}: ${overflow} px too wide`);
    }
    expect(wide).toEqual([]);
  });
}
