// The words a shared link to a unit carries. Every address is served the same index.html and the explorer draws each
// view in the browser, so a link preview (Discord's, Slack's, X's), which runs no script, saw only the site's own title
// and description whichever unit was shared. This runs at Cloudflare in front of the page, on a neuron's or a head's
// address only (the build's _routes.json; any other request never reaches it): it reads that unit's label from the
// catalog, as the explorer would, and writes the unit's title, description and layer colour into the page's head.
// Whatever goes wrong (the catalog slow or changed, an address with no such unit), the page is served as it is.
//
// Discord also reads a "component embed" from the page's head and lays the preview out from it in place of the title
// and description: the same words in its Markdown (captions in bold, the tokens it fires on as chips, a firing
// quoted with its token marked), the units that drive it and that it drives as links, and buttons to the unit, its
// graph and its layer. Every other platform, and Discord if it won't have the embed, goes by the Open Graph tags.
//
// The picture is the unit's own card where the project is set up to draw one (below, "the picture"), and the site's
// card where it isn't: Cloudflare's hosted browser photographs the unit's address with ?card (the explorer's
// LinkCard.svelte), once, and the photograph is kept (in Workers KV) and served from there after.
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
const WIRED = 1200;                   // ms for the names of what a neuron is wired to, after which the embed goes without them
const TITLE = 70, DESCRIPTION = 350;  // bytes: what Discord shows of each
const COMPONENT = 3000;               // bytes: the most Discord takes of a component embed, as it is written in the page
const EMBED = false;                  // every unit's page carries Discord's embed; until it has been seen in Discord, only an address with ?discord does
const LINKS = 128, PER = 16, ENTRY = 6, DRIVEN = 2, DRIVES = 3;   // a pole's record: where its links start, and which lists (src/lib/data.ts, wireOf)
const SILENT = "near-silent neuron";
const PICTURE = /^\/card(\/circuit)?(\/[a-z0-9.-]+\/L\d{1,2}\/[nh]\d{1,5})\.webp$/;
const DRAWN = 2;                      // the card's look or encoding: raise it when either changes, and every card is drawn again
const DRAW = 7500;                    // ms a picture's request waits to be drawn; past it the site's card goes out, this once
const TAKES = 3000;                   // ms a drawing usually takes, for judging whether a busy browser's turn comes in time
const KEEP = 60 * 24 * 3600;          // s a picture is kept: a unit shared again after that is drawn again, and old builds' pictures go by themselves
const BLANK = 16000;                  // bytes: a drawn card is four times this or more; a page photographed before it drew is a tenth

