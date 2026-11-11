// Serves the mock catalog (e2e/fixtures/catalog, cut by build.mjs) in place of the dev server's /data,
// the way R2 serves the real one: JSON by path, graph records and packs by HTTP range (206), anything else 404.
// JavaScript rather than TypeScript: the project has no Node types, and this reads files.
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const CATALOG = resolve(here, "catalog");

/** A fixture file, parsed.
 * @template T
 * @param {string} path under e2e/fixtures/catalog
 * @returns {Promise<T>} */
export async function fixture(path) {
  return JSON.parse(await readFile(resolve(CATALOG, path), "utf8"));
}

// scores.json is one byte per neuron (~1 MB a model), so it is made up here: a fixed pseudo-random
// readability per neuron, in the real file's shape.
/** @type {Map<string, Promise<string>>} */
const scores = new Map();
/** @param {string} model */
function madeUpScores(model) {
  let pending = scores.get(model);
  if (!pending) {
    pending = fixture(`${model}/index.json`).then((/** @type {{ layers: number, neuronsPerLayer: number }} */ { layers, neuronsPerLayer }) => {
      const out = [];
      for (let layer = 0; layer < layers; layer += 1) {
        const bytes = Buffer.alloc(neuronsPerLayer);
        let state = Math.imul(layer + 1, 2654435761) >>> 0;
        for (let i = 0; i < bytes.length; i += 1) {
          state = (Math.imul(state, 1103515245) + 12345) >>> 0;
          bytes[i] = Math.min(255, (state >>> 24) * (state >>> 25) >>> 7);
        }
        out.push(bytes.toString("base64"));
      }
      return JSON.stringify({ layers: out });
    });
    scores.set(model, pending);
  }
  return pending;
}

/** A pole's or head's record when the mock doesn't keep it: no title, no detail, no links.
 * @param {number} wire
 * @returns {Buffer} */
function blankRecord(wire) {
  const record = Buffer.alloc(wire);
  const firstLink = 128;
  for (let at = firstLink; at < wire; at += 6) record.writeUInt32LE(0xffffffff, at);
  return record;
}

/** The records the mock keeps of one graph.bin: none, for a layer it doesn't keep.
 * @type {Map<string, Promise<Record<string, string>>>} */
const graphs = new Map();
/** @param {string} path */
function keptRecords(path) {
  let pending = graphs.get(path);
  if (!pending) {
    pending = fixture(path.replace(/graph\.bin$/, "graph.json")).then((/** @type {{ records: Record<string, string> }} */ file) => file.records, () => ({}));
    graphs.set(path, pending);
  }
  return pending;
}

/** A graph.bin record: the one graph.json keeps, or a blank.
 * @param {import("@playwright/test").Route} route
 * @param {string} path */
async function answerGraph(route, path) {
  const range = /^bytes=(\d+)-(\d+)$/.exec(route.request().headers()["range"] ?? "");
  if (!range) return route.fulfill({ status: 400 });
  const [start, end] = [Number(range[1]), Number(range[2])];
  const wire = end - start + 1;
  const records = await keptRecords(path);
  const kept = records[Math.floor(start / wire)];
  return route.fulfill({
    status: 206,
    contentType: "application/octet-stream",
    headers: { "content-range": `bytes ${start}-${end}/*`, "accept-ranges": "bytes" },
    body: kept ? Buffer.from(kept, "base64") : blankRecord(wire),
  });
}

/** @param {import("@playwright/test").Route} route */
async function answer(route) {
  const url = new URL(route.request().url());
  const path = decodeURIComponent(url.pathname.slice("/data/".length));
  if (path.includes("..")) return route.fulfill({ status: 400 });
  const [model, ...rest] = path.split("/");
  if (rest.join("/") === "scores.json") return route.fulfill({ status: 200, contentType: "application/json", body: await madeUpScores(model) });

  if (path.endsWith("/graph.bin")) return answerGraph(route, path);

  let body;
  try {
    body = await readFile(resolve(CATALOG, path));
  } catch {
    return route.fulfill({ status: 404, contentType: "text/html", body: "<!doctype html><title>Not in the catalog</title>" });
  }
  if (path.endsWith(".json")) return route.fulfill({ status: 200, contentType: "application/json", body });

  const range = /^bytes=(\d+)-(\d*)$/.exec(route.request().headers()["range"] ?? "");
  if (!range) return route.fulfill({ status: 200, contentType: "application/octet-stream", body });
  const start = Number(range[1]);
  const end = Math.min(range[2] ? Number(range[2]) : body.length - 1, body.length - 1);
  if (start > end) return route.fulfill({ status: 416, headers: { "content-range": `bytes */${body.length}` } });
  return route.fulfill({
    status: 206,
    contentType: "application/octet-stream",
    headers: { "content-range": `bytes ${start}-${end}/${body.length}`, "accept-ranges": "bytes" },
    body: body.subarray(start, end + 1),
  });
}

/** A silent MP3 of about `seconds` seconds. Synthetic like the mock's own sounds, which build.mjs cuts to
 * two frames (about 50 ms): over before a test can see one playing. A frame at 128 kbps and 44.1 kHz is
 * 417 bytes and 26 ms.
 * @param {number} seconds
 * @returns {Buffer} */
export function silentClip(seconds) {
  const frame = Buffer.alloc(417);
  frame.set([0xff, 0xfb, 0x90, 0x64]);
  return Buffer.concat(Array.from({ length: Math.ceil(seconds / 0.026) }, () => frame));
}

/** Route every /data request of the page to the mock catalog.
 * @param {import("@playwright/test").Page} page */
export async function serveCatalog(page) {
  await page.route((url) => url.pathname.startsWith("/data/"), answer);
}
