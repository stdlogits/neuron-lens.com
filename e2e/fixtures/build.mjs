// Cuts the e2e mock catalog (e2e/fixtures/catalog/<model>/) from the real one in public/data: the few
// units the specs visit, with everything they name and nothing else. Run it again when the catalog's
// format changes or the specs need another unit:
//
//   node e2e/fixtures/build.mjs [public/data]
//
// What it keeps, per model (KEEP below): some of the easiest neurons of a layer, deep-linked neurons
// (with their layer's All list cut to them and the layer's top few), and some heads of a layer. Token
// ids are renumbered into a small vocab.json, search.json and terms.json keep only what names a kept
// unit or token, and media documents are renumbered into one block. Media bytes are made up (a 1 × 1
// WebP, two frames of silent MP3, one copy for each shown document, since the page keys a tile by
// where its bytes are) so no collection's images or sounds are copied into the repository.
// scores.json isn't written: one byte per neuron is ~1 MB a model, so catalog.ts makes it up.

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const source = resolve(process.argv[2] ?? resolve(here, "../../public/data"));
const target = resolve(here, "catalog");

/** easiest: layer -> how many of its easiest neurons; neurons: [layer, neuron] deep links; heads: layer -> how many, plus named ones. */
const KEEP = {
  "qwen3-8b": { easiest: { 8: 6 }, neurons: [[8, 344]], allTop: 2, heads: { 20: { top: 4, named: [17] } } },
  "gemma-4-12b": { easiest: { 23: 4 }, neurons: [[33, 12225], [14, 8313]], allTop: 2, heads: { 28: { top: 4, named: [6] } } },
};

const pad = (value, width = 2) => String(value).padStart(width, "0");
const read = async (model, path) => JSON.parse(await readFile(resolve(source, model, path), "utf8"));
async function write(model, path, value) {
  const file = resolve(target, model, path);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, typeof value === "string" || value instanceof Uint8Array ? value : `${JSON.stringify(value)}\n`);
}

// A 1 × 1 lossless WebP, and an MPEG-1 layer III stream of silent frames (128 kbps, 44.1 kHz).
const WEBP = Buffer.from("UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==", "base64");
function silentMp3(frames = 2) {
  const frame = Buffer.alloc(417);
  frame.set([0xff, 0xfb, 0x90, 0x64]);
  return Buffer.concat(Array.from({ length: frames }, () => frame));
}
const MEDIA_BYTES = { image: WEBP, audio: silentMp3() };

