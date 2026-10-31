// How the site describes itself to search engines, link previews and language models, written at
// build: the head's tags and JSON-LD, a summary in #app for readers that run no script (main.ts
// clears it as the app mounts), /llms.txt (from llms.md), /sitemap.xml and the web app manifest.
// The models' facts come from src/lib/models.ts and the name and address from src/lib/site.ts, so
// none of it can drift from the explorer. Every view is drawn in the browser; no unit's data is
// written here.
/// <reference types="node" />
import { readFileSync } from "node:fs";
import type { HtmlTagDescriptor, Plugin } from "vite";
import { DEFAULT_MODEL, MODELS, MODEL_ORDER, bandRange, type LabelCheck, type ModelId } from "../../src/lib/models.ts";
import { ORIGIN, SITE_NAME } from "../../src/lib/site.ts";

const DESCRIPTION = `What each neuron and attention head inside ${MODELS["qwen3-8b"].name} and ${MODELS["gemma-4-12b"].name} responds to, and what it makes the model say.`;
const CATALOG = "https://huggingface.co/datasets/stdlogits/neuron-lens";
const RESEARCH = "https://github.com/stdlogits/neuron-lens";
const LENSES = "https://huggingface.co/stdlogits/rs-lenses";
const SOURCE = "https://github.com/stdlogits/neuron-lens.com";
const MODEL_PAGES: Record<ModelId, string> = {
  "qwen3-8b": "https://huggingface.co/Qwen/Qwen3-8B",
  "gemma-4-12b": "https://huggingface.co/google/gemma-4-12B",
};
// public/card.png, drawn by scripts/site/render.mjs.
const CARD = {
  url: `${ORIGIN}/card.png`,
  width: 2400,
  height: 1260,
  alt: "Neuron Lens: neuron 344 of layer 8 in Qwen3-8B fires on owls and writes owl, noct, night and bedtime, above the atlas of the model's 36 layers.",
};

const count = (n: number) => n.toLocaleString("en-US");
const neurons = (id: ModelId) => MODELS[id].layers * MODELS[id].mlp;
const heads = (id: ModelId) => MODELS[id].layers * MODELS[id].heads;

// ---------- JSON-LD

const A9LIM = { "@type": "Person", "@id": "https://a9l.im/#person", name: "a9lim", url: "https://a9l.im/", sameAs: ["https://github.com/a9lim", "https://x.com/_a9lim"] };
const TREETOWN = { "@type": "Person", "@id": `${ORIGIN}/#treetown`, name: "treetown", url: "https://logits.ml", sameAs: ["https://x.com/treetowntree"] };
const STDLOGITS = { "@type": "Organization", "@id": `${ORIGIN}/#stdlogits`, name: "Standard Logits", url: "https://github.com/stdlogits", sameAs: ["https://huggingface.co/stdlogits"] };
const CREDIT = "Made by a9lim and treetown with Claude (Anthropic). Labels and translations by Claude Haiku 5.5.";
const creators = [{ "@id": A9LIM["@id"] }, { "@id": TREETOWN["@id"] }];

