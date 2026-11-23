// The words a shared link to a unit carries. Every address is served the same index.html and the explorer draws each
// view in the browser, so a link preview (Discord's, Slack's, X's), which runs no script, saw only the site's own title
// and description whichever unit was shared. This runs at Cloudflare in front of the page, on a neuron's or a head's
// address only (the build's _routes.json; any other request never reaches it): it reads that unit's label from the
// catalog, as the explorer would, and writes the unit's title, description and layer colour into the page's head.
// The picture stays the site's card. Whatever goes wrong (the catalog slow or changed, an address with no such unit),
// the page is served as it is.
//
// scripts/site/meta.ts writes this into the build as _worker.js (Pages' advanced mode: one file, no bundling, so it
// can be uploaded in the dashboard as well as by Wrangler), with SITE filled in from src/lib/models.ts and
// src/lib/catalog.json. It must stay one file with no imports.

const SITE = /*SITE*/null;

// A pole's record in a layer's graph.bin and a head's in heads/graph.bin (WIRE and HEAD_WIRE in the catalog's builder):
// how sure the labeller was, its flags, where its detail is, then its title. The file's size is checked against these.
const WIRE = 800, HEAD_WIRE = 1004;
const UNIT = /^\/([a-z0-9.-]+)\/L(\d{1,2})\/([nh])(\d{1,5})\/?$/;
const WAIT = 2500;                    // ms for the catalog, after which the page goes out as it is
const TITLE = 70, DESCRIPTION = 350;  // bytes: what Discord shows of each

export default {
  async fetch(request, env, context) {
    context.passThroughOnException();
    const page = await env.ASSETS.fetch(request);
    const unit = request.method === "GET" ? unitAt(new URL(request.url).pathname) : null;
    if (!unit || page.status !== 200 || !(page.headers.get("content-type") ?? "").includes("text/html")) return page;
    try {
      return rewrite(page, await describe(unit, AbortSignal.timeout(WAIT)));
    } catch {
      return page;
    }
  },
};

/** The unit an address names, as the explorer's router reads it (src/lib/router.svelte.ts), or null. */
function unitAt(pathname) {
  const match = pathname.match(UNIT);
  const model = match && SITE.models[match[1]];
  if (!model) return null;
  const layer = Number(match[2]), index = Number(match[4]), kind = match[3];
  if (layer >= model.layers || index >= (kind === "h" ? model.heads : model.mlp)) return null;
  return { id: match[1], model, layer, kind, index };
}

// ---------- the catalog, as src/lib/data.ts reads it: a build's manifest names each file's object

const manifests = new Map();
async function objectUrl(model, path, signal) {
  let manifest = manifests.get(model);
  if (!manifest) {
    manifest = await (await get(`${SITE.catalog}/${model}/${SITE.builds[model]}.json`, signal)).json();
    manifests.set(model, manifest);
  }
  if (!manifest[path]) throw new Error(`${model}/${path}: not in its build`);
  return `${SITE.catalog}/o/${manifest[path]}`;
}

async function get(url, signal, headers = {}) {
  const response = await fetch(url, { headers, signal });
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return response;
}

/** Bytes of a file by range, and the file's whole size. */
async function range(url, offset, length, signal) {
  const response = await get(url, signal, { Range: `bytes=${offset}-${offset + length - 1}` });
  if (response.status !== 206) throw new Error(`${url}: no range`);
  return { bytes: new Uint8Array(await response.arrayBuffer()), size: Number((response.headers.get("content-range") ?? "").split("/")[1]) };
}

function record(bytes) {
  let end = 18;
  while (end < 128 && bytes[end] !== 0) end += 1;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { title: new TextDecoder().decode(bytes.subarray(18, end)), silent: (bytes[1] & 2) !== 0, pack: bytes[2], offset: view.getUint32(4, true), length: view.getUint32(8, true) };
}

const inflate = (bytes) => new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate"))).text();
const pad = (value) => String(value).padStart(2, "0");

// ---------- the words