export default {
  async fetch(request, env, context) {
    context.passThroughOnException();
    const url = new URL(request.url);
    if (url.pathname.startsWith("/card/")) return picture(request, env, context, url);
    const page = await env.ASSETS.fetch(request);
    const unit = request.method === "GET" ? unitAt(url.pathname) : null;
    if (!unit || page.status !== 200 || !(page.headers.get("content-type") ?? "").includes("text/html")) return page;
    // With ?card the address is the card itself, which the hosted browser opens: it needs no words, only to draw soon.
    if (url.searchParams.has("card")) return ahead(page, unit, context, url.searchParams.get("card") === "circuit");
    try {
      // Discord shows nothing at all for an embed it won't take, so a new one is tried on an address of its own first.
      const embedded = EMBED || url.searchParams.has("discord");
      const has = (circuit) => (draws(env) ? keptCard(env, unit, circuit).then((body) => (void body?.cancel(), body !== null), () => false) : false);
      const [words, kept, wired] = await Promise.all([describe(unit, AbortSignal.timeout(WAIT)), has(false), embedded && has(true)]);
      // A picture not kept yet is named at an address of its own: whoever asks may get the site's card in its place
      // (below) and keep that under the address, which the unit's own card then never has to get past.
      const named = (circuit, there) => `${url.origin}/card${circuit ? "/circuit" : ""}${pathOf(unit)}.webp?v=${versionOf(unit)}${there ? "" : "-new"}`;
      // Discord's embed carries the words itself, so its picture is the unit's connections, where it has any to draw.
      return rewrite(page, words, draws(env) ? named(false, kept) : null, draws(env) && words.embed.circuit ? named(true, wired) : null, embedded ? url.origin : null);
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
/** Text as Discord's Markdown shows it plainly: its marks escaped. */
const md = (text) => String(text).replace(/([\\*_~`|[\]<>#])/g, "\\$1");
/** Tokens as chips: inline code, where nothing needs escaping but the backtick itself. */
const chips = (tokens) => tokens.map((token) => `\`${(tidy(token).trim() || (/[⏎\n]/.test(token) ? "↵" : "␣")).replace(/`/g, "ˋ")}\``).join(" ");
const BRACKETS = { token: (text) => `[${text}]`, key: (text) => `[${text}]`, plain: (text) => text };
const MARKS = { token: (text) => `**${md(text)}**`, key: (text) => `__${md(text)}__`, plain: md };

/** A firing as a line: a few words either side of the token it fired on, which is in brackets. A head's line also
 *  brackets the earlier token it attended to. In English where the catalog has it translated. (With MARKS, for
 *  Discord's Markdown: the token in bold, the attended one underlined.) */
function firing(context, mark = BRACKETS) {
  const text = context?.[1] ?? context?.[0];
  const at = typeof text === "string" ? text.match(/^([\s\S]*)⟦([\s\S]*?)⟧([\s\S]*)$/) : null;
  if (!at || !at[2]) return null;
  const [, before, token, after] = at;
  const open = /^\s/.test(token) || /\s$/.test(before) ? " " : "", close = /\s$/.test(token) || /^\s/.test(after) ? " " : "";
  const key = before.match(/^([\s\S]*)⟪([\s\S]*?)⟫([\s\S]*)$/);
  const words = (part, from, to) => tidy(part).trim().split(" ").filter(Boolean).slice(from, to).join(" ");
  const shown = (part) => tidy(part).trim() || (/[⏎\n]/.test(part) ? "↵" : "");      // a token that is only a line's end
  if (!shown(token)) return null;                                                   // or one with nothing to show
  let lead = mark.plain(words(before.replace(/[⟪⟫]/g, ""), -6));
  if (key && shown(key[2])) {
    const between = tidy(key[3]).trim().split(" ").filter(Boolean);
    const middle = between.length > 4 ? `${between[0]} … ${between[between.length - 1]}` : between.join(" ");
    const gap = (side) => (/\s/.test(side) ? " " : "");
    lead = `${mark.plain(words(key[1], -2))}${gap(key[2].charAt(0) + key[1].slice(-1))}${mark.key(shown(key[2]))}${gap(key[2].slice(-1) + key[3].charAt(0))}${mark.plain(middle)}`;
  }
  const tail = mark.plain(words(after, 0, 3));
  return lead || tail ? `…${lead}${open}${mark.token(shown(token))}${close}${tail}`.trim() : null;
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
  const body = [];       // the same for Discord's embed, in its Markdown
  let what, side = "", wiring = "", foot = "", circuit = true;      // (a head always has connections to draw)

  if (kind === "h") {
    const got = await range(await objectUrl(source, "heads/graph.bin", signal), (layer * model.heads + index) * HEAD_WIRE, HEAD_WIRE, signal);
    if (got.size !== HEAD_WIRE * model.layers * model.heads) throw new Error("heads/graph.bin: another record size");
    const file = await (await get(await objectUrl(source, `heads/L${pad(layer)}.json`, signal), signal)).json();
    const detail = file.heads.find((head) => head.h === index), label = detail?.label ?? {};
    what = record(got.bytes).title || "attention head";
    side = "attention head";
    lines.push([`${where} · attention head`]);
    if (label.attends) lines.push([`Attends to: ${lower(label.attends)}`]), body.push([`**Attends to** ${md(lower(label.attends))}`]);
    const context = lent ? null : detail?.contexts?.[0], example = firing(context);
    if (example) lines.push([`e.g. ${example}`, true]), body.push([`> ${firing(context, MARKS)}`, true]);
    if (label.writes) lines.push([`Writes: ${lower(label.writes)}`]), body.push([`**Writes** ${md(lower(label.writes))}`]);
  } else {
    const url = await objectUrl(source, `neurons/L${pad(layer)}/graph.bin`, signal);
    const got = await Promise.all([range(url, index * WIRE, WIRE, signal), range(url, (index + model.mlp) * WIRE, WIRE, signal)]);
    if (got[0].size !== WIRE * 2 * model.mlp) throw new Error("graph.bin: another record size");
    const poles = got.map((pole) => record(pole.bytes));
    const [{ pack, offset, length }] = poles;
    // Its own connections, not its lender's: the strongest two that drive each side and that each drives, by name.
    const soon = AbortSignal.any([signal, AbortSignal.timeout(WIRED)]);
    const wired = lent ? [[], []] : got.map((pole) => [DRIVEN, DRIVES].map((list) => links(pole.bytes, list, model).slice(0, 2).map((link) => named(link, id, source, model, soon))));
    const [detail] = await Promise.all([
      length ? range(await objectUrl(source, `neurons/L${pad(layer)}/units-${pad(pack)}.bin`, signal), offset, length, signal).then((packed) => inflate(packed.bytes)).then(JSON.parse) : null,
      Promise.allSettled(wired.flat(2)),
    ]);
    // The explorer opens a neuron on its clearer side.
    const at = detail && detail.poles[1].score > detail.poles[0].score && !detail.poles[1].silent ? 1 : 0;
    const pole = detail?.poles[at], label = pole?.label ?? {}, shown = poles[at], other = poles[1 - at];
    side = `${at ? "−" : "＋"} side`;
    lines.push([`${where} · ${at ? "−" : "+"} side`]);
    // A near-silent neuron, or one its record links to nothing, has no circuit to draw.
    circuit = !(pole ? pole.silent : shown.silent) && [DRIVEN, DRIVES].some((list) => links(got[at].bytes, list, model).length > 0);
    if (pole ? pole.silent : shown.silent) {
      what = SILENT;
      lines.push(["Near-silent: it almost never fires."]);
      body.push(["**Near-silent.** It almost never fires."]);
    } else {
      what = shown.title || "neuron";
      lines.push([`Fires on: ${label.fires || shown.title}`]);
      body.push([`**Fires on** ${md(label.fires || shown.title)}`]);
      const peaks = lent ? [] : [...new Set((pole?.peaks ?? []).map(([token]) => token.trim()).filter(Boolean))].slice(0, 5);
      if (peaks.length) body.push([chips(peaks), true]);
      const context = lent ? null : pole?.contexts?.[0], example = firing(context);
      if (example) lines.push([`e.g. ${example}`, true]), body.push([`> ${firing(context, MARKS)}`, true]);
      if (label.writes) lines.push([`Makes the model say: ${label.writes}`]), body.push([`**Makes the model say** ${md(label.writes)}`]);
      const lists = await Promise.all((wired[at] ?? []).map(async (list) => (await Promise.allSettled(list)).filter((row) => row.status === "fulfilled" && row.value).map((row) => row.value)));
      wiring = [["Driven by", lists[0]], ["Drives", lists[1]]].filter(([, rows]) => rows?.length).map(([title, rows]) => `**${title}**\n${rows.join("\n")}`).join("\n");
    }
    if (other.title && !other.silent) lines.push([`${at ? "+" : "−"} side: ${other.title}`, true]), foot = `${at ? "＋" : "−"} side: ${md(other.title)} · `;
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
    alt: `${SITE.name}: ${name} of ${model.name}, ${what}, with the tokens ${kind === "h" ? "it writes" : what === SILENT ? "its weights read" : "it fires on and those it makes the model say"}, and its layer lit in the model's atlas.`,
    // For Discord's embed: where it is, what it is, its lines, its connections, the small print, and where its buttons go.
    embed: { where, what, name: `**${name}** · ${side}`, body, wiring, foot: `${foot}${credit}`, path: `/${id}/L${layer}`, at: `${kind}${index}`, layer, head: kind === "h", circuit },
  };
}

/** A pole's strongest links of one kind, from its record: each the pole it names and whether it pushes against. */
function links(bytes, list, model) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), out = [];
  for (let i = 0; i < PER; i += 1) {
    const at = LINKS + (list * PER + i) * ENTRY, pole = view.getUint32(at, true);
    if (pole === 0xffffffff || pole >= model.layers * 2 * model.mlp) break;
    out.push({ pole, against: (view.getUint16(at + 4, true) & 0x8000) !== 0 });
  }
  return out;
}

/** A linked pole as a line of Discord's Markdown: which way it pushes, its ID as a link to it, and its title. */
async function named({ pole, against }, id, source, model, signal) {
  const layer = Math.floor(pole / (2 * model.mlp)), slot = pole % (2 * model.mlp);
  const { title } = record((await range(await objectUrl(source, `neurons/L${pad(layer)}/graph.bin`, signal), slot * WIRE, WIRE, signal)).bytes);
  return `${against ? "−" : "＋"} [L${layer}·n${slot % model.mlp}](${SITE.origin}/${id}/L${layer}/n${slot % model.mlp})${title ? ` ${md(cut(title, 60))}` : ""}`;
}

/** Discord's component embed for a unit, as the JSON its page carries: what leaves first when it is too long is the
 *  connections, then the lines that can be spared; and if it still is, there is none, since Discord shows nothing at
 *  all for one it can't take. Its keys are Discord's, and one it doesn't know loses the whole embed. */
function component({ accent, alt, embed }, picture, origin) {
  const text = (content) => ({ type: 10, content }), here = `${origin}${embed.path}`;
  const button = (label, url) => ({ type: 2, style: 5, label, url });
  for (const [wiring, spare] of [[true, true], [false, true], [false, false]]) {
    const json = JSON.stringify({ component: { type: 17, accent_color: parseInt(accent.slice(1), 16), components: [
      text(`-# ${md(SITE.name)} · ${md(embed.where)}`),
      text(`## ${md(embed.what)}\n${embed.name}`),
      { type: 12, items: [{ media: { url: picture }, description: alt }] },
      text(embed.body.filter(([, spared]) => spare || !spared).map(([line]) => line).join("\n")),
      ...(wiring && embed.wiring ? [{ type: 14, spacing: 1 }, text(embed.wiring)] : []),
      text(`-# ${embed.foot}`),
      { type: 1, components: [button(embed.head ? "Open head" : "Open neuron", `${here}/${embed.at}`), button("Its graph", `${here}/${embed.at}?graph`), button(`Layer ${embed.layer}`, embed.head ? `${here}/heads` : here)] },
    ] } }).replace(/</g, "\\u003c");
    if (bytes(json) <= COMPONENT) return json;
  }
  return null;
}

/** The page with the unit's words in its head, and its picture where one is drawn; everything else, and every
 *  header, as it was. */
function rewrite(page, words, card, circuit, origin) {
  const content = (value) => ({ element(element) { element.setAttribute("content", value); } });
  const embed = origin ? component(words, circuit ?? card ?? SITE.picture, origin) : null;
  const rewriter = new HTMLRewriter()
    .on("title", { element(element) { element.setInnerContent(words.title); } })
    .on('meta[name="description"]', content(words.summary))
    .on('meta[property="og:title"]', content(words.heading))
    .on('meta[property="og:description"]', content(words.description))
    // Discord takes the page's last theme-color; the two with a media query are the browser's.
    .on('meta[name="theme-color"]', { element(element) { if (!element.getAttribute("media")) element.setAttribute("content", words.accent); } });
  // The unit's card is the size and kind of the site's, so the tags that say those stand.
  if (card) rewriter.on('meta[property="og:image"]', content(card)).on('meta[property="og:image:alt"]', content(words.alt)).on('meta[name="twitter:image:alt"]', content(words.alt));
  // A data block, which no browser runs (so the page's CSP has nothing to say about it), in the head, where Discord looks.
  if (embed) rewriter.on("head", { element(element) { element.append(`<script id="discord:component-embed" type="application/json">${embed}</script>`, { html: true }); } });
  return rewriter.transform(page);
}

// ---------- the picture: a unit's own card, drawn the first time it is asked for and kept
//
// A unit's page names /card/<its address>.webp as its picture, and in Discord's embed /card/circuit/<its address>.webp,
// the card of its connections (?card=circuit), drawn and kept the same way. The first request for it has Cloudflare's hosted
// browser (Browser Run's screenshot endpoint) open the unit's address with ?card, which draws the card and nothing
// else, and photograph it; the photograph is kept and goes out to whoever asked. Every later request is served what
// was kept, so a unit costs the hosted browser's time once per catalog build (and again if it is shared after KEEP).
// If the browser is slow, busy (the free plan takes one request every ten seconds) or out of its day's minutes, the
// site's card goes out instead, uncached, and a drawing still under way is kept for the next request.
//
// Pictures are kept in Workers KV, not R2 beside the catalog: KV's free plan holds 1 GB (some ten thousand cards, at
// about 100 kB each) and a thousand writes a day, more than the hosted browser's free ten minutes a day can draw,
// where the catalog already fills R2's free 10 GB. KV may take a minute to show a new picture everywhere; one asked for
// meanwhile from elsewhere is drawn twice, no worse.
//
// A drawing is some seconds of the hosted browser, most of them the card page loading, so that page is helped along
// (`ahead`, below) and the photograph is taken the moment the page says it is drawn. It is a WebP at quality 75: two
// thirds of a neuron's card is the fine grain of the atlas, which costs 45% more at 90 for no difference to the eye.
//
// The project sets this up in its settings, and until it does every unit keeps the site's card: a KV namespace bound
// as CARDS, the account's ID as BROWSER_ACCOUNT, and as the secret BROWSER_TOKEN an API token allowed Browser Run - Edit.

const draws = (env) => Boolean(env.CARDS && env.BROWSER_ACCOUNT && env.BROWSER_TOKEN);
const pathOf = ({ id, layer, kind, index }) => `/${id}/L${layer}/${kind}${index}`;
/** What a unit's card was drawn from: the card's look and the builds it reads (its own and, for a base model, the
 *  one its labels come from). Another of either is another picture, at another address and under another key. */
const versionOf = ({ id, model }) => [DRAWN, SITE.builds[id], model.labels && model.labels !== id ? SITE.builds[model.labels] : ""].filter(Boolean).join("-");
const keyOf = (unit, circuit = false) => `${versionOf(unit)}${circuit ? "/circuit" : ""}${pathOf(unit)}.webp`;
/** A unit's kept picture as a stream (to send, or to cancel when only asking whether there is one: KV has no other
 *  way to ask), or null. */
const keptCard = (env, unit, circuit = false) => env.CARDS.get(keyOf(unit, circuit), "stream");
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

async function picture(request, env, context, url) {
  const [, wired, path] = url.pathname.match(PICTURE) ?? [], circuit = Boolean(wired);
  const unit = path && (request.method === "GET" || request.method === "HEAD") ? unitAt(path) : null;
  if (!unit) return new Response("No such card.\n", { status: 404, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
  const drawn = (body, keep = "public, max-age=31536000, immutable") => new Response(body, { headers: { "content-type": "image/webp", "cache-control": keep, "x-content-type-options": "nosniff" } });
  // Another card under this address, for now, kept by no one, so the unit's own takes its place once drawn: for its
  // circuit, the card of what it is, if that is already kept; else the site's card.
  const instead = async () => {
    const other = circuit && draws(env) ? await keptCard(env, unit).catch(() => null) : null;
    if (other) return drawn(other, "no-store");
    const card = await env.ASSETS.fetch(new URL("/card.webp", url));
    const headers = new Headers(card.headers);
    headers.set("cache-control", "no-store");
    return new Response(card.body, { status: card.status, headers });
  };
  try {
    if (!draws(env)) return await instead();
    const key = keyOf(unit, circuit), kept = await keptCard(env, unit, circuit);
    if (kept) return drawn(kept);
    // Drawn here, and kept whether or not this request waits for it (it goes out as soon as it is drawn, and is put
    // away after). A busy browser (it takes one request every ten seconds on the free plan, so two new units shared
    // together collide) is asked again when it says its turn comes, twice at most: within this request if that still
    // leaves time to draw, and otherwise behind it, `late` letting the site's card go out at once.
    let late;
    const turned = new Promise((resolve) => { late = resolve; });
    const page = `${url.origin}${pathOf(unit)}?${circuit ? "card=circuit" : unit.kind === "n" ? "all&card" : "card"}`, asked = Date.now();
    const drawing = (async () => {
      for (let tries = 0; ; tries += 1) {
        const shot = await photograph(env, page);
        if (shot.bytes) return shot.bytes;
        if (!shot.again || tries === 2) throw new Error(shot.error ?? "the hosted browser stayed busy");
        if (Date.now() - asked + shot.again + TAKES > DRAW) late();
        await sleep(shot.again);
      }
    })();
    context.waitUntil(drawing.then((bytes) => env.CARDS.put(key, bytes, { expirationTtl: KEEP })).catch((error) => console.log(`card ${key}: ${error.message}`)));
    const bytes = await Promise.race([drawing.catch(() => null), turned.then(() => null), sleep(DRAW).then(() => null)]);
    return bytes ? drawn(bytes) : await instead();
  } catch {
    return instead();
  }
}

/** The card page with its needs named ahead of it, so the browser fetches them while the page's script is still on
 *  its way: the card's own chunk and style (behind a dynamic import), the build's manifest, and the catalog files a
 *  card reads first, which the page could only ask for once the script, the chunk and the manifest were all in,
 *  one after another. (The files by name only where this worker already holds the build's manifest; else it fetches
 *  it for the next card.) Measured on a neuron's card, it is drawn in about half the time. */
function ahead(page, unit, context, circuit) {
  const { id, kind, layer } = unit, fetched = (url) => `<${url}>; rel=preload; as=fetch; crossorigin`;
  // (The style as Vite's loader will ask for it, without credentials, or the browser fetches it a second time.)
  const links = SITE.card.map((path) => (path.endsWith(".js") ? `<${path}>; rel=modulepreload` : `<${path}>; rel=preload; as=style; crossorigin`));
  links.push(fetched(`${SITE.catalog}/${id}/${SITE.builds[id]}.json`));
  const manifest = manifests.get(id);
  // (A neuron's circuit has no atlas, so neither every neuron's score nor its layer's list; its links are read by range.)
  const files = kind === "h" ? ["index.json", "vocab.json", "heads/index.json", `heads/L${pad(layer)}.json`] : circuit ? ["index.json", "vocab.json"] : ["index.json", "vocab.json", "scores.json", `neurons/L${pad(layer)}/index.json`];
  if (manifest) links.push(...files.filter((path) => manifest[path]).map((path) => fetched(`${SITE.catalog}/o/${manifest[path]}`)));
  else context.waitUntil(objectUrl(id, files[0], AbortSignal.timeout(WAIT)).catch(() => {}));
  const headers = new Headers(page.headers);
  headers.append("link", links.join(", "));
  return new Response(page.body, { status: page.status, headers });
}

/** The hosted browser's photograph of a page, taken once the page says it is drawn (LinkCard.svelte's data-card):
 *  its bytes; or how long to wait before asking again, when the browser takes no request yet; or why there is none.
 *  The photograph must be more than an empty page's: a browser that didn't wait for the page's word (Cloudflare's
 *  own playground doesn't) would photograph a blank page, and that is never kept as a unit's card. */
async function photograph(env, page) {
  const response = await fetch(`${env.BROWSER_API ?? "https://api.cloudflare.com/client/v4"}/accounts/${env.BROWSER_ACCOUNT}/browser-run/screenshot`, {
    method: "POST",
    headers: { authorization: `Bearer ${env.BROWSER_TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify({
      url: page,
      viewport: { width: 1200, height: 630, deviceScaleFactor: 2 },
      waitForSelector: { selector: '[data-card="drawn"]', timeout: 15000 },
      screenshotOptions: { type: "webp", quality: 75 },
    }),
    signal: AbortSignal.timeout(25000),
  });
  if (response.ok && (response.headers.get("content-type") ?? "").startsWith("image/")) {
    const bytes = await response.arrayBuffer();
    return bytes.byteLength > BLANK ? { bytes } : { error: `the hosted browser's photograph is ${bytes.byteLength} bytes: a blank page` };
  }
  const said = (await response.text()).slice(0, 300);
  // One request every ten seconds on the free plan: worth one more try. Out of the day's browser time: not until tomorrow.
  if (response.status === 429 && !/limit exceeded for today/i.test(said)) return { again: Math.min(15, Number(response.headers.get("retry-after")) || 10) * 1000 };
  return { error: `the hosted browser answered ${response.status}: ${said}` };
}