function jsonLd() {
  const models = MODEL_ORDER.map((id) => MODELS[id]);
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${ORIGIN}/#website`,
        url: `${ORIGIN}/`,
        name: SITE_NAME,
        description: DESCRIPTION,
        inLanguage: "en",
        creator: creators,
        publisher: { "@id": STDLOGITS["@id"] },
        creditText: CREDIT,
      },
      {
        "@type": "WebApplication",
        "@id": `${ORIGIN}/#explorer`,
        url: `${ORIGIN}/`,
        name: SITE_NAME,
        description: DESCRIPTION,
        image: CARD.url,
        applicationCategory: "EducationalApplication",
        operatingSystem: "Any",
        browserRequirements: "Requires JavaScript",
        isAccessibleForFree: true,
        isPartOf: { "@id": `${ORIGIN}/#website` },
        about: { "@id": CATALOG },
        creator: creators,
        license: "https://www.gnu.org/licenses/agpl-3.0.html",
        codeRepository: SOURCE,
        creditText: CREDIT,
      },
      {
        "@type": "Dataset",
        "@id": CATALOG,
        url: CATALOG,
        name: "neuron-lens",
        alternateName: "The Neuron Lens catalog",
        description: `Every MLP neuron and attention head of ${models.map((m) => `${m.name} (${count(neurons(m.id))} neurons, ${count(heads(m.id))} heads)`).join(" and ")}, read three ways: from the weights through the R-lens and S-lens, from activations over 15M tokens of web, Chinese, Python and chat text, and from the exact tokens that drive each unit. Gemma 4 12B's neurons are also read through 49,694 images and 46,932 sounds. Every neuron pole and head has labels in words by Claude Haiku 5.5.`,
        keywords: ["mechanistic interpretability", "neurons", "attention heads", "language models", "logit lens", "Jacobian lens", "R-lens", "S-lens", ...models.map((m) => m.name)],
        license: "https://creativecommons.org/licenses/by/4.0/",
        isAccessibleForFree: true,
        creator: creators,
        publisher: { "@id": STDLOGITS["@id"] },
        creditText: CREDIT,
        isBasedOn: models.map((m) => MODEL_PAGES[m.id]),
        citation: RESEARCH,
        measurementTechnique: ["R-lens and S-lens reads of weights", "activation statistics over 15M tokens", "exact token drivers by substitution", "labels by Claude Haiku 5.5, checked blind"],
        variableMeasured: ["weight-only lens reads", "activations and top contexts", "exact token drivers", "legibility tests", "labels"],
        distribution: [{ "@type": "DataDownload", contentUrl: CATALOG, encodingFormat: "application/vnd.apache.parquet" }],
        isPartOf: { "@type": "CreativeWork", url: RESEARCH, name: "neuron-lens" },
        hasPart: [{ "@type": "CreativeWork", url: LENSES, name: "rs-lenses", description: "The R-lens and S-lens for both models", license: "https://creativecommons.org/licenses/by/4.0/" }],
      },
      A9LIM,
      TREETOWN,
      STDLOGITS,
    ],
  };
}

// ---------- the head

function headTags(): HtmlTagDescriptor[] {
  const meta = (attrs: Record<string, string>): HtmlTagDescriptor => ({ tag: "meta", attrs, injectTo: "head" });
  const link = (attrs: Record<string, string>): HtmlTagDescriptor => ({ tag: "link", attrs, injectTo: "head" });
  return [
    meta({ name: "description", content: DESCRIPTION }),
    meta({ name: "robots", content: "index, follow, max-image-preview:large, max-snippet:-1" }),
    meta({ name: "author", content: "a9lim, treetown" }),
    // No og:url: every address is served this one page, and link previews should name the one shared.
    meta({ property: "og:type", content: "website" }),
    meta({ property: "og:site_name", content: SITE_NAME }),
    meta({ property: "og:title", content: SITE_NAME }),
    meta({ property: "og:description", content: DESCRIPTION }),
    meta({ property: "og:locale", content: "en_US" }),
    meta({ property: "og:image", content: CARD.url }),
    meta({ property: "og:image:type", content: "image/png" }),
    meta({ property: "og:image:width", content: String(CARD.width) }),
    meta({ property: "og:image:height", content: String(CARD.height) }),
    meta({ property: "og:image:alt", content: CARD.alt }),
    meta({ name: "twitter:card", content: "summary_large_image" }),
    meta({ name: "twitter:image:alt", content: CARD.alt }),
    link({ rel: "icon", href: "/favicon.ico", sizes: "32x32" }),
    link({ rel: "icon", href: "/favicon.svg", type: "image/svg+xml" }),
    link({ rel: "apple-touch-icon", href: "/apple-touch-icon.png" }),
    link({ rel: "manifest", href: "/manifest.webmanifest" }),
    link({ rel: "alternate", type: "text/markdown", href: "/llms.txt", title: "Neuron Lens, for language models" }),
    // A data block, not a script: the CSP's script-src doesn't apply to it.
    { tag: "script", attrs: { type: "application/ld+json" }, children: JSON.stringify(jsonLd()).replace(/</g, "\\u003c"), injectTo: "head" },
  ];
}

/** What a reader that runs no script finds at any address. */
function summary() {
  return `<div class="summary">
        <h1>${SITE_NAME}</h1>
        <p>${DESCRIPTION}</p>
        <p>Every address names a view: /qwen3-8b/L8/n344 is neuron 344 of layer 8 in Qwen3-8B, and /gemma-4-12b/L35/h14 head 14 of layer 35 in Gemma 4 12B. The explorer draws them in the browser, with JavaScript.</p>
        <ul>
          <li><a class="prose-link" href="/llms.txt">Neuron Lens for language models</a>: the models, the lenses, the evidence, the labels and the findings</li>
          <li><a class="prose-link" href="${CATALOG}">The catalog</a> on Hugging Face, every unit's data</li>
          <li><a class="prose-link" href="${RESEARCH}">Research and findings</a></li>
          <li><a class="prose-link" href="/about">About</a> and <a class="prose-link" href="/credits">Credits</a></li>
        </ul>
      </div>`;
}

