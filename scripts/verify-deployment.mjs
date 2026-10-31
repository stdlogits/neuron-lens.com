#!/usr/bin/env node
// Checks a deployed neuron-lens.com: every path answers as Cloudflare Pages should serve this build,
// with the headers public/_headers sets and the files the site serves about itself, and the explorer
// shows images and plays sounds under that CSP (the dev server sends no CSP, so only a deployed site
// can fail that way).
//
//   node scripts/verify-deployment.mjs [origin]      default https://neuron-lens.com
//     --build dist     also require the live page to be this local build (scripts/deploy.sh passes it)
//     --http-only      skip the browser smoke
//     --browser-only   run only the browser smoke
//
// The HTTP checks are about how the site is served and should stay put. The browser smoke depends on
// the explorer's markup; its selectors are the constants under "Browser smoke" below.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(import.meta.url), "../..");
const DEFAULT_ORIGIN = "https://neuron-lens.com";

// ---------- _headers, as Cloudflare Pages applies it

/** Parses public/_headers into rules: { path, set: [name, value][], unset: name[] }. */
export function parseHeadersFile(text) {
  const rules = [];
  let rule = null;
  for (const [number, raw] of text.split("\n").entries()) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    if (line.startsWith("/")) {
      rule = { path: line, set: [], unset: [] };
      rules.push(rule);
      continue;
    }
    assert.ok(rule, `_headers line ${number + 1}: a header before any path`);
    assert.ok(!/^[a-z]+:\/\//i.test(line), `_headers line ${number + 1}: host rules aren't supported here`);
    if (line.startsWith("! ")) {
      rule.unset.push(line.slice(2).trim().toLowerCase());
      continue;
    }
    const colon = line.indexOf(":");
    assert.ok(colon > 0, `_headers line ${number + 1}: expected "Name: value"`);
    rule.set.push([line.slice(0, colon).trim().toLowerCase(), line.slice(colon + 1).trim()]);
  }
  return rules;
}

/** A Pages path pattern as a regular expression: * is a splat, :name a placeholder for one segment. */
function patternOf(path) {
  const source = path.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/:[A-Za-z]\w*/g, "[^/]+");
  return new RegExp(`^${source}$`);
}

/** The headers _headers gives a path: each matching rule in order removes its "! Name" headers, then
 * sets its own, joining with a comma any that an earlier rule set and didn't remove. */
export function headersFor(rules, pathname) {
  const out = new Map();
  for (const rule of rules) {
    if (!patternOf(rule.path).test(pathname)) continue;
    for (const name of rule.unset) out.delete(name);
    for (const [name, value] of rule.set) out.set(name, out.has(name) ? `${out.get(name)}, ${value}` : value);
  }
  return out;
}

export function parseCsp(value) {
  const directives = new Map();
  for (const part of value.split(";")) {
    const [name, ...tokens] = part.trim().split(/\s+/);
    if (name) directives.set(name.toLowerCase(), tokens);
  }
  return directives;
}

function cspDifference(expected, actual) {
  const want = parseCsp(expected);
  const got = parseCsp(actual);
  const lines = [];
  for (const name of new Set([...want.keys(), ...got.keys()])) {
    const a = (want.get(name) ?? []).join(" ");
    const b = (got.get(name) ?? []).join(" ");
    if (a !== b) lines.push(`  ${name}: expected "${a || "(absent)"}", got "${b || "(absent)"}"`);
  }
  return lines.join("\n") || "  (same directives, different spelling or order)";
}

/** Every header _headers sets for the path is on the response, exactly. */
export function assertHeaders(response, rules, pathname = new URL(response.url).pathname) {
  for (const [name, expected] of headersFor(rules, pathname)) {
    const actual = response.headers.get(name);
    assert.ok(actual !== null, `${pathname}: no ${name} header`);
    if (name === "content-security-policy" && actual !== expected) {
      assert.fail(`${pathname}: the CSP differs from public/_headers\n${cspDifference(expected, actual)}`);
    }
    assert.equal(actual, expected, `${pathname}: ${name}`);
  }
}

// ---------- HTTP checks

