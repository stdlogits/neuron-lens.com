// The explorer's state. The address is the whole of where the viewer is (model, unit, layer, the
// neuron or head, and whether every neuron of the layer is listed); this class reads it from the
// router, loads what that place needs, and changes it only by going to another address. The filter
// and the search's matches are the only state outside the address.
import { getContext, setContext, untrack } from "svelte";
import {
  FLAG_AUDIO, FLAG_CROSSMODAL, FLAG_DETECTOR, FLAG_IMAGE, FLAG_PREDICTS, FLAG_SUPPRESSES, ROLES,
  ROLE_CARRIES, ROLE_COPY, ROLE_DUPLICATE, ROLE_INDUCTION, ROLE_NAMES, ROLE_NEXT, ROLE_PREVIOUS, ROLE_SINK,
  formatCount, headId, loadHeadIndex, loadHeadLayer, loadIndex, loadLayerIndex, loadNeuron, loadScores, neuronId,
  type CatalogIndex, type HeadDetail, type HeadRow, type IndexRow, type NeuronDetail, type Unit,
} from "../lib/data";
import { DEFAULT_MODEL, MODELS, bandOf, depthColor, type ModelId, type ModelInfo } from "../lib/models";
import { go, href, router, type ExploreRoute } from "../lib/router.svelte";
import { setTermsModel } from "../lib/translate.svelte";

export interface Filter { value: string; label: string; neurons?: number; heads?: number }

const NEURON_FILTERS: Filter[] = [
  { value: "all", label: "All" },
  { value: "predicts", label: "Predictors", neurons: FLAG_PREDICTS },
  { value: "suppresses", label: "Suppressors", neurons: FLAG_SUPPRESSES },
  { value: "detector", label: "One token", neurons: FLAG_DETECTOR },
];
const MEDIA_FILTERS: Filter[] = [
  { value: "image", label: "Images", neurons: FLAG_IMAGE },
  { value: "audio", label: "Sound", neurons: FLAG_AUDIO },
  { value: "crossmodal", label: "Text and media", neurons: FLAG_CROSSMODAL },
];
const HEAD_ROLES = [ROLE_INDUCTION, ROLE_DUPLICATE, ROLE_PREVIOUS, ROLE_NEXT, ROLE_COPY, ROLE_SINK, ROLE_CARRIES, ROLE_NAMES];

/** Search matches, as "layer:index" keys, lit up on the atlas and in the list. */
export interface Matches { neurons: Set<string>; heads: Set<string> }
export const matchKey = (layer: number, index: number) => `${layer}:${index}`;

export class Lens {
  // ---------- where the viewer is

  readonly route = $derived<ExploreRoute>(router.route.page === "explore" ? router.route : { page: "explore", model: DEFAULT_MODEL, layer: null, unit: "neurons", index: null, all: false });
  readonly modelId = $derived<ModelId>(this.route.model);
  readonly model = $derived<ModelInfo>(MODELS[this.modelId]);
  readonly unit = $derived<Unit>(this.route.unit);
  readonly layer = $derived<number>(this.route.layer ?? this.model.start[this.unit]);
  /** Every neuron of the layer, not only the easiest. */
  readonly all = $derived<boolean>(this.unit === "neurons" && this.route.all);
  readonly band = $derived(bandOf(this.model, this.layer));
  readonly tint = $derived(depthColor(this.model, this.layer));
  /** Gemma 4's every sixth layer attends globally; the rest within a window. */
  readonly globalLayer = $derived(this.model.globalLayers.includes(this.layer));

  // ---------- what has loaded (each tagged with the model it belongs to)

  index = $state<CatalogIndex | null>(null);
  heads = $state<HeadRow[] | null>(null);
  /** All mode: per layer, one byte per neuron, its readability 0–255. */
  scores = $state<Uint8Array[] | null>(null);
  /** All mode: every neuron of the current layer. */
  layerRows = $state<{ model: ModelId; layer: number; rows: IndexRow[] } | null>(null);
  neuron = $state<{ model: ModelId; layer: number; n: number; detail: NeuronDetail } | null>(null);
  headLayer = $state<{ model: ModelId; layer: number; heads: HeadDetail[] } | null>(null);
  /** The catalog itself failed to load. */
  failed = $state(false);
  /** Loads that failed, each by what it asked for (`model/L8/n344`, `model/L8/heads`, …). A failure
   * shows only while the viewer is still where it was asked for, so a late one can't mark another. */
  failures = $state<string[]>([]);