const bytes = (text) => new TextEncoder().encode(text).length;
/** Cut to a number of bytes at a word's end. */
function cut(text, most) {
  if (bytes(text) <= most) return text;
  let out = text;
  while (bytes(`${out}…`) > most) out = out.slice(0, -1);
  return `${out.replace(/\s+\S*$/, "").replace(/[;:,.(]+$/, "")}…`;
}
const lower = (text) => text.charAt(0).toLowerCase() + text.slice(1);
const tidy = (text) => text.replace(/⏎/g, " ").replace(/<\|[^|]*\|>/g, " ").replace(/�/g, "").replace(/\s+/g, " ");

/** A firing as a line: a few words either side of the token it fired on, which is in brackets. A head's line also
 *  brackets the earlier token it attended to. In English where the catalog has it translated. */
function firing(context) {
  const text = context?.[1] ?? context?.[0];
  const at = typeof text === "string" ? text.match(/^([\s\S]*)⟦([\s\S]*?)⟧([\s\S]*)$/) : null;
  if (!at || !at[2]) return null;
  const [, before, token, after] = at;
  const open = /^\s/.test(token) || /\s$/.test(before) ? " " : "", close = /\s$/.test(token) || /^\s/.test(after) ? " " : "";
  const key = before.match(/^([\s\S]*)⟪([\s\S]*?)⟫([\s\S]*)$/);
  const words = (part, from, to) => tidy(part).trim().split(" ").filter(Boolean).slice(from, to).join(" ");
  const shown = (part) => tidy(part).trim() || (/[⏎\n]/.test(part) ? "↵" : "");      // a token that is only a line's end
  if (!shown(token)) return null;                                                   // or one with nothing to show
  let lead = words(before.replace(/[⟪⟫]/g, ""), -6);
  if (key && shown(key[2])) {
    const between = tidy(key[3]).trim().split(" ").filter(Boolean);
    const middle = between.length > 4 ? `${between[0]} … ${between[between.length - 1]}` : between.join(" ");
    const gap = (side) => (/\s/.test(side) ? " " : "");
    lead = `${words(key[1], -2)}${gap(key[2].charAt(0) + key[1].slice(-1))}[${shown(key[2])}]${gap(key[2].slice(-1) + key[3].charAt(0))}${middle}`;
  }
  const tail = words(after, 0, 3);
  return lead || tail ? `…${lead}${open}[${shown(token)}]${close}${tail}`.trim() : null;
}

/** A layer's place on the depth ramp, as the explorer colours it (depthColor, src/lib/models.ts), in Ledger's light
 *  tokens so it reads on a light or a dark chat: --deep #6a4fe0 to --late #0b87ad, mixed in oklch. */
function depthColour(layer, layers) {
  const linear = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4), gamma = (v) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
  const oklch = (hex) => {
    const [r, g, b] = [1, 3, 5].map((i) => linear(parseInt(hex.slice(i, i + 2), 16) / 255));
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
    return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, Math.hypot(A, B), Math.atan2(B, A)];
  };
  const deep = oklch("#6a4fe0"), late = oklch("#0b87ad"), t = layers > 1 ? layer / (layers - 1) : 0;
  const [L, C, H] = deep.map((v, i) => v + (late[i] - v) * t), a = C * Math.cos(H), b = C * Math.sin(H);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const rgb = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
  return `#${rgb.map((v) => Math.round(Math.min(1, Math.max(0, gamma(v))) * 255).toString(16).padStart(2, "0")).join("")}`;
}

