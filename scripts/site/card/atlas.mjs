#!/usr/bin/env node
// Takes from the site what the social card shows of the explorer: the card's model's atlas as the explorer draws it
// (atlas.webp, at the size the card shows it, twice over), and where the explorer pins each of the card's neurons in
// its layer's column (atlas.json: 0 the column's top, 1 its foot). The atlas is taken with L8·n344 chosen, the neuron
// the site opens on, so that layer shows as chosen. Run it when the explorer's atlas or the card's neurons (card.json)
// change, then scripts/site/render.mjs. Encoding the atlas needs Python with Pillow (PYTHON, or python3).
//
//   node scripts/site/card/atlas.mjs [origin]      the live site, or another origin (a dev server, a preview)

import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { chromium } from "@playwright/test";

const here = resolve(fileURLToPath(import.meta.url), "..");
const origin = process.argv[2] ?? "https://neuron-lens.com";
const card = JSON.parse(await readFile(join(here, "card.json"), "utf8"));
const CHOSEN = { layer: 8, neuron: 344 };

const folder = await mkdtemp(join(tmpdir(), "neuron-lens-atlas-"));
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 3, colorScheme: "dark" });

  /** The atlas with a neuron chosen among all of its layer's (`?all`, where every neuron has a place), once it is still. */
  async function open({ layer, neuron }) {
    await page.goto(`${origin}/${card.model}/L${layer}/n${neuron}?all`, { waitUntil: "networkidle" });
    const plot = page.locator(".atlas .plot");
    await plot.locator(".pin").waitFor();
    await plot.scrollIntoViewIfNeeded();
    await page.mouse.move(2, 2);
    await page.waitForTimeout(2500);
    return plot;
  }

  const pins = {};
  for (const unit of card.units) {
    const plot = await open(unit);
    pins[`L${unit.layer}·n${unit.neuron}`] = await plot.evaluate((el) => {
      const box = el.getBoundingClientRect(), pin = el.querySelector(".pin").getBoundingClientRect();
      return Math.round(((pin.y + pin.height / 2 - box.y) / box.height) * 1e4) / 1e4;
    });
  }

  const plot = await open(CHOSEN);
  const shot = join(folder, "atlas.png");
  await writeFile(shot, await page.screenshot({ type: "png", clip: await plot.boundingBox() }));
  const encode = "import sys; from PIL import Image; Image.open(sys.argv[1]).convert('RGB').resize((2144, 132), Image.LANCZOS).save(sys.argv[2], 'WEBP', quality=92, method=6)";
  await promisify(execFile)(process.env.PYTHON ?? "python3", ["-c", encode, shot, join(here, "atlas.webp")]);
  await writeFile(join(here, "atlas.json"), `${JSON.stringify({ pins }, null, 2)}\n`);
  console.log(pins);
} finally {
  await browser.close();
  await rm(folder, { recursive: true });
}