// ---------- llms.txt

function check(what: string, c: LabelCheck | null, kind: string) {
  if (!c) return `- ${what}: not checked yet.`;
  const note = c.note ? ` ${c.note}` : "";
  return `- ${what} (${c.count} ${kind}): firing labels pick out held-out top firings at AUROC ${c.fires[0].toFixed(2)} (another unit's label: ${c.fires[1].toFixed(2)}); a judge picks the write label out of four ${Math.round(c.writes[0] * 100)}% of the time (chance ${Math.round(c.writes[1] * 100)}%).${note}`;
}

function llms() {
  const models = MODEL_ORDER.map((id) => MODELS[id]);
  const fill: Record<string, string> = {
    description: DESCRIPTION,
    models: [
      "| model | layers | neurons a layer | heads a layer | neurons | heads |",
      "| --- | --- | --- | --- | --- | --- |",
      ...models.map((m) => `| [${m.name}](${MODEL_PAGES[m.id]}) | ${m.layers} | ${count(m.mlp)} | ${m.heads} | ${count(neurons(m.id))} | ${count(heads(m.id))} |`),
    ].join("\n"),
    checks: models.flatMap((m) => [check(`${m.name} neurons`, m.labelChecks.neurons, "poles"), check(`${m.name} heads`, m.labelChecks.heads, "heads")]).join("\n"),
    depth: models
      .map((m) => [`- ${m.name}, ${m.layers} layers:`, ...m.bands.map((b) => `  - ${bandRange(b)}, ${b.name.toLowerCase()}: ${b.summary} ${b.reading}`)].join("\n"))
      .join("\n"),
  };
  return readFileSync(new URL("./llms.md", import.meta.url), "utf8").replace(/\{\{(\w+)\}\}/g, (_: string, key: string) => {
    if (!(key in fill)) throw new Error(`llms.md: nothing fills {{${key}}}`);
    return fill[key];
  });
}

// ---------- sitemap.xml

function sitemap() {
  // The default model's page is /.
  const paths = ["/", "/about", "/credits", ...MODEL_ORDER.flatMap((id) => [...(id === DEFAULT_MODEL ? [] : [`/${id}`]), `/${id}/heads`])];
  const urls = paths.map((path) => `  <url><loc>${ORIGIN}${path}</loc></url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

// ---------- manifest.webmanifest

function manifest() {
  const icon = (src: string, sizes: string, purpose = "any") => ({ src, sizes, type: src.endsWith(".svg") ? "image/svg+xml" : "image/png", purpose });
  return JSON.stringify({
    name: SITE_NAME,
    short_name: SITE_NAME,
    description: DESCRIPTION,
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    lang: "en",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    categories: ["education", "science"],
    icons: [icon("/icon-192.png", "192x192"), icon("/icon-512.png", "512x512"), icon("/icon-maskable-512.png", "512x512", "maskable"), icon("/favicon.svg", "any")],
  }, null, 2) + "\n";
}

// ---------- the plugin

const FILES: Record<string, { type: string; make: () => string }> = {
  "llms.txt": { type: "text/markdown; charset=utf-8", make: llms },
  "sitemap.xml": { type: "application/xml; charset=utf-8", make: sitemap },
  "manifest.webmanifest": { type: "application/manifest+json", make: manifest },
};

export function siteMeta(): Plugin {
  return {
    name: "neuron-lens:site-meta",
    transformIndexHtml(html) {
      const app = '<div id="app"></div>';
      if (!html.includes(app)) throw new Error(`index.html: no ${app} for the summary`);
      return { html: html.replace(app, `<div id="app">\n      ${summary()}\n    </div>`), tags: headTags() };
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const file = FILES[(req.url ?? "").split("?")[0].slice(1)];
        if (!file) return next();
        res.setHeader("Content-Type", file.type);
        res.end(file.make());
      });
    },
    generateBundle() {
      for (const [fileName, file] of Object.entries(FILES)) this.emitFile({ type: "asset", fileName, source: file.make() });
    },
  };
}
