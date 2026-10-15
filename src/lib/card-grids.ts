import {
  observeResize,
  prefersReducedMotion,
  runWhileVisible,
} from "./motion-gate";

const CURSOR_TRAIL_LENGTH = 12;
const CURSOR_TRAIL_OPACITY = [
  0.8, 0.7, 0.6, 0.5, 0.42, 0.34, 0.27, 0.21, 0.15, 0.1, 0.06, 0.03,
];

const RIPPLE_STEP_MS = 90;
const RIPPLE_SPAWN_CHANCE = 0.055;
const RIPPLE_MAX_ACTIVE = 3;
const RIPPLE_THICKNESS = 1.1;
const RIPPLE_PEAK_OPACITY = 0.5;

let disposers: (() => void)[] = [];

function renderGrid(
  container: HTMLElement,
  style: Partial<CSSStyleDeclaration>,
  count: number,
  createCell: () => HTMLElement,
): HTMLElement[] {
  Object.assign(container.style, { display: "grid" }, style);
  const fragment = document.createDocumentFragment();
  const cells = Array.from({ length: count }, () => {
    const cell = createCell();
    fragment.appendChild(cell);
    return cell;
  });
  container.replaceChildren(fragment);
  return cells;
}

function styledCell(cssText: string) {
  return () => {
    const cell = document.createElement("div");
    cell.style.cssText = cssText;
    return cell;
  };
}

function buildFixedGrid(
  container: HTMLElement,
  cellSize: number,
  cellStyle: string,
  extraRows = 0,
) {
  const cols = Math.max(1, Math.floor(container.clientWidth / cellSize));
  const rows =
    Math.max(1, Math.floor(container.clientHeight / cellSize)) + extraRows;
  const cells = renderGrid(
    container,
    {
      gridTemplateColumns: `repeat(${cols}, ${cellSize}px)`,
      gridTemplateRows: `repeat(${rows}, ${cellSize}px)`,
      placeContent: "center",
    },
    cols * rows,
    styledCell(cellStyle),
  );
  return { cols, rows, cells };
}

