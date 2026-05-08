import { stagger, animate, type AnimationSequence } from "motion";
import { normalizePathname } from "./nav-path";

export function initHomeEntrance(): void {
  const run = () => {
    if (normalizePathname(window.location.pathname) !== "/") return;

    const cards = document.querySelectorAll<HTMLElement>(".card");

    animate([
      [
        cards,
        { y: ["8px", "0px"], opacity: [0, 1] },
        {
          duration: 0.4,
          delay: stagger(0.06),
          ease: "easeOut",
        },
      ],
    ] as AnimationSequence);
  };

  document.addEventListener("grid:reveal-start", run);
}
