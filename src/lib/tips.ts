// The site's one tooltip: an inverted card that follows hover and focus. A single listener on the
// page covers every token chip (hovering one lights up its variants in the same unit, and a term from
// another language shows its English), each translated context's language (its original text), and
// any element with data-tip (data-tip-title above it, data-tip-sub below). Components that draw
// their own targets, like the atlas, call showTip and hideTip directly.
import { ensureTerms, languageName, termFor, termsReady, translation } from "./translate.svelte";

const TARGET = ".tok, .term, [data-original], [data-tip]";

export interface TipContent { title?: string; body?: string; sub?: string; lang?: string; roman?: string }

let tip: HTMLDivElement | null = null;
let shownFor: Element | DOMRect | null = null;

function element(): HTMLDivElement {
  if (tip) return tip;
  tip = document.createElement("div");
  tip.className = "tip";
  tip.id = "tip";
  tip.setAttribute("role", "tooltip");
  tip.hidden = true;
  document.body.append(tip);
  return tip;
}

function line(className: string, text: string, lang?: string) {
  const span = document.createElement("span");
  span.className = className;
  span.textContent = text;
  if (lang) span.lang = lang;
  return span;
}

/** Show the tip beside a box (above it when there is room). Moving between targets glides it. */
export function showTip(anchor: DOMRect | Element, content: TipContent) {
  const node = element();
  const children = [];
  if (content.title) children.push(line("tip-title", content.title, content.lang));
  if (content.roman) children.push(line("tip-sub", content.roman));
  if (content.body) children.push(line("tip-body", content.body));
  if (content.sub) children.push(line("tip-sub", content.sub));
  if (!children.length) return hideTip();
  node.replaceChildren(...children);
  const wasShown = !node.hidden && node.classList.contains("shown");
  node.hidden = false;
  const box = anchor instanceof Element ? anchor.getBoundingClientRect() : anchor;
  node.style.maxWidth = `${Math.min(320, window.innerWidth - 24)}px`;
  const own = node.getBoundingClientRect();
  const left = Math.max(12, Math.min(window.innerWidth - own.width - 12, box.left + box.width / 2 - own.width / 2));
  const above = box.top - own.height - 8;
  const top = above > 8 ? above : box.bottom + 8;
  node.classList.toggle("gliding", wasShown);
  node.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
  shownFor = anchor;
  if (!wasShown) requestAnimationFrame(() => { if (shownFor === anchor) node.classList.add("shown"); });
}

export function hideTip() {
  shownFor = null;
  if (!tip) return;
  tip.classList.remove("shown", "gliding");
  tip.hidden = true;
}

/** `mayLoad`: a fresh hover may ask for the translations (again, after a failure); the redraw when
 * they arrive may not, so a failed load settles instead of retrying in a loop. */
function contentFor(target: HTMLElement, refresh: () => void, mayLoad: boolean): TipContent | null {
  const original = target.dataset.original;
  if (original) return { title: original, lang: target.dataset.lang, sub: languageName(target.dataset.lang ?? "") };
  if (target.dataset.tip) return { title: target.dataset.tipTitle, body: target.dataset.tip, sub: target.dataset.tipSub };
  const term = target.dataset.term;
  if (!term) return null;
  if (!termsReady() && mayLoad) void ensureTerms().then(refresh);
  const entry = termFor(term);
  if (!entry) return { title: term, sub: termsReady() || (translation.failed && !mayLoad) ? "No translation" : "Translating…" };
  return { title: term, lang: entry[2], roman: entry[1] || undefined, body: entry[0], sub: languageName(entry[2]) };
}

/** Svelte action for a page root: hover, focus and touch on any target inside it. */
export function tips(root: HTMLElement) {
  let linked: Element[] = [];
  let current: HTMLElement | null = null;

  function clearLinked() {
    for (const node of linked) node.classList.remove("linked");
    linked = [];
  }

  function show(target: HTMLElement, mayLoad = true) {
    const content = contentFor(target, () => { if (current === target) show(target, false); }, mayLoad);
    if (!content) { hideTip(); target.removeAttribute("aria-describedby"); return; }
    showTip(target, content);
    target.setAttribute("aria-describedby", "tip");
  }

  function enter(target: HTMLElement) {
    if (target === current) return;
    leave(false);
    current = target;
    const key = target.dataset.stem;
    const scope = target.closest("[data-link-scope]");
    if (key && scope) {
      linked = [...scope.querySelectorAll(`.tok[data-stem="${CSS.escape(key)}"]`)];
      if (linked.length > 1) for (const node of linked) node.classList.add("linked");
      else linked = [];
    }
    show(target);
  }

  function leave(hide = true) {
    clearLinked();
    current?.removeAttribute("aria-describedby");
    current = null;
    if (hide) hideTip();
  }

  const targetOf = (event: Event) => (event.target as Element | null)?.closest?.<HTMLElement>(TARGET) ?? null;
  const over = (event: Event) => {
    const target = targetOf(event);
    if (target && root.contains(target)) enter(target);
  };
  const out = (event: PointerEvent | FocusEvent) => {
    // Focus-driven scrolling moves the element under a still pointer: keep a focused target's tip.
    if (event.type === "pointerout" && current?.contains(document.activeElement)) return;
    const next = event.relatedTarget as Element | null;
    if (next && tip?.contains(next)) return;
    if (!next || !current?.contains(next)) {
      if (!next?.closest?.(TARGET)) leave();
    }
  };
  // Touch: a tap shows the tip; a tap elsewhere hides it.
  const down = (event: PointerEvent) => {
    if (event.pointerType === "mouse") return;
    const target = targetOf(event);
    if (target && root.contains(target)) enter(target);
    else leave();
  };
  const key = (event: KeyboardEvent) => { if (event.key === "Escape") leave(); };
  const scroll = () => {
    if (!current) return;
    const box = current.getBoundingClientRect();
    if ((current.contains(document.activeElement) || current.matches(":hover")) && box.bottom > 0 && box.top < window.innerHeight) show(current, false);
    else leave();
  };

  root.addEventListener("pointerover", over);
  root.addEventListener("pointerout", out);
  root.addEventListener("focusin", over);
  root.addEventListener("focusout", out);
  document.addEventListener("pointerdown", down);
  document.addEventListener("keydown", key);
  window.addEventListener("scroll", scroll, { passive: true });

  return {
    destroy() {
      leave();
      root.removeEventListener("pointerover", over);
      root.removeEventListener("pointerout", out);
      root.removeEventListener("focusin", over);
      root.removeEventListener("focusout", out);
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("keydown", key);
      window.removeEventListener("scroll", scroll);
    },
  };
}