  // ---------- state outside the address

  filter = $state("all");
  matches = $state<Matches>({ neurons: new Set(), heads: new Set() });

  // ---------- the list of the current layer

  readonly filters = $derived.by<Filter[]>(() => {
    if (this.unit === "heads") {
      const present = (this.heads ?? []).reduce((bits, row) => bits | row[9], 0);
      return [{ value: "all", label: "All" }, ...ROLES.filter((role) => HEAD_ROLES.includes(role.bit) && (present & role.bit)).map((role) => ({ value: String(role.bit), label: role.short, heads: role.bit }))];
    }
    return this.model.media.length ? [...NEURON_FILTERS, ...MEDIA_FILTERS] : NEURON_FILTERS;
  });
  readonly activeFilter = $derived(this.filters.find((filter) => filter.value === this.filter) ?? this.filters[0]);

  /** Whether a neuron row or head row passes the filter. */
  passesNeuron = (row: IndexRow) => !this.activeFilter.neurons || (row[5] & this.activeFilter.neurons) !== 0;
  passesHead = (row: HeadRow) => !this.activeFilter.heads || (row[9] & this.activeFilter.heads) !== 0;

  /** The layer's easiest neurons (or, in All mode, all of them), most readable first. */
  readonly neuronRows = $derived.by<IndexRow[]>(() => {
    if (this.all) return this.layerRows?.model === this.modelId && this.layerRows.layer === this.layer ? [...this.layerRows.rows].sort((a, b) => b[4] - a[4]) : [];
    return (this.index?.id === this.modelId ? this.index.neurons : []).filter((row) => row[0] === this.layer).sort((a, b) => b[4] - a[4]);
  });
  readonly headRows = $derived.by<HeadRow[]>(() => (this.heads ?? []).filter((row) => row[0] === this.layer).sort((a, b) => b[10] - a[10]));
  /** The list as shown: the filter applied. */
  readonly listNeurons = $derived(this.neuronRows.filter(this.passesNeuron));
  readonly listHeads = $derived(this.headRows.filter(this.passesHead));
  /** Neuron or head numbers in list order, for stepping. */
  readonly order = $derived<number[]>(this.unit === "heads" ? this.listHeads.map((row) => row[1]) : this.listNeurons.map((row) => row[1]));
  /** The unit shown: the one in the address, or the list's first. */
  readonly selected = $derived<number | null>(this.route.index ?? this.order[0] ?? (this.unit === "heads" ? this.headRows[0]?.[1] : this.neuronRows[0]?.[1]) ?? null);
  readonly position = $derived(this.selected === null ? -1 : this.order.indexOf(this.selected));
  readonly selectedId = $derived(this.selected === null ? null : this.unit === "heads" ? headId(this.layer, this.selected) : neuronId(this.layer, this.selected));
  /** The selected unit's row in its index, when listed. */
  readonly selectedNeuronRow = $derived(this.unit === "neurons" && this.selected !== null ? this.neuronRows.find((row) => row[1] === this.selected) ?? null : null);
  readonly selectedHeadRow = $derived(this.unit === "heads" && this.selected !== null ? this.headRows.find((row) => row[1] === this.selected) ?? null : null);

  readonly neuronDetail = $derived<NeuronDetail | null>(
    this.unit === "neurons" && this.neuron && this.neuron.model === this.modelId && this.neuron.layer === this.layer && this.neuron.n === this.selected ? this.neuron.detail : null,
  );
  readonly headDetail = $derived<HeadDetail | null>(
    this.unit === "heads" && this.selected !== null && this.headLayer?.model === this.modelId && this.headLayer.layer === this.layer ? this.headLayer.heads.find((head) => head.h === this.selected) ?? null : null,
  );
  /** Query heads sharing the selected head's key-value head (all 16 on Gemma 4's global layers). */
  readonly groupSize = $derived(this.headDetail ? this.headRows.filter((row) => row[2] === this.headDetail!.kv).length : 1);