async function cut(model) {
  const keep = KEEP[model];
  const index = await read(model, "index.json");
  const { chunk, headsPerLayer: heads } = index;

  // ---------- which neurons
  const easiest = new Map(); // old index.neurons position -> row
  for (const [layer, count] of Object.entries(keep.easiest)) {
    const rows = index.neurons.map((row, i) => [i, row]).filter(([, row]) => row[0] === Number(layer)).sort((a, b) => b[1][4] - a[1][4]).slice(0, count);
    for (const [i, row] of rows) easiest.set(i, row);
  }
  for (const [layer, neuron] of keep.neurons) {
    const i = index.neurons.findIndex((row) => row[0] === layer && row[1] === neuron);
    if (i >= 0) easiest.set(i, index.neurons[i]);
  }
  const positions = [...easiest.keys()].sort((a, b) => a - b);
  const newPosition = new Map(positions.map((old, i) => [old, i]));

  /** layer -> Set of neurons with details. */
  const detailed = new Map();
  const want = (layer, n) => (detailed.get(layer) ?? detailed.set(layer, new Set()).get(layer)).add(n);
  for (const i of positions) want(easiest.get(i)[0], easiest.get(i)[1]);
  for (const [layer, n] of keep.neurons) want(layer, n);

  // Each such layer's All list: its kept neurons and its top few.
  const layerRows = new Map();
  for (const layer of detailed.keys()) {
    const all = (await read(model, `neurons/L${pad(layer)}/index.json`)).neurons;
    for (const row of [...all].sort((a, b) => b[3] - a[3]).slice(0, keep.allTop)) want(layer, row[0]);
    layerRows.set(layer, all.filter((row) => detailed.get(layer).has(row[0])));
  }

  // ---------- details, collecting the token ids and media documents they name
  const ids = new Set();
  const docs = { image: new Set(), audio: new Set() };
  const token = (t) => ids.add(typeof t === "number" ? t : t[0]);
  const chunks = new Map(); // path -> file
  for (const [layer, wanted] of detailed) {
    for (const c of new Set([...wanted].map((n) => Math.floor(n / chunk)))) {
      const path = `neurons/L${pad(layer)}/c${pad(c, 3)}.json`;
      const file = await read(model, path);
      file.neurons = file.neurons.filter((neuron) => wanted.has(neuron.n));
      for (const neuron of file.neurons) {
        for (const pole of neuron.poles) {
          for (const [, tokens] of pole.reads) tokens.forEach(token);
          for (const [t] of pole.drivers) ids.add(t);
          for (const [modality, media] of Object.entries(pole.media ?? {})) {
            media.write.forEach(token);
            media.writeZ.forEach(token);
            for (const [doc] of media.top) docs[modality].add(doc);
          }
        }
      }
      chunks.set(path, file);
    }
  }
  const headRows = (await read(model, "heads/index.json")).heads;
  const keptHeads = new Set();
  const headFiles = new Map();
  for (const [layer, { top, named }] of Object.entries(keep.heads)) {
    const rows = headRows.filter((row) => row[0] === Number(layer)).sort((a, b) => b[10] - a[10]);
    const chosen = new Set([...rows.slice(0, top).map((row) => row[1]), ...named]);
    for (const h of chosen) keptHeads.add(Number(layer) * heads + h);
    const file = await read(model, `heads/L${pad(Number(layer))}.json`);
    file.heads = file.heads.filter((head) => chosen.has(head.h));
    for (const head of file.heads) {
      for (const [, tokens] of head.reads) tokens.forEach(token);
      head.outRz.forEach(token);
      for (const [t] of [...head.drivers, ...head.keys]) ids.add(t);
    }
    headFiles.set(`heads/L${pad(Number(layer))}.json`, file);
  }

  // ---------- renumber tokens
  const vocab = await read(model, "vocab.json");
  const order = [...ids].sort((a, b) => a - b);
  const newId = new Map(order.map((old, i) => [old, i]));
  const retoken = (t) => (typeof t === "number" ? newId.get(t) : [newId.get(t[0]), t[1], t[2]]);
  const repair = ([t, value]) => [newId.get(t), value];

  // ---------- renumber media documents into one block each
  const docNumber = {};
  const mediaDocs = {};
  for (const modality of index.media) {
    const list = [...docs[modality]].sort((a, b) => a - b);
    docNumber[modality] = new Map(list.map((old, i) => [old, i]));
    const blocks = new Map();
    mediaDocs[modality] = [];
    const bytes = MEDIA_BYTES[modality];
    const pack = [];
    for (const old of list) {
      const block = Math.floor(old / index.docBlock);
      if (!blocks.has(block)) blocks.set(block, await read(model, `media/${modality}/d${pad(block, 3)}.json`));
      const file = blocks.get(block);
      const doc = { ...file.docs[old - file.first] };
      if (doc.h) {
        doc.h = [0, pack.length * bytes.length, bytes.length];
        pack.push(bytes);
      }
      mediaDocs[modality].push(doc);
    }
    await write(model, `media/${modality}/d000.json`, { first: 0, docs: mediaDocs[modality] });
    await write(model, `media/${modality}/p000.bin`, Buffer.concat(pack));
  }
  if (index.media.length) await write(model, "media/credits.json", await read(model, "media/credits.json"));

  // ---------- write
  for (const [path, file] of chunks) {
    for (const neuron of file.neurons) {
      for (const pole of neuron.poles) {
        pole.reads = pole.reads.map(([pct, tokens]) => [pct, tokens.map(retoken)]);
        pole.drivers = pole.drivers.map(repair);
        for (const [modality, media] of Object.entries(pole.media ?? {})) {
          media.write = media.write.map(retoken);
          media.writeZ = media.writeZ.map(retoken);
          media.top = media.top.map(([doc, act]) => [docNumber[modality].get(doc), act]);
        }
      }
    }
    await write(model, path, file);
  }
  for (const [path, file] of headFiles) {
    for (const head of file.heads) {
      head.reads = head.reads.map(([pct, tokens]) => [pct, tokens.map(retoken)]);
      head.outRz = head.outRz.map(retoken);
      head.drivers = head.drivers.map(repair);
      head.keys = head.keys.map(repair);
    }
    await write(model, path, file);
  }
  for (const [layer, rows] of layerRows) await write(model, `neurons/L${pad(layer)}/index.json`, { layer, neurons: rows });
  await write(model, "index.json", { ...index, neurons: positions.map((i) => easiest.get(i)) });
  await write(model, "heads/index.json", { heads: headRows.filter((row) => keptHeads.has(row[0] * heads + row[1])) });
  const smallVocab = order.map((old) => vocab[old]);
  await write(model, "vocab.json", smallVocab);

  // search.json: forms that name a kept unit, pointing at its new place.
  const search = await read(model, "search.json");
  const forms = {};
  const display = {};
  for (const [form, hits] of Object.entries(search.forms)) {
    const kept = hits.flatMap(([ref, side, weight]) => {
      if (side === 2) return keptHeads.has(ref) ? [[ref, side, weight]] : [];
      return newPosition.has(ref) ? [[newPosition.get(ref), side, weight]] : [];
    });
    if (!kept.length) continue;
    forms[form] = kept;
    if (form in search.display) display[form] = search.display[form];
  }
  await write(model, "search.json", { forms, display });

  // terms.json: the kept tokens, and terms quoted in the kept labels.
  const terms = await read(model, "terms.json");
  const tokens = new Set(smallVocab.map((t) => t.trim()));
  const labels = [...chunks.values()].flatMap((file) => file.neurons.flatMap((n) => n.poles.flatMap((p) => [p.label.fires, p.label.writes, p.label.note, ...p.peaks.map(([t]) => t)])))
    .concat([...headFiles.values()].flatMap((file) => file.heads.flatMap((h) => [h.label.fires, h.label.attends, h.label.writes, h.label.note, ...h.peaks.map(([t]) => t), ...h.sources.map(([t]) => t)])))
    .concat(positions.flatMap((i) => [easiest.get(i)[2], easiest.get(i)[3]]))
    .join("\n");
  const keptTerms = Object.fromEntries(Object.entries(terms).filter(([key]) => tokens.has(key) || labels.includes(key)));
  await write(model, "terms.json", keptTerms);

  console.log(`${model}: ${positions.length} easiest, ${[...detailed.values()].reduce((s, set) => s + set.size, 0)} detailed neurons, ${keptHeads.size} heads, ${order.length} tokens, ${Object.keys(forms).length} search forms, ${Object.keys(keptTerms).length} terms${index.media.length ? `, ${index.media.map((m) => `${mediaDocs[m].length} ${m}`).join(", ")}` : ""}`);
}

await rm(target, { recursive: true, force: true });
for (const model of Object.keys(KEEP)) await cut(model);
