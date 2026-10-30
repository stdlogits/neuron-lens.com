import { expect, test, type Page } from "@playwright/test";
import type { CatalogIndex } from "../src/lib/data";
import { fixture, serveCatalog } from "./fixtures/catalog.mjs";

// The explorer on the mock catalog (e2e/fixtures). These tests hold the address and the state behind
// it to account, and touch the markup only through roles and names that the shell owns; the atlas,
// list and unit view are tested at the bottom, or are TODO until they settle.

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await serveCatalog(page);
});

const settle = (page: Page) => page.waitForLoadState("networkidle");
const path = (page: Page) => { const url = new URL(page.url()); return url.pathname + url.search; };

test("the explorer opens on Qwen3-8B with its figures", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Neuron Lens" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Model" }).getByRole("button", { name: "Qwen3-8B" })).toHaveAttribute("aria-pressed", "true");
  // 36 layers of 12,288 neurons and 32 heads.
  const main = page.locator("main");
  await expect(main).toContainText("442,368");
  await expect(main).toContainText("1,152");
  await expect(page).toHaveTitle("Neuron Lens");
  expect(path(page)).toBe("/");
});

test("switching model changes the address, the figures and the title", async ({ page }) => {
  await page.goto("/");
  const models = page.getByRole("group", { name: "Model" });
  await models.getByRole("button", { name: "Gemma 4 12B" }).click();
  await expect(page).toHaveURL(/\/gemma-4-12b$/);
  await expect(models.getByRole("button", { name: "Gemma 4 12B" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("main")).toContainText("737,280");
  await expect(page).toHaveTitle("Gemma 4 12B · Neuron Lens");

  await models.getByRole("button", { name: "Qwen3-8B" }).click();
  await expect(page).toHaveURL(/127\.0\.0\.1:\d+\/$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/gemma-4-12b$/);
});

test("a deep link loads that neuron", async ({ page }) => {
  const chunk = page.waitForRequest((request) => request.url().endsWith("/data/qwen3-8b/neurons/L08/c001.json"));
  await page.goto("/qwen3-8b/L8/n344");
  await chunk;
  await expect(page).toHaveTitle("L8·n344 · Qwen3-8B · Neuron Lens");
  await settle(page);
  expect(path(page)).toBe("/qwen3-8b/L8/n344");
});

test("a deep link loads that head", async ({ page }) => {
  const layer = page.waitForRequest((request) => request.url().endsWith("/data/qwen3-8b/heads/L20.json"));
  await page.goto("/qwen3-8b/L20/h17");
  await layer;
  await expect(page).toHaveTitle("L20·h17 · Qwen3-8B · Neuron Lens");
  await expect(page.getByRole("group", { name: "Units" }).getByRole("button", { name: "Heads" })).toHaveAttribute("aria-pressed", "true");
  expect(path(page)).toBe("/qwen3-8b/L20/h17");
});

test("a neuron outside the layer's easiest opens with every neuron listed", async ({ page }) => {
  const rows = page.waitForRequest((request) => request.url().endsWith("/data/gemma-4-12b/neurons/L14/index.json"));
  await page.goto("/gemma-4-12b/L14/n8313");
  await rows;
  await expect(page).toHaveURL(/\/gemma-4-12b\/L14\/n8313\?all$/);
  await expect(page).toHaveTitle("L14·n8313 · Gemma 4 12B · Neuron Lens");
});

test.describe("drowse.ai's old links become paths", () => {
  for (const [from, to] of [
    ["/?model=gemma-4-12b&layer=14&neuron=8313", /\/gemma-4-12b\/L14\/n8313(\?all)?$/],
    ["/neuron-lens?layer=8&neuron=344", /\/qwen3-8b\/L8\/n344$/],
    ["/neurons?layer=20&head=17", /\/qwen3-8b\/L20\/h17$/],
    ["/neuron-lens?model=gemma-4-12b&unit=heads", /\/gemma-4-12b\/heads$/],
    ["/neuron-lens?model=gemma-4-12b&layer=33&all=1", /\/gemma-4-12b\/L33\?all$/],
    ["/neuron-lens", /127\.0\.0\.1:\d+\/$/],
  ] as const) {
    test(from, async ({ page }) => {
      await page.goto(from);
      await expect(page).toHaveURL(to);
      await expect(page.getByRole("group", { name: "Model" })).toBeVisible();
    });
  }
});

test("j and k step through the layer's list, wrapping", async ({ page }) => {
  const index = await fixture<CatalogIndex>("qwen3-8b/index.json");
  const order = index.neurons.filter((row) => row[0] === 8).sort((a, b) => b[4] - a[4]).map((row) => row[1]);
  await page.goto(`/qwen3-8b/L8/n${order[0]}`);
  await settle(page);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press("j");
  await expect(page).toHaveURL(new RegExp(`/qwen3-8b/L8/n${order[1]}$`));
  await page.keyboard.press("k");
  await expect(page).toHaveURL(new RegExp(`/qwen3-8b/L8/n${order[0]}$`));
  await page.keyboard.press("k");
  await expect(page).toHaveURL(new RegExp(`/qwen3-8b/L8/n${order.at(-1)}$`));
});

test("a Gemma neuron shows its images from the media pack", async ({ page }) => {
  await page.goto("/gemma-4-12b/L33/n12225");
  await expect.poll(
    () => page.locator('img[src^="blob:"]').evaluateAll((images) => images.filter((img) => (img as HTMLImageElement).naturalWidth > 0).length),
    { timeout: 15_000 },
  ).toBeGreaterThan(0);
});

// TODO(explorer): once the atlas, list and unit view settle, test them through the page:
test.fixme("clicking a layer in the atlas opens that layer", async () => {});
test.fixme("choosing a unit in the layer's list opens it, and the list follows j and k", async () => {});
test.fixme("search finds a word, lights its units, and opens one", async () => {});
test.fixme("the Easiest and All tabs switch the list and the address", async () => {});
test.fixme("a sound tile plays its clip, and only one plays at a time", async () => {});
test.fixme("Translate to English swaps tokens, labels and examples", async () => {});