  readonly neuronKey = $derived(this.selected === null ? null : `${this.modelId}/L${this.layer}/n${this.selected}`);
  readonly rowsKey = $derived(`${this.modelId}/L${this.layer}/rows`);
  readonly headLayerKey = $derived(`${this.modelId}/L${this.layer}/heads`);
  readonly headIndexKey = $derived(`${this.modelId}/heads`);
  /** What the reading pane needs here failed to load: it offers to try again. */
  readonly detailFailed = $derived(
    this.unit === "heads"
      ? this.failures.includes(this.headLayerKey) || (!this.heads && this.failures.includes(this.headIndexKey))
      : (this.all && this.failures.includes(this.rowsKey)) || (this.neuronKey !== null && this.failures.includes(this.neuronKey)),
  );

  readonly totals = $derived({ neurons: this.model.layers * this.model.mlp, heads: this.model.layers * this.model.heads, easiest: this.index?.id === this.modelId ? this.index.neurons.length : null });
  readonly title = $derived(this.route.index !== null && this.selectedId ? `${this.selectedId} · ${this.model.name} · Neuron Lens` : this.route.layer !== null || this.modelId !== DEFAULT_MODEL ? `${this.model.name} · Neuron Lens` : "Neuron Lens");

  constructor() {
    // A new model: drop what belonged to the last one, then load its index and heads.
    $effect(() => {
      const model = this.modelId;
      untrack(() => {
        setTermsModel(model);
        this.matches = { neurons: new Set(), heads: new Set() };
        this.failed = false;
        this.scores = null;
        this.heads = null;
        void loadIndex(model).then((index) => { if (this.modelId === model) this.index = index; }, () => { if (this.modelId === model) this.failed = true; });
        this.loadHeadIndex(model);
      });
    });
    // A new unit or model: the filter starts over.
    $effect(() => {
      void this.unit;
      void this.modelId;
      untrack(() => (this.filter = "all"));
    });
    // All mode: every neuron's score (for the atlas) and the current layer's rows (for the list).
    $effect(() => {
      if (!this.all) return;
      const model = this.modelId;
      const layer = this.layer;
      untrack(() => {
        if (!this.scores) void loadScores(model).then((scores) => { if (this.modelId === model) this.scores = scores; }, () => undefined);
        this.loadRows(model, layer);
      });
    });
    // The selected neuron's detail. Its chunk depends on the index's chunk size: loadNeuron waits for it.
    $effect(() => {
      if (this.unit !== "neurons" || this.selected === null) return;
      const model = this.modelId;
      const layer = this.layer;
      const n = this.selected;
      untrack(() => this.loadNeuron(model, layer, n));
    });
    // The layer's heads, all in one file.
    $effect(() => {
      if (this.unit !== "heads") return;
      const model = this.modelId;
      const layer = this.layer;
      untrack(() => this.loadHeads(model, layer));
    });
    // A neuron in the address that isn't among the layer's easiest opens in All mode.
    $effect(() => {
      const { route, index } = this;
      if (route.unit !== "neurons" || route.index === null || route.all || route.layer === null || index?.id !== route.model) return;
      if (!index.neurons.some((row) => row[0] === route.layer && row[1] === route.index)) untrack(() => go({ ...route, all: true }, { replace: true }));
    });
    $effect(() => { document.title = this.title; });
  }

  private fail = (key: string) => { if (!this.failures.includes(key)) this.failures = [...this.failures, key]; };
  private settle = (key: string) => { if (this.failures.includes(key)) this.failures = this.failures.filter((k) => k !== key); };

