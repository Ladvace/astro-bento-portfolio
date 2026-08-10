import { nineSliceOutlinePath } from "./nine-slice";

/* Firefox has no mask-border, so cards are clipped here instead. One path
   both clips and strokes: the two constructions anchor differently. */

const SVG_NS = "http://www.w3.org/2000/svg";
const MASK_BORDER = "linear-gradient(#000, #000) 10 fill / 10px stretch";

const supported = () =>
  CSS.supports("-webkit-mask-box-image", MASK_BORDER) ||
  CSS.supports("mask-border", MASK_BORDER);

function outline(card: HTMLElement): SVGSVGElement {
  let svg = card.querySelector<SVGSVGElement>(":scope > svg.ns-clip-layer");
  if (!svg) {
    svg = document.createElementNS(SVG_NS, "svg");
    svg.classList.add("ns-morph-layer", "ns-clip-layer");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS(SVG_NS, "path");
    path.classList.add("ns-clip-outline");
    svg.appendChild(path);
    card.appendChild(svg);
  }
  return svg;
}

function clip(card: HTMLElement) {
  const { width, height } = card.getBoundingClientRect();
  if (!width || !height) return;

  const d = nineSliceOutlinePath(width, height);
  card.style.clipPath = `path("${d}")`;
  card.style.setProperty("-webkit-clip-path", `path("${d}")`);
  card.classList.add("ns-clip-fallback");

  const svg = outline(card);
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));
  svg.firstElementChild!.setAttribute("d", d);
}

function clear(card: HTMLElement) {
  card.style.clipPath = "";
  card.style.removeProperty("-webkit-clip-path");
  card.classList.remove("ns-clip-fallback");
  card.querySelector(":scope > svg.ns-clip-layer")?.remove();
}

export function initNineSliceFallback(): () => void {
  if (typeof CSS === "undefined" || supported()) return () => {};

  const apply = (card: HTMLElement) =>
    // card-morph owns clip-path while it animates between styles.
    document.documentElement.classList.contains("cards-custom") &&
    !document.body.classList.contains("ns-js-shape")
      ? clip(card)
      : clear(card);

  const cards = () => document.querySelectorAll<HTMLElement>(".card--ns");

  const resize = new ResizeObserver((entries) => {
    for (const entry of entries) apply(entry.target as HTMLElement);
  });

  const sync = () => {
    resize.disconnect();
    cards().forEach((card) => {
      apply(card);
      resize.observe(card);
    });
  };

  const modes = new MutationObserver(sync);
  const watch = { attributes: true, attributeFilter: ["class"] };
  modes.observe(document.documentElement, watch);
  modes.observe(document.body, watch);
  sync();

  return () => {
    resize.disconnect();
    modes.disconnect();
    cards().forEach(clear);
  };
}
