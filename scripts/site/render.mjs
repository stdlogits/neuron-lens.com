#!/usr/bin/env node
// Draws the site's images into public/: the social card (card.webp) and the icons made from the mark
// (public/favicon.svg): favicon.ico, apple-touch-icon.png and the manifest's icons. The card is a painting with
// the name set over it (Ledger's DESIGN.md, "The marks and the cards"): scripts/site/paint/lens.py paints it from
// the built catalog, and scripts/site/card.html sets the type. So run this after the catalog is in catalog/, and
// again when the mark, the card or Qwen3-8B's catalog changes. Painting needs Python with numpy, scipy and Pillow
// (PYTHON, or python3).
//
//   node scripts/site/render.mjs

import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { chromium } from "@playwright/test";

const root = resolve(fileURLToPath(import.meta.url), "../../..");
const at = (path) => resolve(root, path);

/** The card's painting, at twice the card's size and reduced, into a folder of its own. */
async function paint(folder) {
  const art = join(folder, "lens.png");
  const { stdout } = await promisify(execFile)(process.env.PYTHON ?? "python3", [at("scripts/site/paint/lens.py"), at("catalog/qwen3-8b"), "2", art]);
  process.stdout.write(stdout);
  return art;
}

/** The card as WebP at quality 92, as a9l.im's cards are: a painting weighs a tenth of its PNG that way. Pillow,
 *  which the painting already needs, encodes it. */
async function webp(png, out) {
  const encode = "import sys; from PIL import Image; Image.open(sys.argv[1]).save(sys.argv[2], 'WEBP', quality=92, method=6)";
  await promisify(execFile)(process.env.PYTHON ?? "python3", ["-c", encode, png, out]);
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

const folder = await mkdtemp(join(tmpdir(), "neuron-lens-card-"));
const browser = await chromium.launch();
try {
  const card = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2, colorScheme: "dark" });
  await card.goto(pathToFileURL(at("scripts/site/card.html")).href);
  await card.evaluate((data) => window.draw(data), { art: pathToFileURL(await paint(folder)).href });
  await card.evaluate(() => document.fonts.ready);
  const shot = join(folder, "card.png");
  await writeFile(shot, await card.screenshot({ type: "png" }));
  await webp(shot, at("public/card.webp"));

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
  await rm(folder, { recursive: true });
}
