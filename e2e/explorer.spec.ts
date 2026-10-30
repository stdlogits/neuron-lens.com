import { expect, test, type Page } from "@playwright/test";
import type { CatalogIndex } from "../src/lib/data";
import { fixture, serveCatalog, silentClip } from "./fixtures/catalog.mjs";

// The explorer on the mock catalog (e2e/fixtures). These tests hold the address and the state behind
// it to account, and touch the markup only through roles and names; the atlas, list, search, sound
// tiles and English switch are tested at the bottom.

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await serveCatalog(page);
});

const settle = (page: Page) => page.waitForLoadState("networkidle");
const path = (page: Page) => { const url = new URL(page.url()); return url.pathname + url.search; };

test("the explorer opens on Qwen3-8B with its figures", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "The Atlas" })).toBeVisible();
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

// ---------- the atlas, the list, the search, the sound tiles and the English switch

/** A model's easiest neurons of one layer, in the order the list and the atlas show them. */
const easiest = (index: CatalogIndex, layer: number) => index.neurons.filter((row) => row[0] === layer).sort((a, b) => b[4] - a[4]).map((row) => row[1]);
const atlas = (page: Page) => page.getByRole("slider", { name: "Layer" });
// A bar is an <i> in its layer's column with no role of its own, so it is found by structure: the
// columns run in layer order, each from its most readable unit down. --o is how lit it is (1 is lit).
const bars = (page: Page) => atlas(page).locator(".stack i");
const lit = (page: Page) => bars(page).evaluateAll((list) => list.filter((bar) => Number((bar as HTMLElement).style.getPropertyValue("--o")) === 1).length);
const layerList = (page: Page, layer: number) => page.getByRole("navigation", { name: `Layer ${layer}` });
const listed = (page: Page, layer: number, neuron: number) => layerList(page, layer).getByRole("link", { name: new RegExp(`^n${neuron}\\b`) });
const unitHeading = (page: Page, id: string) => page.getByRole("heading", { level: 2, name: id });

test("clicking a layer in the atlas opens that layer", async ({ page }) => {
  const index = await fixture<CatalogIndex>("gemma-4-12b/index.json");
  const middle = easiest(index, 23);
  // The mock has bars in layers 23 (four) and 33 (one) only: the first four are 23's.
  await page.goto("/gemma-4-12b/L23");
  await expect(atlas(page)).toHaveAttribute("aria-valuenow", "23");
  await expect(atlas(page)).toHaveAttribute("aria-valuemax", String(index.layers - 1));
  await expect(bars(page)).toHaveCount(index.neurons.length);
  await expect(listed(page, 23, middle[0])).toHaveAttribute("aria-current", "true");

  // The foot of a column is the layer, not one of its bars.
  await atlas(page).scrollIntoViewIfNeeded();
  const box = (await atlas(page).boundingBox())!;
  await page.mouse.click(box.x + (33.5 * box.width) / index.layers, box.y + box.height - 2);
  await expect(page).toHaveURL(/\/gemma-4-12b\/L33$/);
  await expect(atlas(page)).toHaveAttribute("aria-valuenow", "33");
  await expect(atlas(page)).toHaveAttribute("aria-valuetext", /^Layer 33, Late layers/);
  await expect(layerList(page, 33).getByRole("heading", { level: 2, name: "Layer 33" })).toBeVisible();
  await expect(listed(page, 33, easiest(index, 33)[0])).toHaveAttribute("aria-current", "true");
  await expect(page).toHaveTitle("Gemma 4 12B · Neuron Lens");

  // A bar is its unit: clicking one opens it, in its own layer.
  const bar = (await bars(page).nth(1).boundingBox())!;
  await page.mouse.click(bar.x + bar.width / 2, bar.y + bar.height / 2);
  await expect(page).toHaveURL(new RegExp(`/gemma-4-12b/L23/n${middle[1]}$`));
  await expect(atlas(page)).toHaveAttribute("aria-valuenow", "23");
  await expect(atlas(page)).toHaveAttribute("aria-valuetext", new RegExp(`^Layer 23, Middle layers, neuron ${middle[1]}$`));
  await expect(unitHeading(page, `L23·n${middle[1]}`)).toBeVisible();
  await expect(listed(page, 23, middle[1])).toHaveAttribute("aria-current", "true");

  // Each choice is a history entry.
  await page.goBack();
  await expect(page).toHaveURL(/\/gemma-4-12b\/L33$/);
  await expect(atlas(page)).toHaveAttribute("aria-valuenow", "33");
});

