#!/usr/bin/env node
// Draws the unit-card prototypes for the units in samples.json, from what capture.mjs took into a folder: for each,
// <unit>-unit.png (unit.html, the card for every platform but Discord) and, where the unit is labelled and has
// connections to draw, <unit>-circuit.png (circuit.html, Discord's). Prototypes: nothing on the site serves these.
//
//   node scripts/site/unit-cards/capture.mjs <folder>
//   node scripts/site/unit-cards/render.mjs <folder>

import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

const here = resolve(fileURLToPath(import.meta.url), "..");
const [folder] = process.argv.slice(2);
if (!folder) { console.error("render: name the folder capture.mjs wrote into"); process.exit(2); }
const samples = JSON.parse(await readFile(join(here, "samples.json"), "utf8"));

const browser = await chromium.launch();
try {
  for (const unit of samples) {
    const tag = unit.key.replace(/-(unlabelled|silent)$/, "");
    if (!existsSync(join(folder, `${tag}.json`))) { console.log(`${unit.key}: not captured`); continue; }
    const cap = JSON.parse(await readFile(join(folder, `${tag}.json`), "utf8"));
    const file = (name) => pathToFileURL(resolve(folder, name)).href;
    const cards = [["unit", "unit.html"]];
    if (unit.variant === "labelled" && cap.lists.some((list) => list.rows.length)) cards.push(["circuit", "circuit.html"]);
    for (const [name, template] of cards) {
      const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2, colorScheme: "dark" });
      await page.goto(pathToFileURL(join(here, template)).href);
      await page.evaluate((data) => window.draw(data), { unit, cap, graph: file(`${tag}-graph.png`), atlas: file(`${tag}-atlas.png`) });
      await page.evaluate(() => document.fonts.ready);
      await writeFile(join(folder, `${unit.key}-${name}.png`), await page.screenshot({ type: "png" }));
      await page.close();
      console.log(`${unit.key}-${name}.png`);
    }
  }
} finally {
  await browser.close();
}
