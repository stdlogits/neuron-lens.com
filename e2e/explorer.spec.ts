import { expect, test, type Page } from "@playwright/test";
import type { CatalogIndex } from "../src/lib/data";
import { fixture, serveCatalog, silentClip } from "./fixtures/catalog.mjs";

// The explorer on the mock catalog (e2e/fixtures). These tests hold the address and the state behind
// it to account, and touch the markup only through roles and names; the atlas, search, connections,
// baskets, sound tiles and the Distinctive and English switches are tested at the bottom.

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await serveCatalog(page);
});

const settle = (page: Page) => page.waitForLoadState("networkidle");
const path = (page: Page) => { const url = new URL(page.url()); return url.pathname + url.search; };

test("the explorer opens on Qwen3-8B with its figures", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Explorer" })).toBeVisible();
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
  const record = page.waitForRequest((request) => request.url().endsWith("/data/qwen3-8b/neurons/L08/graph.bin"));
  await page.goto("/qwen3-8b/L8/n344");
  await record;
  await expect(page).toHaveTitle("L8·n344 · Qwen3-8B · Neuron Lens");
  await settle(page);
  expect(path(page)).toBe("/qwen3-8b/L8/n344");
});

test("a unit's connections open full screen at ?graph and close back to its page", async ({ page }) => {
  await page.goto("/qwen3-8b/L8/n344");
  await page.getByRole("button", { name: "Full screen, with every title" }).click();
  await expect(page).toHaveURL(/\/qwen3-8b\/L8\/n344\?graph$/);
  const navigator = page.getByRole("dialog", { name: /^Connections of L8·n344/ });
  await expect(navigator).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(navigator).toHaveCount(0);
  expect(path(page)).toBe("/qwen3-8b/L8/n344");

  // A deep link opens it directly, and the canonical address leaves it out.
  await page.goto("/qwen3-8b/L8/n344?graph");
  await expect(navigator).toBeVisible();
  await expect(page.locator("link[rel=canonical]")).toHaveAttribute("href", /\/qwen3-8b\/L8\/n344$/);
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
  const index = await fixture<CatalogIndex>("gemma-4-12b/index.json");
  const layerRows = await fixture<{ neurons: number[][] }>("gemma-4-12b/neurons/L14/index.json");
  const outside = layerRows.neurons.map((row) => row[0]).find((neuron) => !easiest(index, 14).includes(neuron))!;
  const rows = page.waitForRequest((request) => request.url().endsWith("/data/gemma-4-12b/neurons/L14/index.json"));
  await page.goto(`/gemma-4-12b/L14/n${outside}`);
  await rows;
  await expect(page).toHaveURL(new RegExp(`/gemma-4-12b/L14/n${outside}\\?all$`));
  await expect(page).toHaveTitle(`L14·n${outside} · Gemma 4 12B · Neuron Lens`);
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

// ---------- the atlas, the search, the connections, the baskets, the sound tiles and the switches

/** A model's easiest neurons of one layer, in the order the atlas shows them and j and k step through them. */
const easiest = (index: CatalogIndex, layer: number) => index.neurons.filter((row) => row[0] === layer).sort((a, b) => b[4] - a[4]).map((row) => row[1]);
const atlas = (page: Page) => page.getByRole("slider", { name: "Layer" });
// A bar is an <i> in its layer's column with no role of its own, so it is found by structure: the
// columns run in layer order, each from the labeller's surest unit down. --o is how lit it is (1 is lit).
const bars = (page: Page) => atlas(page).locator(".stack i");
const lit = (page: Page) => bars(page).evaluateAll((list) => list.filter((bar) => Number((bar as HTMLElement).style.getPropertyValue("--o")) === 1).length);
const place = (page: Page, at: number, of: number) => page.getByText(`${at} of ${of}`, { exact: true });
const unitHeading = (page: Page, id: string) => page.getByRole("heading", { level: 2, name: id });

test("clicking a layer in the atlas opens that layer", async ({ page }) => {
  const index = await fixture<CatalogIndex>("gemma-4-12b/index.json");
  const middle = easiest(index, 23);
  // The mock has bars in layers 23 (four) and 33 (one) only: the first four are 23's.
  await page.goto("/gemma-4-12b/L23");
  await expect(atlas(page)).toHaveAttribute("aria-valuenow", "23");
  await expect(atlas(page)).toHaveAttribute("aria-valuemax", String(index.layers - 1));
  await expect(bars(page)).toHaveCount(index.neurons.length);
  await expect(unitHeading(page, `L23·n${middle[0]}`)).toBeVisible();

  // The foot of a column is the layer, not one of its bars.
  await atlas(page).scrollIntoViewIfNeeded();
  const box = (await atlas(page).boundingBox())!;
  await page.mouse.click(box.x + (33.5 * box.width) / index.layers, box.y + box.height - 2);
  await expect(page).toHaveURL(/\/gemma-4-12b\/L33$/);
  await expect(atlas(page)).toHaveAttribute("aria-valuenow", "33");
  await expect(atlas(page)).toHaveAttribute("aria-valuetext", /^Layer 33, Late layers/);
  await expect(unitHeading(page, `L33·n${easiest(index, 33)[0]}`)).toBeVisible();
  await expect(page).toHaveTitle("Gemma 4 12B · Neuron Lens");

  // A bar is its unit: clicking one opens it, in its own layer.
  const bar = (await bars(page).nth(index.neurons.filter((row) => row[0] < 23).length + 1).boundingBox())!;
  await page.mouse.click(bar.x + bar.width / 2, bar.y + bar.height / 2);
  await expect(page).toHaveURL(new RegExp(`/gemma-4-12b/L23/n${middle[1]}$`));
  await expect(atlas(page)).toHaveAttribute("aria-valuenow", "23");
  await expect(atlas(page)).toHaveAttribute("aria-valuetext", new RegExp(`^Layer 23, Late layers, neuron ${middle[1]}$`));
  await expect(unitHeading(page, `L23·n${middle[1]}`)).toBeVisible();

  // Each choice is a history entry.
  await page.goBack();
  await expect(page).toHaveURL(/\/gemma-4-12b\/L33$/);
  await expect(atlas(page)).toHaveAttribute("aria-valuenow", "33");
});

test("choosing a bar opens that unit, and j and k step on from it", async ({ page }) => {
  const index = await fixture<CatalogIndex>("qwen3-8b/index.json");
  const order = easiest(index, 8);
  const at = async (position: number) => {
    await expect(page).toHaveURL(new RegExp(`/qwen3-8b/L8/n${order[position]}$`));
    await expect(unitHeading(page, `L8·n${order[position]}`)).toBeVisible();
    await expect(place(page, position + 1, order.length)).toBeAttached();
  };

  // A layer opens on its easiest unit; choosing another opens that one.
  await page.goto("/qwen3-8b/L8");
  await expect(unitHeading(page, `L8·n${order[0]}`)).toBeVisible();
  await expect(bars(page)).toHaveCount(order.length);
  await atlas(page).scrollIntoViewIfNeeded();
  const last = order.length - 1;
  const bar = (await bars(page).nth(last - 1).boundingBox())!;
  await page.mouse.click(bar.x + bar.width / 2, bar.y + bar.height / 2);
  await at(last - 1);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());

  // j and k move the choice down and up the list, and wrap at its ends.
  await page.keyboard.press("j");
  await at(last);
  await page.keyboard.press("j");
  await at(0);
  await page.keyboard.press("k");
  await at(last);
  await page.keyboard.press("k");
  await at(last - 1);

  // The choice was one history entry; stepping with j and k replaced it.
  await page.goBack();
  await expect(page).toHaveURL(/\/qwen3-8b\/L8$/);
  await expect(unitHeading(page, `L8·n${order[0]}`)).toBeVisible();
});

test("search finds a word, lights its units, and opens one", async ({ page }) => {
  await page.goto("/qwen3-8b");
  const search = page.getByRole("combobox", { name: "Search neurons and heads" });
  const matches = page.getByRole("listbox", { name: "Matches" });
  await expect(bars(page).first()).toBeAttached();
  expect(await lit(page)).toBe(0);

  // "/" finds the field. "miami" is in two units' reads, n3908's more strongly than n6321's.
  await page.keyboard.press("/");
  await expect(search).toBeFocused();
  await page.keyboard.type("miami");
  await expect(search).toHaveAttribute("aria-expanded", "true");
  await expect(matches.getByRole("option")).toHaveCount(2);
  await expect(matches.getByRole("option", { name: /^L8·n3908 minus side/ })).toHaveAttribute("aria-selected", "true");
  await expect(matches.getByRole("option", { name: /^L8·n6321 minus side/ })).toHaveAttribute("aria-selected", "false");
  await expect(page.getByText("2 matches.")).toBeAttached();

  // Those two units light on the atlas; the others don't.
  await expect.poll(() => lit(page)).toBe(2);

  // Choosing a match opens it, closes the results, and keeps the lights while the query stands.
  await matches.getByRole("option", { name: /^L8·n6321/ }).click();
  await expect(page).toHaveURL(/\/qwen3-8b\/L8\/n6321$/);
  await expect(unitHeading(page, "L8·n6321")).toBeVisible();
  await expect(search).toHaveAttribute("aria-expanded", "false");
  await expect(matches).toHaveCount(0);
  await expect(search).toHaveValue("miami");
  expect(await lit(page)).toBe(2);

  // Clearing it puts the map back.
  await page.getByRole("button", { name: "Clear the search" }).click();
  await expect(search).toHaveValue("");
  await expect.poll(() => lit(page)).toBe(0);

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
  const layerRows = await fixture<{ neurons: number[][] }>("gemma-4-12b/neurons/L33/index.json");
  const [first] = easiest(index, 33);
  const everyone = [...layerRows.neurons].sort((a, b) => b[3] - a[3]).map((row) => row[0]);
  expect(everyone).toContain(first);
  expect(everyone.length).toBeGreaterThan(1);

  await page.goto("/gemma-4-12b/L33");
  const scope = page.getByRole("group", { name: "Which units" });
  await expect(scope.getByRole("button", { name: /^Easiest/ })).toHaveAttribute("aria-pressed", "true");
  await expect(scope.getByRole("button", { name: /^All/ })).toHaveAttribute("aria-pressed", "false");
  await expect(place(page, 1, 1)).toBeAttached();
  await expect(unitHeading(page, `L33·n${first}`)).toBeVisible();

  // All steps through every neuron of the layer, and puts ?all in the address.
  await scope.getByRole("button", { name: /^All/ }).click();
  await expect(page).toHaveURL(/\/gemma-4-12b\/L33\?all$/);
  await expect(scope.getByRole("button", { name: /^All/ })).toHaveAttribute("aria-pressed", "true");
  await expect(scope.getByRole("button", { name: /^Easiest/ })).toHaveAttribute("aria-pressed", "false");
  await expect(place(page, 1, everyone.length)).toBeAttached();

  // A neuron stepped to there keeps ?all; going back to Easiest drops the list's extras and the neuron.
  await page.keyboard.press("j");
  await expect(page).toHaveURL(new RegExp(`/gemma-4-12b/L33/n${everyone[1]}\\?all$`));
  await expect(unitHeading(page, `L33·n${everyone[1]}`)).toBeVisible();
  await scope.getByRole("button", { name: /^Easiest/ }).click();
  await expect(page).toHaveURL(/\/gemma-4-12b\/L33$/);
  await expect(place(page, 1, 1)).toBeAttached();
  await expect(scope.getByRole("button", { name: /^Easiest/ })).toHaveAttribute("aria-pressed", "true");

  // Both are history entries.
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/gemma-4-12b/L33/n${everyone[1]}\\?all$`));
  await expect(place(page, 2, everyone.length)).toBeAttached();
});

test("the rail draws a unit's connections, in three views", async ({ page }) => {
  await page.goto("/qwen3-8b/L8/n344");
  const rail = page.getByRole("complementary", { name: "Connections" });
  const views = rail.getByRole("group", { name: "Which connections" });
  await expect(views.getByRole("button", { name: "In context" })).toHaveAttribute("aria-pressed", "true");
  await expect(rail.getByRole("link", { name: /^L8·n344 [+−]/ })).toBeAttached();
  await expect(rail.getByRole("heading", { name: "Driven by" })).toBeVisible();
  await expect(rail.getByRole("heading", { name: "Drives" })).toBeVisible();

  await views.getByRole("button", { name: "In the weights" }).click();
  await expect(rail.getByRole("heading", { name: "Wired from" })).toBeVisible();
  await expect(rail.getByRole("heading", { name: "Wired to" })).toBeVisible();

  await views.getByRole("button", { name: "Fires with" }).click();
  await expect(rail.getByRole("heading", { name: "Fires with" })).toBeVisible();
  await expect(rail.getByRole("heading", { name: "Wired from" })).toHaveCount(0);

  // A row is a link to that unit.
  const row = rail.getByRole("heading", { name: "Fires with" }).locator("..").getByRole("link").first();
  const href = (await row.getAttribute("href"))!;
  await row.click();
  // A neuron outside its layer's easiest opens with every neuron listed.
  await expect(page).toHaveURL(new RegExp(`${href.replace("?all", "")}(\\?all)?$`));
});

test("a head's rail splits what drives it over its three inputs", async ({ page }) => {
  await page.goto("/qwen3-8b/L20/h17");
  const rail = page.getByRole("complementary", { name: "Connections" });
  const views = rail.getByRole("group", { name: "Which connections" });
  await expect(views.getByRole("button", { name: "Value" })).toHaveAttribute("aria-pressed", "true");
  await expect(views.getByRole("button", { name: "In the weights" })).toHaveCount(0);
  const drivenBy = rail.getByRole("heading", { name: "Driven by" }).locator("..").getByRole("link");
  await expect(rail.getByRole("heading", { name: "Drives" })).toBeVisible();
  await expect(drivenBy.first()).toBeVisible();
  const value = await drivenBy.allTextContents();

  await views.getByRole("button", { name: "Query" }).click();
  await expect(views.getByRole("button", { name: "Query" })).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => drivenBy.allTextContents()).not.toEqual(value);

  await views.getByRole("button", { name: "Fires with" }).click();
  await expect(rail.getByRole("heading", { name: "Fires with" })).toBeVisible();
  await expect(rail.getByRole("heading", { name: "Driven by" })).toHaveCount(0);
});

test("the baskets sort a neuron's evidence and take you to each", async ({ page }) => {
  await page.goto("/qwen3-8b/L8/n344");
  const baskets = page.getByRole("navigation", { name: "Baskets" });
  await expect(baskets.getByRole("button", { name: "Firings" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#firings")).toContainText(/The model (distinctively )?says next/);
  await expect(page.locator("#stream")).not.toContainText(/The model (distinctively )?says next/);

  await baskets.getByRole("button", { name: "Stream" }).click();
  await expect(baskets.getByRole("button", { name: "Stream" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#stream")).toBeInViewport();
});

test("the baskets sort a head's evidence the same way", async ({ page }) => {
  await page.goto("/qwen3-8b/L20/h17");
  const baskets = page.getByRole("navigation", { name: "Baskets" });
  await expect(baskets.getByRole("button", { name: "Firings" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#firings")).toContainText("Looked at");
  await expect(page.locator("#firings")).toContainText("How often");
  await expect(page.locator("#weights")).toContainText("How it attends");
  await expect(page.locator("#weights")).not.toContainText("In real text");
  await expect(page.locator("#stream")).toContainText("Pushes the model to say");

  await baskets.getByRole("button", { name: "Weights" }).click();
  await expect(baskets.getByRole("button", { name: "Weights" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#weights")).toBeInViewport();
});

test("Distinctive swaps each read for its version against the layer, and is remembered", async ({ page }) => {
  await page.goto("/qwen3-8b/L8/n344");
  const distinctive = page.getByRole("switch", { name: "Distinctive" });
  const weights = page.locator("#weights");
  await expect(distinctive).toHaveAttribute("aria-checked", "false");
  await expect(weights.getByText("Ideas that trigger it", { exact: true })).toBeAttached();

  await distinctive.click();
  await expect(distinctive).toHaveAttribute("aria-checked", "true");
  await expect(weights.getByText("Distinctive ideas that trigger it", { exact: true })).toBeAttached();
  await expect(weights.getByText("Ideas that trigger it", { exact: true })).toHaveCount(0);

  await page.reload();
  await expect(distinctive).toHaveAttribute("aria-checked", "true");
  await expect(weights.getByText("Distinctive ideas that trigger it", { exact: true })).toBeAttached();
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
  await expect(tiles.nth(1)).toBeEnabled();
  const [one, two] = [tiles.nth(0), tiles.nth(1)];
  await expect(one).toHaveAttribute("aria-pressed", "false");
  // What each sound is called comes from the catalog; only Play and Stop are the page's.
  const called = async (tile: typeof one) => (await tile.getAttribute("aria-label"))!.replace(/^Play /, "");
  const [oneName, twoName] = [await called(one), await called(two)];
  expect(await clips()).toEqual([]);

  // A tile plays its clip: pressed, labelled Stop, and its audio is running.
  await one.click();
  await expect(one).toHaveAttribute("aria-pressed", "true");
  await expect(one).toHaveAttribute("aria-label", `Stop ${oneName}`);
  await expect.poll(async () => (await clips()).map((clip) => clip.playing)).toEqual([true]);
  await expect.poll(async () => (await clips())[0].time).toBeGreaterThan(0);

  // Starting another stops the first.
  await two.click();
  await expect(two).toHaveAttribute("aria-pressed", "true");
  await expect(two).toHaveAttribute("aria-label", `Stop ${twoName}`);
  await expect(one).toHaveAttribute("aria-pressed", "false");
  await expect(one).toHaveAttribute("aria-label", `Play ${oneName}`);
  await expect(page.getByRole("list", { name: "The sounds it fires on most" }).getByRole("button", { pressed: true })).toHaveCount(1);
  await expect.poll(async () => (await clips()).map((clip) => clip.playing)).toEqual([false, true]);

  // Pressing the playing one stops it.
  await two.click();
  await expect(two).toHaveAttribute("aria-pressed", "false");
  await expect(two).toHaveAttribute("aria-label", `Play ${twoName}`);
  await expect.poll(async () => (await clips()).map((clip) => clip.playing)).toEqual([false, false]);
});

test("Translate to English swaps tokens, labels and examples", async ({ page }) => {
  // Qwen's n6321 fires on 罚款 (fines): the mock's terms.json and its contexts carry Haiku's English.
  await page.goto("/qwen3-8b/L8/n6321");
  const english = page.getByRole("switch", { name: "English" });
  const side = page.getByRole("tab", { name: /^Positive side/ });
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
  await expect(translated).toHaveCount(0);
  await expect(inEnglish).toHaveCount(0);
  await expect(language).toHaveCount(0);

  // On: the token, the label and the examples are in English.
  await english.click();
  await expect(english).toHaveAttribute("aria-checked", "true");
  await expect(translated).toBeVisible();
  await expect(token).toHaveCount(0);
  await expect(side).toHaveAccessibleName(/fine \(translated from 罚款\)/);
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
