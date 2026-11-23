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

// The missing page shows what is wrong with the address (lib/missing.ts), each kind landed (reduced motion), and offers
// the way back: the same place clipped to the model's shape, or the nearest real address.
for (const [path, heading, way, to] of [
  ["/no-such-page", "Nothing fires here", "Open the explorer", "/"],
  ["/abuot", "Nothing fires here", "Did you mean About?", "/about"],
  ["/qwen-8b/L8/n344", "Did you mean Qwen3-8B?", "Open L8·n344", "/qwen3-8b/L8/n344"],
  ["/Gemma-4-12B/L14/n8313", "Did you mean Gemma 4 12B?", "Open L14·n8313", "/gemma-4-12b/L14/n8313"],
  ["/qwen3-8b/L99", "There is no layer 99", "Open layer 35", "/qwen3-8b/L35"],
  ["/qwen3-8b/L52/n344", "There is no layer 52", "Open L35·n344", "/qwen3-8b/L35/n344"],
  ["/gemma-4-12b/L8/n99999", "There is no neuron 99,999", "Open L8·n15359", "/gemma-4-12b/L8/n15359"],
  ["/qwen3-8b/L20/h40", "There is no head 40", "Open L20·h31", "/qwen3-8b/L20/h31"],
] as const) {
  test(`the missing page says what is wrong with ${path}`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator("main h1")).toHaveText(heading);
    await expect(page.getByRole("navigation", { name: "Ways back" }).getByRole("link", { name: way, exact: true })).toHaveAttribute("href", to);
  });
}

test("a missing page's way back opens the place", async ({ page }) => {
  await page.goto("/qwen3-8b/L52/n344");
  await page.getByRole("navigation", { name: "Ways back" }).getByRole("link", { name: "Open L35·n344", exact: true }).click();
  // A neuron outside the easiest opens with every neuron of its layer listed (?all).
  await expect(page).toHaveURL(/\/qwen3-8b\/L35\/n344(\?all)?$/);
  await expect(explorerTitle(page)).toBeVisible();
});

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

// With a light system: auto first, then dark, light (stored, though the same look) and auto again.
test("the theme steps through dark, light and auto", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/about");
  const button = page.getByRole("navigation", { name: "Site" }).locator("button.theme");
  const root = page.locator("html");
  const stored = () => page.evaluate(() => localStorage.getItem("neuron-lens.theme"));
  await expect(button).toHaveAccessibleName("Use the dark theme");
  await button.click();
  await expect(root).toHaveAttribute("data-theme", "dark");
  expect(await stored()).toBe("dark");
  await expect(button).toHaveAccessibleName("Use the light theme");
  await button.click();
  await expect(root).toHaveAttribute("data-theme", "light");
  expect(await stored()).toBe("light");
  await expect(button).toHaveAccessibleName("Follow the system's theme");
  await button.click();
  await expect(root).not.toHaveAttribute("data-theme");
  expect(await stored()).toBeNull();
  await expect(button).toHaveAccessibleName("Use the dark theme");
  // Auto follows the system as it changes.
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(button).toHaveAccessibleName("Use the light theme");
  await page.reload();
  await expect(root).not.toHaveAttribute("data-theme");
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe("rgb(11, 13, 18)");
});

// Ledger's theme-preflight.js applies a stored choice before first paint, under the key index.html
// gives it; the theme button reads the same key.
test("a stored theme applies on load", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.addInitScript(() => localStorage.setItem("neuron-lens.theme", "dark"));
  await page.goto("/about");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe("rgb(11, 13, 18)");
  await expect(page.getByRole("navigation", { name: "Site" }).locator("button.theme")).toHaveAccessibleName("Use the light theme");
});

// A unit's address with ?card is its link card alone: the page a hosted browser photographs (scripts/site/unfurl.js).
// (A neuron's: the mock keeps too few heads for the atlas to draw them, and a card waits for its atlas.)
test("a unit's address with ?card draws its link card and nothing else", async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 630 });
  await page.goto("/qwen3-8b/L8/n344?all&card");
  const card = page.locator('[data-card="drawn"]');
  await expect(card).toBeVisible();
  await expect(card).toContainText("Qwen3-8B");
  await expect(card).toContainText("Neuron Lens");
  await expect(page.getByRole("navigation", { name: "Site" })).toHaveCount(0);
  await expect(page.locator('meta[name="robots"][content="noindex"]')).toHaveCount(1);
  expect(new URL(page.url()).search).toBe("?all&card");
});

test("with ?card=circuit a unit's address draws the card of its connections", async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 630 });
  await page.goto("/qwen3-8b/L8/n344?card=circuit");
  const card = page.locator('[data-card="drawn"]');
  await expect(card).toBeVisible();
  await expect(card.getByRole("complementary", { name: "Connections" })).toBeAttached();
  await expect(card.getByRole("heading", { name: "Driven by" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Site" })).toHaveCount(0);
  expect(new URL(page.url()).search).toBe("?card=circuit");
});

// The missing page once for each thing an address can get wrong: a page, a model, a layer, a neuron, a head.
const TOUR = ["/","/gemma-4-12b", "/qwen3-8b/L8/n344", "/qwen3-8b/L20/h17", "/gemma-4-12b/L33/n12225", "/gemma-4-12b/L28/heads", "/gemma-4-12b/L14/n8313?all", "/about", "/credits", "/no-such-page", "/qwen-8b/L8/n344", "/qwen3-8b/L99/n344", "/gemma-4-12b/L8/n99999", "/qwen3-8b/L20/h40"];

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