function mime(response) {
  return (response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
}

async function get(origin, path, headers = {}) {
  return fetch(new URL(path, origin), { headers, redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(30_000) });
}

const assetRefs = (html) => [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((match) => match[1]).sort();

const startsWith = (bytes, text, at = 0) => [...text].every((char, i) => bytes[at + i] === char.charCodeAt(0));

export async function checkHtml(origin, rules, buildDir) {
  const paths = ["/", "/qwen3-8b/L8/n344", "/gemma-4-12b/L33/heads", "/about", `/no-such-page-${crypto.randomUUID().slice(0, 8)}`];
  const bodies = [];
  for (const path of paths) {
    const response = await get(origin, path);
    assert.equal(response.status, 200, `${path}: HTTP ${response.status} (every path without a file is the app)`);
    assert.equal(mime(response), "text/html", `${path}: ${mime(response)}`);
    assertHeaders(response, rules, path);
    bodies.push(await response.text());
  }
  const [html] = bodies;
  assert.ok(html.includes('id="app"'), "/ is not the app's index.html");
  for (const [i, body] of bodies.entries()) assert.equal(body, html, `${paths[i]} serves another page than /`);
  // The CSP allows no inline script: anything injected into the page (Cloudflare's analytics beacon,
  // Rocket Loader, email obfuscation) would be blocked, so the zone must leave HTML alone. The JSON-LD
  // is a data block, which never runs.
  const inline = [...html.matchAll(/<script\b(?![^>]*\bsrc=)(?![^>]*\btype="application\/ld\+json")[^>]*>/gi)];
  assert.equal(inline.length, 0, `/ has ${inline.length} inline script(s), which the CSP blocks`);
  assert.ok(html.includes('<script type="application/ld+json">'), "/ has no JSON-LD");
  const card = html.match(/<meta property="og:image" content="([^"]+)"/)?.[1];
  assert.ok(card && SITE_FILES.some(([path]) => new URL(card).pathname === path), `/'s og:image (${card}) is none of the site's files`);
  const refs = assetRefs(html);
  assert.ok(refs.some((ref) => ref.endsWith(".js")), "/ references no /assets/*.js");

  if (buildDir) {
    const local = assetRefs(await readFile(resolve(buildDir, "index.html"), "utf8"));
    assert.deepEqual(refs, local, `the live / is another build than ${buildDir} (its assets differ)`);
  }
  return html;
}

// What the site serves about itself: the mark and the card (public/, drawn by scripts/site/render.mjs)
// and what scripts/site/meta.ts writes into the build.
const SITE_FILES = [
  ["/favicon.svg", ["image/svg+xml"]],
  ["/favicon.ico", ["image/x-icon", "image/vnd.microsoft.icon"]],
  ["/apple-touch-icon.png", ["image/png"]],
  ["/icon-192.png", ["image/png"]],
  ["/icon-512.png", ["image/png"]],
  ["/icon-maskable-512.png", ["image/png"]],
  ["/card.png", ["image/png"]],
  ["/manifest.webmanifest", ["application/manifest+json"]],
  ["/llms.txt", ["text/plain", "text/markdown"]],
  ["/sitemap.xml", ["application/xml", "text/xml"]],
];

export async function checkAssets(origin, rules, html, buildDir) {
  const refs = assetRefs(html);
  for (const ext of [".js", ".css"]) {
    const path = refs.find((ref) => ref.endsWith(ext));
    if (!path) continue;
    const response = await get(origin, path);
    assert.equal(response.status, 200, `${path}: HTTP ${response.status}`);
    assert.ok(ext === ".js" ? ["text/javascript", "application/javascript"].includes(mime(response)) : mime(response) === "text/css", `${path}: ${mime(response)}`);
    assert.match(response.headers.get("cache-control") ?? "", /\bimmutable\b/, `${path}: not immutable`);
    assertHeaders(response, rules, path);
    assert.ok((await response.arrayBuffer()).byteLength > 0, `${path} is empty`);
  }
  const theme = await get(origin, "/theme-preflight.js");
  assert.equal(theme.status, 200, `/theme-preflight.js: HTTP ${theme.status}`);
  assert.ok(["text/javascript", "application/javascript"].includes(mime(theme)), `/theme-preflight.js: ${mime(theme)}`);
  await theme.body?.cancel();

  const robots = await get(origin, "/robots.txt");
  assert.equal(robots.status, 200, `/robots.txt: HTTP ${robots.status}`);
  assert.equal(await robots.text(), await readFile(resolve(root, "public/robots.txt"), "utf8"), "/robots.txt differs from public/robots.txt");

  for (const [path, types] of SITE_FILES) {
    const response = await get(origin, path);
    assert.equal(response.status, 200, `${path}: HTTP ${response.status}`);
    assert.ok(types.includes(mime(response)), `${path}: ${mime(response)}`);
    if (path.endsWith(".txt")) assert.match(response.headers.get("content-type") ?? "", /charset=utf-8/i, `${path}: not UTF-8`);
    assertHeaders(response, rules, path);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (buildDir) assert.ok(bytes.equals(await readFile(resolve(buildDir, path.slice(1)))), `${path} differs from ${buildDir}`);
    else assert.ok(bytes.length > 0, `${path} is empty`);
  }
}

export async function checkData(origin, rules) {
  for (const model of ["qwen3-8b", "gemma-4-12b"]) {
    const path = `/data/${model}/index.json`;
    const response = await get(origin, path);
    assert.equal(response.status, 200, `${path}: HTTP ${response.status}`);
    assert.equal(mime(response), "application/json", `${path}: ${mime(response)}`);
    assertHeaders(response, rules, path);
    const index = await response.json();
    assert.equal(index.id, model, `${path} names model ${index.id}`);
    assert.ok(Array.isArray(index.neurons) && index.neurons.length > 0, `${path} lists no neurons`);
  }
  // public/data/404.html makes missing data a 404 rather than the app.
  const path = `/data/qwen3-8b/neurons/L08/missing-${crypto.randomUUID().slice(0, 8)}.json`;
  const missing = await get(origin, path);
  assert.equal(missing.status, 404, `${path}: HTTP ${missing.status}, expected 404`);
  assert.ok(!(await missing.text()).includes('id="app"'), `${path} answered with the app`);
}

/** One image and one sound, cut from their packs by HTTP range as the explorer does. */
export async function checkMediaRanges(origin, rules) {
  for (const [modality, looks] of [
    ["image", (bytes) => startsWith(bytes, "RIFF") && startsWith(bytes, "WEBP", 8)],
    ["audio", (bytes) => startsWith(bytes, "ID3") || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)],
  ]) {
    // hosted.json (scripts/neurons/media.py) maps each shown document to [pack, offset, length].
    const map = await get(origin, `/data/gemma-4-12b/media/${modality}/hosted.json`);
    let range = [0, 0, 1024];
    let checkBytes = false;
    if (map.ok) {
      const first = Object.values(await map.json()).find(([pack]) => pack === 0);
      if (first) [range, checkBytes] = [first, true];
    } else await map.body?.cancel();
    const [pack, offset, length] = range;
    const path = `/data/gemma-4-12b/media/${modality}/p${String(pack).padStart(3, "0")}.bin`;
    const response = await get(origin, path, { Range: `bytes=${offset}-${offset + length - 1}` });
    assert.equal(response.status, 206, `${path}: HTTP ${response.status} to a Range request, expected 206`);
    assert.match(response.headers.get("content-range") ?? "", new RegExp(`^bytes ${offset}-${offset + length - 1}/\\d+$`), `${path}: Content-Range`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    assert.equal(bytes.length, length, `${path}: ${bytes.length} bytes for a range of ${length}`);
    if (checkBytes) assert.ok(looks(bytes), `${path}: the bytes at ${offset} aren't a ${modality === "image" ? "WebP" : "MP3"}`);
    assertHeaders(response, rules, path);
  }
}

// ---------- Browser smoke

// A Gemma 4 neuron whose top images and sounds include ones this site hosts.
const SMOKE_PATH = "/gemma-4-12b/L33/n12225";
const IMAGE = 'img[src^="blob:"]';
const AUDIO = 'audio[src^="blob:"]';
// A clip from a media pack, not the optimised sound (made in the page as a WAV).
const PLAY_BUTTON = /^play (?!the sound optimised)/i;

export async function browserSmoke(origin) {
  const { chromium } = await import("@playwright/test");
  const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
  const problems = [];
  try {
    const page = await browser.newPage();
    await page.addInitScript(() => {
      const w = /** @type {any} */ (window);
      w.__csp = [];
      w.__plays = [];
      document.addEventListener("securitypolicyviolation", (event) => w.__csp.push(`${event.effectiveDirective} blocked ${event.blockedURI || "inline"}`));
      // Sounds may play from elements outside the document (new Audio()), so note every play().
      const play = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function () {
        w.__plays.push(this);
        return play.call(this);
      };
    });
    const consoleErrors = [];
    page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
    page.on("pageerror", (error) => problems.push(`uncaught: ${error.message}`));

    await page.goto(new URL(SMOKE_PATH, origin).href, { waitUntil: "load" });
    await page.waitForFunction(
      (selector) => [...document.querySelectorAll(selector)].some((img) => img.complete && img.naturalWidth > 0),
      IMAGE,
      { timeout: 60_000 },
    ).catch(() => problems.push(`no ${IMAGE} loaded at ${SMOKE_PATH} within 60 s`));

    // A sound: an audio element already in the page, else the first play button. Sound tiles render
    // once their documents load, after the images, so wait for one to appear.
    await page.locator(AUDIO).or(page.getByRole("button", { name: PLAY_BUTTON })).first().waitFor({ timeout: 30_000 }).catch(() => undefined);
    let started = true;
    if (await page.locator(AUDIO).count()) await page.locator(AUDIO).first().evaluate((audio) => { audio.muted = true; return audio.play(); });
    else {
      const button = page.getByRole("button", { name: PLAY_BUTTON }).first();
      if (await button.count()) await button.click();
      else {
        started = false;
        problems.push(`no ${AUDIO} and no play button at ${SMOKE_PATH}`);
      }
    }
    if (started) {
      await page.waitForFunction(
        () => /** @type {any} */ (window).__plays.some((media) => media.src.startsWith("blob:") && !media.error && media.readyState >= 2 && media.currentTime > 0),
        null,
        { timeout: 20_000 },
      ).then(async () => {
        const played = await page.evaluate(() => /** @type {any} */ (window).__plays.map((m) => `${m.duration.toFixed(2)} s`));
        console.log(`      played a sound (${played.join(", ")})`);
      }, async () => {
        const state = await page.evaluate(() => /** @type {any} */ (window).__plays.map((m) => `${m.src.slice(0, 30)} ready=${m.readyState} t=${m.currentTime} error=${m.error?.code ?? "none"}`));
        problems.push(`no blob: sound played within 20 s (${state.join("; ") || "play() never called"})`);
      });
    }

    const csp = await page.evaluate(() => /** @type {any} */ (window).__csp);
    for (const violation of csp) problems.push(`CSP: ${violation}`);
    for (const text of consoleErrors) {
      if (/Content Security Policy|Refused to/i.test(text)) problems.push(`console: ${text}`);
      else console.warn(`  console error (not failing): ${text}`);
    }
  } finally {
    await browser.close();
  }
  assert.equal(problems.length, 0, problems.join("\n"));
}

// ---------- main

function options(argv) {
  const out = { origin: DEFAULT_ORIGIN, build: null, http: true, browser: true };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--build") out.build = argv[++i];
    else if (arg === "--http-only") out.browser = false;
    else if (arg === "--browser-only") out.http = false;
    else if (arg === "--help" || arg === "-h") { console.log(readUsage()); process.exit(0); }
    else if (arg.startsWith("-")) throw new Error(`unknown option ${arg}`);
    else out.origin = arg;
  }
  const url = new URL(out.origin);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  assert.ok(url.protocol === "https:" || local, "the origin must be https (or a local server)");
  assert.ok(url.pathname === "/" && !url.search && !url.hash, "pass an origin, not a page");
  out.origin = url.origin;
  return out;
}

