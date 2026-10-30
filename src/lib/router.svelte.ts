// Every view has a path, and the path is the whole state of the explorer:
//   /                              the default model, at its starting layer
//   /gemma-4-12b                   a model
//   /gemma-4-12b/L33               a layer's neurons, easiest first
//   /gemma-4-12b/L33/n12225        a neuron (?all lists every neuron of the layer)
//   /gemma-4-12b/heads             heads, at the model's starting layer for heads
//   /gemma-4-12b/L35/heads         a layer's heads
//   /gemma-4-12b/L35/h14           a head
//   /about, /credits
// Links from drowse.ai's old page (/neuron-lens?model=…&layer=…&neuron=…, redirected here with their
// query) are rewritten to these paths on arrival.
import { DEFAULT_MODEL, MODELS, isModelId, type ModelId } from "./models";
import type { Unit } from "./data";

export interface ExploreRoute {
  page: "explore";
  model: ModelId;
  /** Null: the model's starting layer for the unit. */
  layer: number | null;
  unit: Unit;
  /** The neuron or head; null shows the layer's first. */
  index: number | null;
  /** Neurons only: list every neuron of the layer, not just the easiest. */
  all: boolean;
}
export type Route = ExploreRoute | { page: "about" } | { page: "credits" } | { page: "missing" };

const MISSING: Route = { page: "missing" };

export function parse(pathname: string, search = ""): Route {
  const query = new URLSearchParams(search);
  const parts = pathname.split("/").filter(Boolean).map((part) => decodeURIComponent(part));
  if (parts.length === 0 || (parts.length === 1 && (parts[0] === "neuron-lens" || parts[0] === "neurons"))) return legacy(query);
  if (parts.length === 1 && parts[0] === "about") return { page: "about" };
  if (parts.length === 1 && parts[0] === "credits") return { page: "credits" };
  const [id, second, third] = parts;
  if (!isModelId(id) || parts.length > 3) return MISSING;
  const model = MODELS[id];
  const route: ExploreRoute = { page: "explore", model: id, layer: null, unit: "neurons", index: null, all: query.has("all") };
  if (second === undefined) return route;
  if (second === "heads" && third === undefined) return { ...route, unit: "heads", all: false };
  const layer = second.match(/^L(\d{1,2})$/)?.[1];
  if (layer === undefined || Number(layer) >= model.layers) return MISSING;
  route.layer = Number(layer);
  if (third === undefined) return route;
  if (third === "heads") return { ...route, unit: "heads", all: false };
  const unit = third.match(/^([nh])(\d{1,5})$/);
  if (!unit) return MISSING;
  const index = Number(unit[2]);
  if (unit[1] === "h") return index < model.heads ? { ...route, unit: "heads", index, all: false } : MISSING;
  return index < model.mlp ? { ...route, index } : MISSING;
}

/** drowse.ai's query addresses: ?model=&layer=&neuron= or &head=, &unit=heads, &all=1. */
function legacy(query: URLSearchParams): ExploreRoute {
  const id = query.get("model");
  const model = MODELS[isModelId(id) ? id : DEFAULT_MODEL];
  const layer = Number(query.get("layer"));
  const neuron = query.get("neuron");
  const head = query.get("head");
  const validHead = head !== null && /^\d{1,2}$/.test(head) && Number(head) < model.heads;
  const unit: Unit = validHead || query.get("unit") === "heads" ? "heads" : "neurons";
  return {
    page: "explore",
    model: model.id,
    layer: query.has("layer") && Number.isInteger(layer) && layer >= 0 && layer < model.layers ? layer : null,
    unit,
    index: unit === "heads" ? (validHead ? Number(head) : null) : neuron !== null && /^\d{1,5}$/.test(neuron) && Number(neuron) < model.mlp ? Number(neuron) : null,
    all: unit === "neurons" && (query.get("all") === "1" || query.has("all")),
  };
}

export function href(route: Route): string {
  if (route.page === "about") return "/about";
  if (route.page === "credits") return "/credits";
  if (route.page === "missing") return "/";
  const { model, layer, unit, index, all } = route;
  if (layer === null) return model === DEFAULT_MODEL && unit === "neurons" && !all ? "/" : `/${model}${unit === "heads" ? "/heads" : ""}`;
  const base = `/${model}/L${layer}`;
  if (unit === "heads") return index === null ? `${base}/heads` : `${base}/h${index}`;
  return `${index === null ? base : `${base}/n${index}`}${all ? "?all" : ""}`;
}

export const router = $state<{ route: Route }>({ route: { page: "explore", model: DEFAULT_MODEL, layer: null, unit: "neurons", index: null, all: false } });

const here = () => window.location.pathname + window.location.search;

/** Whether a change of route moves to another page (and so gets a page transition and scrolls up). */
const otherPage = (a: Route, b: Route) => a.page !== b.page;

function apply(next: Route) {
  const previous = router.route;
  if (!otherPage(previous, next) || typeof document.startViewTransition !== "function" || matchMedia("(prefers-reduced-motion: reduce)").matches) {
    router.route = next;
    if (otherPage(previous, next)) window.scrollTo(0, 0);
    return;
  }
  document.startViewTransition(() => {
    router.route = next;
    window.scrollTo(0, 0);
  });
}

/** Go to a path or route. Choices add a history entry; scrubbing and corrections replace it. */
export function go(to: string | Route, { replace = false }: { replace?: boolean } = {}) {
  const url = typeof to === "string" ? to : href(to);
  const target = new URL(url, window.location.origin);
  const next = typeof to === "string" ? parse(target.pathname, target.search) : to;
  const path = typeof to === "string" ? target.pathname + target.search : href(next);
  if (path !== here()) history[replace ? "replaceState" : "pushState"](null, "", path);
  apply(next);
}

/** Read the address, put it in canonical form, then follow back/forward and same-site links. */
export function startRouter() {
  const first = parse(window.location.pathname, window.location.search);
  router.route = first;
  if (first.page === "explore") {
    const canonical = href(first);
    if (canonical !== here() && !(canonical === "/" && window.location.pathname === "/" && !window.location.search)) history.replaceState(null, "", canonical);
  }
  const pop = () => apply(parse(window.location.pathname, window.location.search));
  const click = (event: MouseEvent) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = (event.target as Element | null)?.closest?.("a");
    if (!link || link.target || link.hasAttribute("download") || link.getAttribute("rel")?.includes("external")) return;
    const url = new URL(link.href, window.location.href);
    if (url.origin !== window.location.origin || url.pathname.startsWith("/data/")) return;
    if (url.pathname === window.location.pathname && url.search === window.location.search && url.hash) return;
    event.preventDefault();
    go(url.pathname + url.search, { replace: link.hasAttribute("data-replace") });
  };
  window.addEventListener("popstate", pop);
  document.addEventListener("click", click);
  return () => {
    window.removeEventListener("popstate", pop);
    document.removeEventListener("click", click);
  };
}