test("choosing a unit in the layer's list opens it, and the list follows j and k", async ({ page }) => {
  const index = await fixture<CatalogIndex>("qwen3-8b/index.json");
  const order = easiest(index, 8);
  const current = layerList(page, 8).locator('a[aria-current="true"]');
  const at = async (position: number) => {
    await expect(page).toHaveURL(new RegExp(`/qwen3-8b/L8/n${order[position]}$`));
    await expect(listed(page, 8, order[position])).toHaveAttribute("aria-current", "true");
    await expect(current).toHaveCount(1);
    await expect(unitHeading(page, `L8·n${order[position]}`)).toBeVisible();
    await expect(page.getByText(`${position + 1} of ${order.length}`)).toBeAttached();
  };

  // A layer opens on its easiest unit; choosing another opens that one.
  await page.goto("/qwen3-8b/L8");
  await expect(listed(page, 8, order[0])).toHaveAttribute("aria-current", "true");
  await expect(unitHeading(page, `L8·n${order[0]}`)).toBeVisible();
  await expect(layerList(page, 8).getByRole("link")).toHaveCount(order.length);
  await listed(page, 8, order[5]).click();
  await at(5);

  // j and k move the choice down and up the list, and wrap at its ends.
  await page.keyboard.press("j");
  await at(6);
  await page.keyboard.press("j");
  await at(0);
  await page.keyboard.press("k");
  await at(6);
  await page.keyboard.press("k");
  await at(5);

  // The choice was one history entry; stepping with j and k replaced it.
  await page.goBack();
  await expect(page).toHaveURL(/\/qwen3-8b\/L8$/);
  await expect(listed(page, 8, order[0])).toHaveAttribute("aria-current", "true");
});

test("search finds a word, lights its units, and opens one", async ({ page }) => {
  await page.goto("/qwen3-8b");
  const search = page.getByRole("combobox", { name: "Search neurons and heads" });
  const matches = page.getByRole("listbox", { name: "Matches" });
  await expect(listed(page, 8, 6321)).toBeVisible();
  expect(await lit(page)).toBe(0);

  // "/" finds the field. "owl" is the word of n344 and, as a stem, in n1165's "knowledge".
  await page.keyboard.press("/");
  await expect(search).toBeFocused();
  await page.keyboard.type("owl");
  await expect(search).toHaveAttribute("aria-expanded", "true");
  await expect(matches.getByRole("option")).toHaveCount(2);
  await expect(matches.getByRole("option", { name: /^L8·n344 plus side the word 'owl'/ })).toHaveAttribute("aria-selected", "true");
  await expect(matches.getByRole("option", { name: /^L8·n1165 minus side/ })).toHaveAttribute("aria-selected", "false");
  await expect(page.getByText("2 matches.")).toBeAttached();

  // Those two units light on the atlas and are marked in the list; the others are not.
  await expect.poll(() => lit(page)).toBe(2);
  await expect(listed(page, 8, 344)).toHaveAccessibleName(/, matches the search/);
  await expect(listed(page, 8, 1165)).toHaveAccessibleName(/, matches the search/);
  await expect(listed(page, 8, 6321)).not.toHaveAccessibleName(/matches the search/);
  await expect(layerList(page, 8).getByRole("link", { name: /matches the search/ })).toHaveCount(2);

  // Choosing a match opens it, closes the results, and keeps the lights while the query stands.
  await matches.getByRole("option", { name: /^L8·n1165/ }).click();
  await expect(page).toHaveURL(/\/qwen3-8b\/L8\/n1165$/);
  await expect(unitHeading(page, "L8·n1165")).toBeVisible();
  await expect(search).toHaveAttribute("aria-expanded", "false");
  await expect(matches).toHaveCount(0);
  await expect(search).toHaveValue("owl");
  await expect(listed(page, 8, 1165)).toHaveAttribute("aria-current", "true");
  expect(await lit(page)).toBe(2);

  // Clearing it puts the map back.
  await page.getByRole("button", { name: "Clear the search" }).click();
  await expect(search).toHaveValue("");
  await expect.poll(() => lit(page)).toBe(0);
  await expect(layerList(page, 8).getByRole("link", { name: /matches the search/ })).toHaveCount(0);

  // A word nothing has says so; a word that names a head opens it, in its own layer.
  await search.fill("zzyzx");
  await expect(page.getByText("No match. Try another word")).toBeVisible();
  await search.fill("she");
  await matches.getByRole("option", { name: /^L20·h17/ }).click();
  await expect(page).toHaveURL(/\/qwen3-8b\/L20\/h17$/);
  await expect(page.getByRole("group", { name: "Units" }).getByRole("button", { name: "Heads" })).toHaveAttribute("aria-pressed", "true");
  await expect(atlas(page)).toHaveAttribute("aria-valuenow", "20");
});