async function waitForBuild(origin, buildDir, seconds = 120) {
  const local = assetRefs(await readFile(resolve(buildDir, "index.html"), "utf8")).join(" ");
  for (let waited = 0; waited < seconds; waited += 5) {
    const response = await get(origin, "/").catch(() => null);
    if (response?.ok && assetRefs(await response.text()).join(" ") === local) return;
    if (waited === 0) console.log(`waiting up to ${seconds} s for ${origin} to serve ${buildDir}`);
    await new Promise((done) => setTimeout(done, 5_000));
  }
}

function readUsage() {
  return "node scripts/verify-deployment.mjs [origin] [--build dist] [--http-only | --browser-only]";
}

async function main() {
  const opts = options(process.argv.slice(2));
  const rules = parseHeadersFile(await readFile(resolve(root, "public/_headers"), "utf8"));
  const steps = [];
  let html = "";
  if (opts.http) {
    steps.push(
      ["HTML and its headers", async () => { html = await checkHtml(opts.origin, rules, opts.build); }],
      ["assets, theme-preflight.js, robots.txt, the site's files", () => checkAssets(opts.origin, rules, html, opts.build)],
      ["catalog JSON and missing data", () => checkData(opts.origin, rules)],
      ["media packs by range", () => checkMediaRanges(opts.origin, rules)],
    );
  }
  if (opts.browser) steps.push(["browser smoke: images, a sound, no CSP violation", () => browserSmoke(opts.origin)]);

  // Just after an upload the domain may still serve the last build for a moment.
  if (opts.http && opts.build) await waitForBuild(opts.origin, opts.build);

  let failed = 0;
  for (const [name, run] of steps) {
    try {
      await run();
      console.log(`ok    ${name}`);
    } catch (error) {
      failed += 1;
      console.log(`FAIL  ${name}\n${String(error instanceof Error ? error.message : error).replace(/^/gm, "      ")}`);
    }
  }
  console.log(failed ? `\n${failed} of ${steps.length} failed at ${opts.origin}` : `\nall ${steps.length} passed at ${opts.origin}`);
  process.exitCode = failed ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
