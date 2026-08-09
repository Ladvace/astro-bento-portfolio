import { nineSliceOutlinePath, roundedRectPath } from "./nine-slice";

const SVG_NS = "http://www.w3.org/2000/svg";
const DURATION = 0.5;

type Overlay = {
  card: HTMLElement;
  svg: SVGSVGElement;
  paths: SVGPathElement[];
};

let uid = 0;
let running = false;
let active: Overlay[] = [];
let observer: ResizeObserver | null = null;

function teardown() {
  for (const { card, svg } of active) {
    svg.remove();
    card.style.clipPath = "";
    card.style.removeProperty("-webkit-clip-path");
  }
  active = [];
  observer?.disconnect();
  observer = null;
  document.body.classList.remove("ns-js-shape");
}

function resync() {
  for (const { card, svg, paths } of active) {
    const { offsetWidth: w, offsetHeight: h } = card;
    if (!w || !h) continue;
    const d = nineSliceOutlinePath(w, h);
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    svg.setAttribute("width", String(w));
    svg.setAttribute("height", String(h));
    paths.forEach((p) => p.setAttribute("d", d));
  }
}

function buildOverlay(card: HTMLElement, from: string): Overlay | null {
  const { offsetWidth: w, offsetHeight: h } = card;
  if (!w || !h) return null;

  const id = `ns-morph-${(uid += 1)}`;
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  svg.setAttribute("width", String(w));
  svg.setAttribute("height", String(h));
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("ns-morph-layer");

  const path = (parent: Element, className?: string) => {
    const p = document.createElementNS(SVG_NS, "path");
    p.setAttribute("d", from);
    if (className) p.classList.add(className);
    parent.appendChild(p);
    return p;
  };

  const defs = document.createElementNS(SVG_NS, "defs");
  const clip = document.createElementNS(SVG_NS, "clipPath");
  clip.setAttribute("id", id);
  clip.setAttribute("clipPathUnits", "userSpaceOnUse");
  const clipShape = path(clip);
  defs.appendChild(clip);
  svg.appendChild(defs);

  const outline = path(svg, "ns-morph-outline");

  card.appendChild(svg);
  card.style.clipPath = `url(#${id})`;
  card.style.setProperty("-webkit-clip-path", `url(#${id})`);

  return { card, svg, paths: [clipShape, outline] };
}

const setMode = (custom: boolean) =>
  document.documentElement.classList.toggle("cards-custom", custom);

export async function morphCards(toCustom: boolean): Promise<void> {
  const cards = Array.from(document.querySelectorAll<HTMLElement>(".card--ns"));
  if (!cards.length || running) {
    setMode(toCustom);
    return;
  }

  running = true;
  try {
    const gsapMod = await import("gsap");
    const gsap = gsapMod.gsap ?? gsapMod.default;
    gsap.registerPlugin((await import("gsap/MorphSVGPlugin")).default);

    teardown();

    const tweens: Array<{ target: SVGPathElement; to: string }> = [];
    for (const card of cards) {
      const { offsetWidth: w, offsetHeight: h } = card;
      const rounded = roundedRectPath(w, h);
      const scalloped = nineSliceOutlinePath(w, h);
      const [from, to] = toCustom ? [rounded, scalloped] : [scalloped, rounded];

      const overlay = buildOverlay(card, from);
      if (!overlay) continue;
      active.push(overlay);
      overlay.paths.forEach((target) => tweens.push({ target, to }));
    }

    if (!tweens.length) {
      setMode(toCustom);
      return;
    }

    document.body.classList.add("ns-js-shape");
    setMode(toCustom);

    await Promise.all(
      tweens.map(
        ({ target, to }) =>
          new Promise<void>((resolve) => {
            gsap.to(target, {
              duration: DURATION,
              ease: "power2.inOut",
              morphSVG: to,
              onComplete: resolve,
            });
          }),
      ),
    );

    if (toCustom) {
      observer = new ResizeObserver(resync);
      active.forEach(({ card }) => observer?.observe(card));
    } else {
      teardown();
    }
  } finally {
    running = false;
  }
}