test("the Easiest and All tabs switch the list and the address", async ({ page }) => {
  // Layer 33 of the mock lists one neuron among its easiest and three in all.
  const index = await fixture<CatalogIndex>("gemma-4-12b/index.json");
  const layerRows = await fixture<{ neurons: [number, ...unknown[]][] }>("gemma-4-12b/neurons/L33/index.json");
  const [first] = easiest(index, 33);
  const everyone = layerRows.neurons.map((row) => row[0]);
  expect(everyone).toContain(first);
  expect(everyone.length).toBeGreaterThan(1);
  const others = everyone.filter((n) => n !== first);

  await page.goto("/gemma-4-12b/L33");
  const scope = page.getByRole("group", { name: "Which units" });
  const links = layerList(page, 33).getByRole("link");
  await expect(scope.getByRole("button", { name: /^Easiest/ })).toHaveAttribute("aria-pressed", "true");
  await expect(scope.getByRole("button", { name: /^All/ })).toHaveAttribute("aria-pressed", "false");
  await expect(links).toHaveCount(1);
  await expect(listed(page, 33, first)).toBeVisible();

  // All lists every neuron of the layer, and puts ?all in the address.
  await scope.getByRole("button", { name: /^All/ }).click();
  await expect(page).toHaveURL(/\/gemma-4-12b\/L33\?all$/);
  await expect(scope.getByRole("button", { name: /^All/ })).toHaveAttribute("aria-pressed", "true");
  await expect(scope.getByRole("button", { name: /^Easiest/ })).toHaveAttribute("aria-pressed", "false");
  await expect(links).toHaveCount(everyone.length);
  for (const n of everyone) await expect(listed(page, 33, n)).toBeVisible();

  // A neuron chosen there keeps ?all; going back to Easiest drops the list's extras and the neuron.
  await listed(page, 33, others[0]).click();
  await expect(page).toHaveURL(new RegExp(`/gemma-4-12b/L33/n${others[0]}\\?all$`));
  await expect(unitHeading(page, `L33·n${others[0]}`)).toBeVisible();
  await scope.getByRole("button", { name: /^Easiest/ }).click();
  await expect(page).toHaveURL(/\/gemma-4-12b\/L33$/);
  await expect(links).toHaveCount(1);
  await expect(listed(page, 33, first)).toHaveAttribute("aria-current", "true");
  await expect(scope.getByRole("button", { name: /^Easiest/ })).toHaveAttribute("aria-pressed", "true");

  // Both are history entries.
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/gemma-4-12b/L33/n${others[0]}\\?all$`));
  await expect(links).toHaveCount(everyone.length);
});

test("a sound tile plays its clip, and only one plays at a time", async ({ page }) => {
  // The mock's sounds are synthetic: two silent MP3 frames, about 50 ms, over before anything could
  // see one playing. Serve three seconds of the same silence for every range of the pack instead
  // (each tile still keys its clip by its own offset, so each gets a clip of its own).
  const silence = silentClip(3);
  await page.route("**/data/gemma-4-12b/media/audio/*.bin", (route) => route.fulfill({
    status: 206,
    contentType: "application/octet-stream",
    headers: { "content-range": `bytes 0-${silence.length - 1}/${silence.length}`, "accept-ranges": "bytes" },
    body: silence,
  }));
  // The audio elements the page has started, to read what they are doing.
  await page.addInitScript(() => {
    const started: HTMLMediaElement[] = [];
    Object.assign(window, { started });
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) { started.push(this); return play.call(this); };
  });
  const clips = () => page.evaluate(() => (window as unknown as { started: HTMLMediaElement[] }).started.map((audio) => ({ playing: !audio.paused && !audio.ended, time: audio.currentTime })));

  await page.goto("/gemma-4-12b/L23/n9658");
  const tiles = page.getByRole("list", { name: "The sounds it fires on most" }).getByRole("button");
  await expect(tiles).toHaveCount(3);
  for (let i = 0; i < 3; i += 1) await expect(tiles.nth(i)).toBeEnabled();
  const [one, two] = [tiles.nth(0), tiles.nth(1)];
  await expect(one).toHaveAttribute("aria-pressed", "false");
  await expect(one).toHaveAccessibleName(/^Play German, Multilingual LibriSpeech/);
  await expect(two).toHaveAccessibleName(/^Play accent Romanian, EdAcc/);
  expect(await clips()).toEqual([]);

  // A tile plays its clip: pressed, labelled Stop, and its audio is running.
  await one.click();
  await expect(one).toHaveAttribute("aria-pressed", "true");
  await expect(one).toHaveAccessibleName(/^Stop German, Multilingual LibriSpeech/);
  await expect.poll(async () => (await clips()).map((clip) => clip.playing)).toEqual([true]);
  await expect.poll(async () => (await clips())[0].time).toBeGreaterThan(0);

  // Starting another stops the first.
  await two.click();
  await expect(two).toHaveAttribute("aria-pressed", "true");
  await expect(two).toHaveAccessibleName(/^Stop accent Romanian, EdAcc/);
  await expect(one).toHaveAttribute("aria-pressed", "false");
  await expect(one).toHaveAccessibleName(/^Play German/);
  await expect(page.getByRole("list", { name: "The sounds it fires on most" }).getByRole("button", { pressed: true })).toHaveCount(1);
  await expect.poll(async () => (await clips()).map((clip) => clip.playing)).toEqual([false, true]);

  // Pressing the playing one stops it.
  await two.click();
  await expect(two).toHaveAttribute("aria-pressed", "false");
  await expect(two).toHaveAccessibleName(/^Play accent Romanian/);
  await expect.poll(async () => (await clips()).map((clip) => clip.playing)).toEqual([false, false]);
});

test("Translate to English swaps tokens, labels and examples", async ({ page }) => {
  // Qwen's n6321 fires on 罚款 (fines): the mock's terms.json and its contexts carry Haiku's English.
  await page.goto("/qwen3-8b/L8/n6321");
  const english = page.getByRole("switch", { name: "English" });
  const side = page.getByRole("tab", { name: /^Positive side/ });
  const item = listed(page, 8, 6321);
  const token = page.getByRole("button", { name: /^罚款 \(two reads agree\) 8\.0$/ });
  const translated = page.getByRole("button", { name: /^fine \(two reads agree, translated from 罚款\) 8\.0$/ });
  const original = page.getByText("燒烤場）亂拋垃圾可被罰");
  const inEnglish = page.getByText("barbecue area) littering can be fined");
  const language = page.getByRole("button", { name: /^Chinese\b/ });

  // Off: the source language everywhere.
  await expect(english).toHaveAttribute("aria-checked", "false");
  await expect(token).toBeVisible();
  await expect(original).toBeVisible();
  await expect(side).toContainText("罚款");
  await expect(item).toContainText("罚款");
  await expect(translated).toHaveCount(0);
  await expect(inEnglish).toHaveCount(0);
  await expect(language).toHaveCount(0);

  // On: the token, the label (in the unit's table and in the list), and the examples are in English.
  await english.click();
  await expect(english).toHaveAttribute("aria-checked", "true");
  await expect(translated).toBeVisible();
  await expect(token).toHaveCount(0);
  await expect(side).toHaveAccessibleName(/fine \(translated from 罚款\)/);
  await expect(item).toHaveAccessibleName(/fine \(translated from 罚款\)/);
  await expect(inEnglish).toBeVisible();
  // An example in English says what it was written in, and keeps the original in that button's name.
  await expect(language.first()).toBeVisible();
  await expect(language.first()).toHaveAccessibleName(/Original: .*燒烤場/);
  // The address is unchanged: the switch is the viewer's, not the page's.
  expect(path(page)).toBe("/qwen3-8b/L8/n6321");

  // The choice is remembered for the viewer.
  await page.reload();
  await expect(english).toHaveAttribute("aria-checked", "true");
  await expect(translated).toBeVisible();
  await expect(inEnglish).toBeVisible();

  // Off again: back to the original.
  await english.click();
  await expect(english).toHaveAttribute("aria-checked", "false");
  await expect(token).toBeVisible();
  await expect(original).toBeVisible();
  await expect(translated).toHaveCount(0);
  await expect(language).toHaveCount(0);
});