/** What a preview says of a unit: the page's title as the explorer sets it, the preview's heading, and its lines. */
async function describe({ id, model, layer, kind, index }, signal) {
  // A base model is shown with its post-trained model's labels (labelsFrom, src/lib/models.ts); its own are empty.
  const source = model.labels ?? id, lent = source !== id;
  const name = `L${layer}·${kind}${index}`;
  const band = model.bands.find((b) => layer <= b.last) ?? model.bands[model.bands.length - 1];
  const where = `${model.name} · layer ${layer} of ${model.layers - 1} · ${band.name.toLowerCase()} layers`;
  const credit = !model.labels ? "Not labelled yet" : lent ? `Labels by Claude Haiku 5.5, written for ${SITE.models[source].name}` : "Labels by Claude Haiku 5.5";
  const lines = [];      // [text, kept only while the whole fits]
  let what;

  if (kind === "h") {
    const got = await range(await objectUrl(source, "heads/graph.bin", signal), (layer * model.heads + index) * HEAD_WIRE, HEAD_WIRE, signal);
    if (got.size !== HEAD_WIRE * model.layers * model.heads) throw new Error("heads/graph.bin: another record size");
    const file = await (await get(await objectUrl(source, `heads/L${pad(layer)}.json`, signal), signal)).json();
    const detail = file.heads.find((head) => head.h === index), label = detail?.label ?? {};
    what = record(got.bytes).title || "attention head";
    lines.push([`${where} · attention head`]);
    if (label.attends) lines.push([`Attends to: ${lower(label.attends)}`]);
    const example = lent ? null : firing(detail?.contexts?.[0]);
    if (example) lines.push([`e.g. ${example}`, true]);
    if (label.writes) lines.push([`Writes: ${lower(label.writes)}`]);
  } else {
    const url = await objectUrl(source, `neurons/L${pad(layer)}/graph.bin`, signal);
    const got = await Promise.all([range(url, index * WIRE, WIRE, signal), range(url, (index + model.mlp) * WIRE, WIRE, signal)]);
    if (got[0].size !== WIRE * 2 * model.mlp) throw new Error("graph.bin: another record size");
    const poles = got.map((pole) => record(pole.bytes));
    const [{ pack, offset, length }] = poles;
    const detail = length ? JSON.parse(await inflate((await range(await objectUrl(source, `neurons/L${pad(layer)}/units-${pad(pack)}.bin`, signal), offset, length, signal)).bytes)) : null;
    // The explorer opens a neuron on its clearer side.
    const side = detail && detail.poles[1].score > detail.poles[0].score && !detail.poles[1].silent ? 1 : 0;
    const pole = detail?.poles[side], label = pole?.label ?? {}, shown = poles[side], other = poles[1 - side];
    lines.push([`${where} · ${side ? "−" : "+"} side`]);
    if (pole ? pole.silent : shown.silent) {
      what = "near-silent neuron";
      lines.push(["Near-silent: it almost never fires."]);
    } else {
      what = shown.title || "neuron";
      lines.push([`Fires on: ${label.fires || shown.title}`]);
      const example = lent ? null : firing(pole?.contexts?.[0]);
      if (example) lines.push([`e.g. ${example}`, true]);
      if (label.writes) lines.push([`Makes the model say: ${label.writes}`]);
    }
    if (other.title && !other.silent) lines.push([`${side ? "+" : "−"} side: ${other.title}`, true]);
  }
  lines.push([credit]);
  // What may go leaves, the example first, until the whole fits what a preview shows.
  const text = () => lines.map(([line]) => line).join("\n");
  while (bytes(text()) > DESCRIPTION && lines.some(([, spare]) => spare)) lines.splice(lines.findIndex(([, spare]) => spare), 1);
  return {
    title: `${name} · ${model.name} · ${SITE.name}`,
    heading: cut(`${name} · ${what}`, TITLE),
    description: cut(text(), DESCRIPTION),
    summary: cut(lines.slice(1, -1).map(([line]) => line).concat(`${name}, ${model.name}.`).join(". ").replace(/\.\. /g, ". "), 300),
    accent: depthColour(layer, model.layers),
  };
}

/** The page with the unit's words in its head; everything else, and every header, as it was. */
function rewrite(page, words) {
  const content = (value) => ({ element(element) { element.setAttribute("content", value); } });
  return new HTMLRewriter()
    .on("title", { element(element) { element.setInnerContent(words.title); } })
    .on('meta[name="description"]', content(words.summary))
    .on('meta[property="og:title"]', content(words.heading))
    .on('meta[property="og:description"]', content(words.description))
    // Discord takes the page's last theme-color; the two with a media query are the browser's.
    .on('meta[name="theme-color"]', { element(element) { if (!element.getAttribute("media")) element.setAttribute("content", words.accent); } })
    .transform(page);
}
