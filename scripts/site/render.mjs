#!/usr/bin/env node
// Draws the site's images into public/: the social card (card.png, from scripts/site/card.html) and
// the icons made from the mark (public/favicon.svg): favicon.ico, apple-touch-icon.png and the
// manifest's icons. The card's atlas comes from the built catalog, so run it after the catalog is in
// public/data, and again when the mark, the card or Qwen3-8B's catalog changes.
//
//   node scripts/site/render.mjs

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

const root = resolve(fileURLToPath(import.meta.url), "../../..");
const at = (path) => resolve(root, path);

// The atlas's shades and the card's unit, as src/explorer/atlas/levels.ts and the explorer have them.
const SHADES = [0.1, 0.16, 0.24, 0.32, 0.42, 0.52, 0.62, 0.74, 0.86, 1];
const UNIT = { layer: 8, n: 344 };

/** Qwen3-8B's atlas: each layer's easiest neurons, most readable first, shaded by rank in the model. */
async function atlas() {
  const index = JSON.parse(await readFile(at("public/data/qwen3-8b/index.json"), "utf8"));
  const scores = Float64Array.from(index.neurons.map((row) => row[4])).sort();
  const shade = (score) => {
    let below = 0;
    while (below < scores.length && scores[below] < score) below += 1;
    return SHADES[Math.min(9, Math.floor((below / scores.length) * 10))];
  };
  const columns = Array.from({ length: index.layers }, () => []);
  for (const row of index.neurons) columns[row[0]].push(row);
  for (const column of columns) column.sort((a, b) => b[4] - a[4]);
  const slot = columns[UNIT.layer].findIndex((row) => row[1] === UNIT.n);
  if (slot < 0) throw new Error(`L${UNIT.layer} n${UNIT.n} is no longer among the layer's easiest neurons`);
  return { columns: columns.map((column) => column.map((row) => shade(row[4]))), here: { layer: UNIT.layer, slot } };
}

/** An .ico holding PNGs, one entry per size. */
function ico(pngs) {
  const header = Buffer.alloc(6 + 16 * pngs.length);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  let offset = header.length;
  pngs.forEach(({ size, data }, i) => {
    const entry = 6 + 16 * i;
    header.writeUInt8(size % 256, entry);
    header.writeUInt8(size % 256, entry + 1);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(data.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...pngs.map((png) => png.data)]);
}

const browser = await chromium.launch();
try {
  const card = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2, colorScheme: "light" });
  await card.goto(pathToFileURL(at("scripts/site/card.html")).href);
  await card.evaluate((data) => window.draw(data), await atlas());
  await card.evaluate(() => document.fonts.ready);
  await writeFile(at("public/card.png"), await card.screenshot({ type: "png" }));

  // The mark in light colours: as drawn (rounded, on transparency) or full bleed, where a platform
  // rounds or masks it itself (iOS, Android's maskable icons).
  const mark = await readFile(at("public/favicon.svg"), "utf8");
  const icon = await browser.newPage({ colorScheme: "light" });
  async function draw(size, bleed) {
    await icon.setViewportSize({ width: size, height: size });
    await icon.setContent(`<style>*{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${mark}`);
    if (bleed) await icon.evaluate(() => document.querySelector(".tile").setAttribute("rx", "0"));
    return icon.screenshot({ type: "png", omitBackground: true });
  }
  await writeFile(at("public/apple-touch-icon.png"), await draw(180, true));
  await writeFile(at("public/icon-192.png"), await draw(192, false));
  await writeFile(at("public/icon-512.png"), await draw(512, false));
  await writeFile(at("public/icon-maskable-512.png"), await draw(512, true));
  const small = [];
  for (const size of [16, 32, 48]) small.push({ size, data: await draw(size, false) });
  await writeFile(at("public/favicon.ico"), ico(small));
} finally {
  await browser.close();
}