  loadNeuron(model: ModelId, layer: number, n: number) {
    if (this.neuron?.model === model && this.neuron.layer === layer && this.neuron.n === n) return;
    const key = `${model}/L${layer}/n${n}`;
    this.settle(key);
    loadNeuron(model, layer, n).then((detail) => {
      if (!detail) return this.fail(key);
      if (this.modelId === model && this.layer === layer && this.selected === n) this.neuron = { model, layer, n, detail };
    }, () => this.fail(key));
  }

  loadRows(model: ModelId, layer: number) {
    if (this.layerRows?.model === model && this.layerRows.layer === layer) return;
    const key = `${model}/L${layer}/rows`;
    this.settle(key);
    loadLayerIndex(model, layer).then(
      (rows) => { if (this.modelId === model && this.layer === layer) this.layerRows = { model, layer, rows }; },
      () => this.fail(key),
    );
  }

  loadHeads(model: ModelId, layer: number) {
    if (this.headLayer?.model === model && this.headLayer.layer === layer) return;
    const key = `${model}/L${layer}/heads`;
    this.settle(key);
    loadHeadLayer(model, layer).then(
      (heads) => { if (this.modelId === model && this.layer === layer) this.headLayer = { model, layer, heads }; },
      () => this.fail(key),
    );
  }

  loadHeadIndex(model: ModelId) {
    const key = `${model}/heads`;
    this.settle(key);
    loadHeadIndex(model).then((heads) => { if (this.modelId === model) this.heads = heads; }, () => this.fail(key));
  }

  /** Ask again for whatever the current place is missing. */
  retry() {
    const model = this.modelId;
    if (this.unit === "heads") {
      if (!this.heads) this.loadHeadIndex(model);
      this.loadHeads(model, this.layer);
      return;
    }
    if (this.all) this.loadRows(model, this.layer);
    if (this.selected !== null) this.loadNeuron(model, this.layer, this.selected);
  }

  // ---------- going places

  /** The address of a place in this model (or another). */
  hrefFor = (place: Partial<Omit<ExploreRoute, "page">>) => href({ ...this.route, layer: this.layer, ...place, page: "explore" });
  unitHref = (unit: Unit, layer: number, index: number | null) => this.hrefFor({ unit, layer, index, all: unit === "neurons" && this.all });

  setModel = (model: ModelId) => {
    if (model === this.modelId) return;
    go({ page: "explore", model, layer: null, unit: this.unit, index: null, all: false });
  };
  setUnit = (unit: Unit) => {
    if (unit === this.unit) return;
    go(this.hrefFor({ unit, index: null, all: false }));
  };
  setAll = (all: boolean) => {
    if (all === this.all) return;
    go(this.hrefFor({ all, index: all ? this.route.index : null }));
  };
  /** Choosing a layer adds a history entry; scrubbing across the atlas replaces it. */
  setLayer = (layer: number, commit = true) => {
    if (layer === this.layer && this.route.index === null && this.route.layer !== null) return;
    go(this.hrefFor({ layer, index: null }), { replace: !commit });
  };
  open = (unit: Unit, layer: number, index: number) => {
    const all = unit === "neurons" && (this.all || (this.index?.id === this.modelId && !this.index.neurons.some((row) => row[0] === layer && row[1] === index)));
    go(this.hrefFor({ unit, layer, index, all }));
  };
  /** The next or previous unit in the list (wrapping); from a unit the filter hides, the list's first. */
  stepTo = (delta: -1 | 1) => {
    if (!this.order.length) return null;
    if (this.position < 0) return this.order[delta === 1 ? 0 : this.order.length - 1];
    return this.order[(this.position + delta + this.order.length) % this.order.length];
  };
  step = (delta: -1 | 1) => {
    const next = this.stepTo(delta);
    if (next !== null) go(this.unitHref(this.unit, this.layer, next), { replace: true });
  };

  /** Figures for the intro: neurons, heads, layers. */
  readonly figures = $derived([
    { value: formatCount(this.totals.neurons), label: "neurons" },
    { value: formatCount(this.totals.heads), label: "heads" },
    { value: String(this.model.layers), label: "layers" },
  ]);
}

const KEY = Symbol("lens");
export const provideLens = (lens: Lens) => setContext(KEY, lens);
export const useLens = () => getContext<Lens>(KEY);
