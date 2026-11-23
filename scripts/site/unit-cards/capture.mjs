#!/usr/bin/env node
// For the unit-card prototypes (unit.html, circuit.html): takes from the site, for each unit in samples.json, what its
// cards show of the explorer, into a folder: its atlas with the unit chosen (<unit>-atlas.png), its connections graph
// as the rail draws it (<unit>-graph.png), and the rail's lists with where things stand (<unit>.json). Served for
// real, the cards would draw these with the explorer's own Atlas and Graph instead of pictures of them.
//
//   node scripts/site/unit-cards/capture.mjs <folder> [origin]      the live site, or another origin

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const here = resolve(fileURLToPath(import.meta.url), "..");
const [folder, origin = "https://neuron-lens.com"] = process.argv.slice(2);
if (!folder) { console.error("capture: name a folder to write into"); process.exit(2); }
await mkdir(folder, { recursive: true });
const samples = JSON.parse(await readFile(join(here, "samples.json"), "utf8"));
const RAIL = 372;       // a window this wide draws the rail's graph at its own width

/** Its lists stop changing once the walk through its connections has settled. */
async function settle(page) {
  await page.waitForSelector("aside.rail .lists .row, aside.rail .lists .none, aside.rail .lists p", { timeout: 45000 });
  let last = "", same = 0;
  for (let i = 0; i < 40 && same < 4; i += 1) {
    await page.waitForTimeout(500);
    const now = await page.locator("aside.rail").innerText();
    same = now === last ? same + 1 : 0;
    last = now;
  }
  await page.mouse.move(2, 2);
  await page.waitForTimeout(400);
}

const browser = await chromium.launch();
try {
  const seen = new Set();
  for (const unit of samples) {
    const tag = unit.key.replace(/-(unlabelled|silent)$/, "");      // a sample with its labels withheld is the same unit
    if (seen.has(tag)) continue;
    seen.add(tag);
    const neuron = unit.kind === "neuron", path = `/${unit.model}/L${unit.layer}/${neuron ? "n" : "h"}${unit.index}`, out = {};

    // the atlas and the lists, as a wide window shows them; a neuron among all of its layer's, where each has a place
    const wide = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 3, colorScheme: "dark" });
    await wide.goto(`${origin}${path}${neuron ? "?all" : ""}`, { waitUntil: "networkidle" });
    await settle(wide);
    const plot = wide.locator(".atlas .plot");
    await plot.scrollIntoViewIfNeeded();
    await wide.mouse.move(2, 2);
    await wide.waitForTimeout(500);
    await writeFile(join(folder, `${tag}-atlas.png`), await wide.screenshot({ type: "png", clip: await plot.boundingBox() }));
    out.atlas = await wide.evaluate(() => {
      const plot = document.querySelector(".atlas .plot"), b = plot.getBoundingClientRect();
      const box = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return [r.x - b.x, r.y - b.y, r.width, r.height].map((v) => Math.round(v * 100) / 100); };
      // a head has no pin: its own bar is the one drawn in ink
      const own = [...plot.querySelectorAll(".stack *")].find((el) => /rgb\(2[34]\d, 2[34]\d, 2[34]\d\)/.test(getComputedStyle(el).backgroundColor));
      return { size: [b.width, b.height], pin: box(plot.querySelector(".pin")), col: box(plot.querySelector('.col[aria-current="true"]')), own: box(own ?? null) };
    });
    out.lists = await wide.evaluate(() => [...document.querySelectorAll("aside.rail .lists section.side")].map((side) => ({
      title: side.querySelector("h3")?.textContent.trim(),
      rows: [...side.querySelectorAll("a.row")].map((row) => {
        const swatch = row.querySelector(".swatch"), meter = row.querySelector(".meter"), fill = meter?.firstElementChild;
        return {
          id: row.querySelector(".id")?.textContent.trim(), value: row.querySelector(".value")?.textContent.trim(), title: row.querySelector(".title")?.textContent.trim(),
          swatch: swatch ? [10, 6, getComputedStyle(swatch).backgroundColor] : null,
          fill: fill && meter ? fill.getBoundingClientRect().width / meter.getBoundingClientRect().width : null,
        };
      }),
    })));
    await wide.close();

    // the graph, as the rail draws it
    const narrow = await browser.newPage({ viewport: { width: RAIL, height: 1400 }, deviceScaleFactor: 3, colorScheme: "dark" });
    await narrow.goto(`${origin}${path}`, { waitUntil: "networkidle" });
    await settle(narrow);
    const graph = narrow.locator("aside.rail .graph");
    await graph.scrollIntoViewIfNeeded();
    await narrow.waitForTimeout(300);
    out.graph = await graph.evaluate((g) => {
      const b = g.getBoundingClientRect(), c = g.querySelector("canvas").getBoundingClientRect();
      const at = (el) => { const r = el.getBoundingClientRect(); return [r.x - b.x + r.width / 2, r.y - c.y + r.height / 2, r.width, r.height]; };
      const focus = g.querySelector(".node.focus");
      return { size: [b.width, c.height], focus: focus ? at(focus) : null, ticks: [...g.querySelectorAll(".tick")].map((tick) => [tick.textContent.trim(), at(tick)[1]]) };
    });
    const box = await graph.boundingBox(), links = await graph.locator("canvas").boundingBox();
    await writeFile(join(folder, `${tag}-graph.png`), await narrow.screenshot({ type: "png", clip: { x: box.x, y: links.y, width: box.width, height: links.height } }));
    out.key = await narrow.locator("aside.rail ul.key").innerText().catch(() => null);
    await narrow.close();

    await writeFile(join(folder, `${tag}.json`), JSON.stringify(out, null, 1));
    console.log(tag, out.lists.map((list) => `${list.title} ${list.rows.length}`).join(", ") || "no connections");
  }
} finally {
  await browser.close();
}
