const OFFSCREEN_MARGIN = "100px";

export function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function runWhileVisible(
  el: Element,
  tick: (timestamp: number) => void,
  intervalMs = 0,
): () => void {
  if (prefersReducedMotion()) return () => {};

  let rafId: number | null = null;
  let last = -Infinity;

  const frame = (timestamp: number) => {
    rafId = requestAnimationFrame(frame);
    if (timestamp - last < intervalMs) return;
    last = timestamp;
    tick(timestamp);
  };

  const stop = () => {
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = null;
  };

  const start = () => {
    if (rafId === null) rafId = requestAnimationFrame(frame);
  };

  const observer = new IntersectionObserver(
    ([entry]) => (entry.isIntersecting ? start() : stop()),
    { rootMargin: OFFSCREEN_MARGIN },
  );
  observer.observe(el);

  return () => {
    stop();
    observer.disconnect();
  };
}

export function observeResize(el: Element, onResize: () => void): () => void {
  const observer = new ResizeObserver(onResize);
  observer.observe(el);
  return () => observer.disconnect();
}
