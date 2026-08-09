import { prefersReducedMotion } from "./motion-gate";
import { normalizePathname } from "./nav-path";

const DURATION_MS = 400;
const STAGGER_MS = 35;

export function initHomeEntrance(): void {
  const run = () => {
    if (normalizePathname(window.location.pathname) !== "/") return;
    if (prefersReducedMotion()) return;

    document.querySelectorAll<HTMLElement>(".card").forEach((card, index) => {
      card.animate(
        { opacity: [0, 1], translate: ["0 8px", "0 0"] },
        {
          duration: DURATION_MS,
          delay: index * STAGGER_MS,
          easing: "ease-out",
        },
      );
    });
  };

  document.addEventListener("grid:reveal-start", run);
}