function initPlaygroundGrid() {
  const el = document.getElementById("playground-grid");
  if (!el) return;
  const container = el as HTMLElement;

  const TARGET_CELL_SIZE = 12;
  let cols = 1;
  let rows = 1;
  let cellWidth = TARGET_CELL_SIZE;
  let cellHeight = TARGET_CELL_SIZE;
  let totalCells = 1;

  let cells: HTMLElement[] = [];
  let level = new Float32Array(0);
  let ripples: { cx: number; cy: number; radius: number; reach: number }[] = [];

  function paintCell(index: number, opacity: number) {
    const cell = cells[index];
    if (!cell) return;
    cell.style.background = opacity > 0 ? "var(--primary-500)" : "";
    cell.style.opacity = opacity > 0 ? String(opacity) : "";
  }

  function step() {
    if (
      ripples.length < RIPPLE_MAX_ACTIVE &&
      Math.random() < RIPPLE_SPAWN_CHANCE
    ) {
      ripples.push({
        cx: Math.random() * cols,
        cy: Math.random() * rows,
        radius: 0,
        reach: Math.max(cols, rows) * (0.45 + Math.random() * 0.35),
      });
    }
    if (!ripples.length) return;

    const touched = new Map<number, number>();
    for (const ripple of ripples) {
      ripple.radius += 0.5;
      const strength = RIPPLE_PEAK_OPACITY * (1 - ripple.radius / ripple.reach);
      if (strength <= 0) continue;

      const lo = Math.max(0, Math.floor(ripple.cy - ripple.radius - 1));
      const hi = Math.min(rows - 1, Math.ceil(ripple.cy + ripple.radius + 1));
      for (let y = lo; y <= hi; y++) {
        for (let x = 0; x < cols; x++) {
          const dx = x + 0.5 - ripple.cx;
          const dy = y + 0.5 - ripple.cy;
          const offset = Math.abs(Math.hypot(dx, dy) - ripple.radius);
          if (offset > RIPPLE_THICKNESS) continue;
          const value = strength * (1 - offset / RIPPLE_THICKNESS);
          const i = y * cols + x;
          touched.set(i, Math.max(touched.get(i) ?? 0, value));
        }
      }
    }
    ripples = ripples.filter((r) => r.radius < r.reach);

    for (let i = 0; i < totalCells; i++) {
      const value = touched.get(i) ?? 0;
      if (Math.abs(value - level[i]) < 0.02) continue;
      level[i] = value;
      paintCell(i, Math.round(value * 100) / 100);
    }
  }

  function rebuild() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!w || !h) return;
    cols = Math.max(1, Math.round(w / TARGET_CELL_SIZE));
    rows = Math.max(1, Math.round(h / TARGET_CELL_SIZE));
    cellWidth = w / cols;
    cellHeight = h / rows;
    totalCells = cols * rows;
    cells = renderGrid(
      container,
      {
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`,
      },
      totalCells,
      styledCell(
        "border:0.5px solid rgba(255,255,255,0.03);transition:background 0.4s,opacity 0.4s;",
      ),
    );
    level = new Float32Array(totalCells);
    ripples = [];
  }

  rebuild();

  disposers.push(observeResize(container, rebuild));

  disposers.push(runWhileVisible(container, step, RIPPLE_STEP_MS));

  const card = document
    .querySelector<HTMLElement>('a[href="playground"]')
    ?.closest<HTMLElement>(".card");
  let trailIndices: number[] = [];

  const releaseCell = (cellIndex: number) => {
    const cell = cells[cellIndex];
    if (!cell) return;
    cell.style.transition = "";
    paintCell(cellIndex, level[cellIndex]);
  };

  const paintTrail = () =>
    trailIndices.forEach((cellIndex, trailPos) => {
      const cell = cells[cellIndex];
      if (!cell) return;
      cell.style.transition = "none";
      cell.style.background = "var(--primary-500)";
      cell.style.opacity = String(CURSOR_TRAIL_OPACITY[trailPos] ?? 0);
    });

  const fadeAndClearTrail = () => {
    trailIndices.forEach((cellIndex) => {
      const cell = cells[cellIndex];
      if (cell) {
        cell.style.transition = "opacity 0.1s";
        cell.style.opacity = "0";
      }
    });
    setTimeout(() => {
      trailIndices.forEach(releaseCell);
      trailIndices = [];
    }, 100);
  };

  card?.addEventListener("mousemove", (e: MouseEvent) => {
    if (!window.matchMedia("(pointer: fine)").matches) return;
    const rect = container.getBoundingClientRect();
    const cellIndex =
      Math.floor((e.clientY - rect.top) / cellHeight) * cols +
      Math.floor((e.clientX - rect.left) / cellWidth);
    if (
      cellIndex === trailIndices[0] ||
      cellIndex < 0 ||
      cellIndex >= totalCells
    )
      return;
    trailIndices = [cellIndex, ...trailIndices.filter((i) => i !== cellIndex)];
    if (trailIndices.length > CURSOR_TRAIL_LENGTH) {
      trailIndices.splice(CURSOR_TRAIL_LENGTH).forEach((i) => {
        const cell = cells[i];
        if (cell) {
          cell.style.transition = "opacity 0.1s";
          cell.style.opacity = "0";
          setTimeout(() => releaseCell(i), 100);
        }
      });
    }
    paintTrail();
  });

  card?.addEventListener("mouseleave", fadeAndClearTrail);
}

function initGuestbookGrid() {
  const el = document.getElementById("guestbook-grid");
  if (!el) return;
  const container = el as HTMLElement;

  const TILE_SIZE = 26;
  const PLANKS_PER_TILE = 2;
  const PLANK_GAP = 3;
  const TURN_MS = 350;
  const SETTLE_DELAY_MS = 900;
  const TURN_STAGGER_MS = 140;
  const SETTLE_STAGGER_MS = 450;
  let cols = 1;
  let rows = 1;
  let side = 0;
  let tiles: HTMLElement[] = [];
  let turns: { angle: number; settle?: ReturnType<typeof setTimeout> }[] = [];

  /* Basket-weave parquet: tiles of parallel planks alternate direction like a
     checkerboard, and the whole floor is turned 45deg. */
  const floor = document.createElement("div");
  floor.style.cssText =
    "position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(45deg);";
  container.replaceChildren(floor);

  function rebuild() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!w || !h) return;
    // The rotated floor must cover the card's diagonal to leave no corners bare.
    side = Math.ceil(Math.hypot(w, h) / TILE_SIZE) * TILE_SIZE;
    floor.style.width = `${side}px`;
    floor.style.height = `${side}px`;
    cols = rows = side / TILE_SIZE;
    tiles = renderGrid(
      floor,
      {
        gridTemplateColumns: `repeat(${cols}, ${TILE_SIZE}px)`,
        gridTemplateRows: `repeat(${rows}, ${TILE_SIZE}px)`,
      },
      cols * rows,
      () => document.createElement("div"),
    );
    tiles.forEach((tile, i) => {
      const flipped = (i % cols) % 2 !== Math.floor(i / cols) % 2;
      tile.style.cssText = `display:flex;flex-direction:${flipped ? "column" : "row"};gap:${PLANK_GAP}px;padding:${PLANK_GAP / 2}px;box-sizing:border-box;transition:transform ${TURN_MS}ms ease-out;`;
      for (let p = 0; p < PLANKS_PER_TILE; p++) {
        const plank = document.createElement("div");
        plank.style.cssText =
          "flex:1;border-radius:2px;background:var(--primary-500);";
        tile.appendChild(plank);
      }
    });
    turns.forEach((turn) => clearTimeout(turn.settle));
    turns = tiles.map(() => ({ angle: 0 }));
  }

  rebuild();

  disposers.push(observeResize(container, rebuild));

  /* A hovered tile turns 90deg, then keeps going to 180deg, which looks
     identical to where it started, so the floor settles back by itself. */
  function turnTile(index: number) {
    const tile = tiles[index];
    const turn = turns[index];
    if (!tile || !turn || turn.angle % 180 !== 0) return;
    turn.angle += 90;
    // Random per-tile delays keep a sweep from turning and settling in lockstep.
    const turnDelay = Math.random() * TURN_STAGGER_MS;
    tile.style.transitionDelay = `${turnDelay}ms`;
    tile.style.transform = `rotate(${turn.angle}deg)`;
    turn.settle = setTimeout(
      () => {
        turn.angle += 90;
        tile.style.transitionDelay = "0ms";
        tile.style.transform = `rotate(${turn.angle}deg)`;
      },
      turnDelay + SETTLE_DELAY_MS + Math.random() * SETTLE_STAGGER_MS,
    );
  }

  const card = container.closest<HTMLElement>(".card");
  let lastIndex = -1;
  const onMove = (e: MouseEvent) => {
    if (!window.matchMedia("(pointer: fine)").matches) return;
    const rect = container.getBoundingClientRect();
    const dx = e.clientX - (rect.left + rect.width / 2);
    const dy = e.clientY - (rect.top + rect.height / 2);
    // Undo the floor's 45deg turn to find the tile under the cursor.
    const x = (dx + dy) * Math.SQRT1_2 + side / 2;
    const y = (dy - dx) * Math.SQRT1_2 + side / 2;
    const col = Math.floor(x / TILE_SIZE);
    const row = Math.floor(y / TILE_SIZE);
    if (col < 0 || row < 0 || col >= cols || row >= rows) return;
    const index = row * cols + col;
    if (index === lastIndex) return;
    lastIndex = index;
    turnTile(index);
  };
  const onLeave = () => (lastIndex = -1);
  card?.addEventListener("mousemove", onMove);
  card?.addEventListener("mouseleave", onLeave);
  disposers.push(() => {
    card?.removeEventListener("mousemove", onMove);
    card?.removeEventListener("mouseleave", onLeave);
    turns.forEach((turn) => clearTimeout(turn.settle));
  });

  const animate = (timestamp: number) => {
    const time = timestamp * 0.001;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const tile = tiles[row * cols + col];
        if (!tile) continue;
        const wave1 = Math.cos(time * 1.1 + col * 0.9 + row * 0.6);
        const wave2 = Math.cos(time * 0.7 - col * 0.5 + row * 1.1);
        tile.style.opacity = (
          Math.max(0, (wave1 + wave2 + 2) / 4) * 0.45
        ).toFixed(3);
      }
    }
  };

  disposers.push(runWhileVisible(container, animate));
}

function initBlogGrid() {
  const container = document.getElementById("blog-bg");
  if (!container) return;

  const { cols, rows, cells } = buildFixedGrid(
    container,
    18,
    "border-radius:50%;margin:4px;box-sizing:border-box;border:1px solid var(--primary-500);opacity:0;",
    2,
  );

  const originCol = -cols * 0.3;
  const originRow = -rows * 0.3;
  const maxDist = Math.sqrt(originCol ** 2 + originRow ** 2);

  const phases = Float32Array.from({ length: cells.length }, (_, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const dist =
      Math.sqrt((col - originCol) ** 2 + (row - originRow) ** 2) / maxDist;
    return dist * 7;
  });

  const animate = (timestamp: number) => {
    const time = timestamp * 0.0007 * 2.2;
    for (let i = 0; i < cells.length; i++) {
      cells[i].style.opacity = Math.max(
        0,
        Math.cos(time - phases[i]) * 0.35,
      ).toFixed(3);
    }
  };

  disposers.push(runWhileVisible(container, animate));
}

function teardown() {
  disposers.forEach((dispose) => dispose());
  disposers = [];
}

export function initCardGrids(): void {
  document.addEventListener("astro:page-load", () => {
    teardown();
    if (prefersReducedMotion()) return;
    initPlaygroundGrid();
    initGuestbookGrid();
    initBlogGrid();
  });

  document.addEventListener("astro:before-swap", teardown);
}
