import { stagger, animate, type AnimationSequence } from "motion";
import {
  normalizePathname,
  PORTFOLIO_HAS_VISITED_NON_HOME_KEY,
} from "./nav-path";

export function initHomeEntrance(): void {
  const run = () => {
    if (normalizePathname(window.location.pathname) !== "/") return;

    const navEntry = performance.getEntriesByType(
      "navigation",
    )[0] as PerformanceNavigationTiming | undefined;
    const isReload = navEntry?.type === "reload";

    const hasVisitedNonHome =
      sessionStorage.getItem(PORTFOLIO_HAS_VISITED_NON_HOME_KEY) === "1";

    const skipCardStagger = !isReload && hasVisitedNonHome;

    const cards = document.querySelectorAll<HTMLElement>(".card");

    if (skipCardStagger) {
      cards.forEach((card) => {
        card.style.opacity = "1";
        card.style.transform = "translateY(0)";
      });
      return;
    }

    animate([
      [
        cards,
        { y: ["40%", "0%"], opacity: [0, 1] },
        {
          type: "spring",
          at: "-0.1",
          delay: stagger(0.2),
        },
      ],
    ] as AnimationSequence);
  };

  document.addEventListener("astro:page-load", run);
}
