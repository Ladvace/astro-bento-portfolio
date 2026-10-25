import { onCleanup, onMount } from "solid-js";
import { geoDistance } from "d3-geo";
import { drag } from "d3-drag";
import { pointer, select } from "d3-selection";
import {
  observeResize,
  prefersReducedMotion,
  runWhileVisible,
} from "../lib/motion-gate";
import worldUrl from "../lib/world.json?url";
import { SITE } from "../site-config";

type CountryFeature = {
  properties: { name: string };
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon;
};

type World = { features: CountryFeature[]; countryMap: Uint16Array };

type Props = {
  isStatic?: boolean;
  class?: string;
  enableHover?: boolean;
  scale?: number;
};

type Rgb = [number, number, number];
type LonLat = [number, number];
type Point = [number, number];
type PagePoint = { pageX: number; pageY: number };
type Dash = { on: number; off: number };

const DEG = Math.PI / 180;

// Equirectangular raster where each pixel holds a country id (feature index + 1).
const COUNTRY_MAP_WIDTH = 2048;
const COUNTRY_MAP_HEIGHT = 1024;
const NO_COUNTRY = 0;
const OFF_SPHERE = 0xffff;
const TRANSPARENT = 0;

const DEFAULT_PROJECTION_SCALE = 320;
const FALLBACK_HEIGHT = 500;
const LARGE_CELL_SIZE = 3;
const SMALL_CELL_SIZE = 1.5;
const LARGE_GLOBE_MIN_SCALE = 160;
const MIN_FITTED_SCALE = 100;
const DETAIL_MIN_RADIUS = 32;

const INITIAL_VIEW_LAT = 30;
const DRAG_SENSITIVITY = 75;
const DRAG_THRESHOLD_PX = 3;
const MAX_ZOOM = 4;
const WHEEL_ZOOM_SPEED = 0.0015;
const SMALL_GLOBE_SPIN_INTERVAL_MS = 200;
const FRAME_MS = 1000 / 60;
const REVEAL_DURATION_MS = 640;

const LIGHT_DIRECTION = normalize([-0.45, 0.55, 0.7]);
const SHADE_RANGE = 0.4;
const BAYER_4X4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const BAYER_LEVELS = BAYER_4X4.length;

const GRATICULE_STEP_DEG = 20;
const TROPIC_LAT = 23.5;
const GRATICULE_DASH: Dash = { on: 2, off: 4 };
const TROPIC_DASH: Dash = { on: 1, off: 3 };
const EQUATOR_DASH: Dash = { on: 4, off: 2 };

const WAVE_BITMAP = ["010010", "101101"];
const WAVE_SEED = 42;
const WAVE_MAX_LAT = 70;
const WAVE_OCEAN_MARGIN_DEG = 2;
const WAVE_MIN_VISIBILITY = 0.25;

// Compass measurements are in CSS pixels.
const COMPASS_RING_OFFSET = 6;
const COMPASS_BAND_WIDTH = 12;
const GLOBE_COMPASS_GAP = 20;
const NUMERAL_GAP = 6;
const CARDINAL_GAP = 12;
const COMPASS_MARGIN = 32;
const COMPASS_EXTENT =
  COMPASS_RING_OFFSET + COMPASS_BAND_WIDTH + CARDINAL_GAP + COMPASS_MARGIN;

const ACCENT = "#2a4a63";
const COLORS = {
  sea: "#0d1b2a",
  seaShade: "#09141f",
  land: "#1a2e42",
  landShade: "#142538",
  landHover: ACCENT,
  coast: "#3d6688",
  border: ACCENT,
  limb: ACCENT,
  graticule: "#1a3249",
  equator: "#22405a",
  wave: "#23435e",
  compassRing: ACCENT,
  compassTick: "#1e3a52",
  compassBand: "#0f1f2e",
};
const WHITE: Rgb = [255, 255, 255];

const TOOLTIP_STYLES: Record<string, string> = {
  position: "absolute",
  background: "#0e0e0e",
  color: "#ffffff",
  padding: "6px 12px",
  border: "1px solid #383838",
  "border-radius": "8px",
  "font-family": "var(--font-satoshi), sans-serif",
  "font-weight": "500",
  "font-size": "13px",
  "pointer-events": "none",
  opacity: "0",
  "z-index": "1000",
  "box-shadow": "0 4px 12px rgba(0,0,0,0.4)",
};
const TOOLTIP_OFFSET = 12;

const CellKind = { Outside: 0, Sphere: 1, Limb: 2 } as const;
const SeaMark = { None: 0, Graticule: 1, Equator: 2, Wave: 3 } as const;
const CountryStyle = { Plain: 0, Visited: 1, Striped: 2 } as const;
const STRIPED_COUNTRY = "Taiwan";

const PIXEL_FONT: Record<string, string[]> = {
  "0": ["111", "101", "101", "101", "111"],
  "1": ["010", "110", "010", "010", "111"],
  "2": ["111", "001", "111", "100", "111"],
  "3": ["111", "001", "111", "001", "111"],
  "4": ["101", "101", "111", "001", "001"],
  "5": ["111", "100", "111", "001", "111"],
  "6": ["111", "100", "111", "101", "111"],
  "7": ["111", "001", "001", "001", "001"],
  "8": ["111", "101", "111", "101", "111"],
  "9": ["111", "101", "111", "001", "111"],
  N: ["10001", "11001", "11001", "10101", "10011", "10011", "10001"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
};
const CARDINAL_LABELS: Record<number, string> = {
  0: "N",
  90: "E",
  180: "S",
  270: "W",
};

function normalize(vector: [number, number, number]) {
  const length = Math.hypot(...vector);
  return vector.map((component) => component / length) as typeof vector;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const range = (start: number, end: number, step: number) =>
  Array.from(
    { length: Math.ceil((end - start) / step) },
    (_, i) => start + i * step,
  );

const parseHex = (hex: string): Rgb => {
  const value = parseInt(hex.slice(1), 16);
  return [value >> 16, (value >> 8) & 255, value & 255];
};

const mixRgb = (from: Rgb, to: Rgb, amount: number): Rgb =>
  from.map((channel, i) =>
    Math.round(channel + (to[i] - channel) * amount),
  ) as Rgb;

// Packs a color for a Uint32Array view over ImageData (little-endian ABGR).
const toPixel = ([r, g, b]: Rgb): number =>
  ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;

const hexToPixel = (hex: string) => toPixel(parseHex(hex));

const bayerRank = (col: number, row: number) =>
  BAYER_4X4[(col & 3) | ((row & 3) << 2)];

const forEachBitmapPixel = (
  bitmap: string[],
  visit: (x: number, y: number) => void,
) =>
  bitmap.forEach((line, y) => {
    for (let x = 0; x < line.length; x++) if (line[x] === "1") visit(x, y);
  });

let colorProbe: CanvasRenderingContext2D | null = null;

function readCssColor(value: string, fallback: Rgb): Rgb {
  colorProbe ??= document
    .createElement("canvas")
    .getContext("2d", { willReadFrequently: true });
  if (!colorProbe || !value) return fallback;
  colorProbe.clearRect(0, 0, 1, 1);
  colorProbe.fillStyle = "#000";
  colorProbe.fillStyle = value;
  colorProbe.fillRect(0, 0, 1, 1);
  const [r, g, b] = colorProbe.getImageData(0, 0, 1, 1).data;
  return [r, g, b];
}

// Theme classes live on <body>, so the primary color is read from there.
const readPrimaryColor = (): Rgb =>
  readCssColor(
    getComputedStyle(document.body).getPropertyValue("--primary-500").trim(),
    parseHex(COLORS.landHover),
  );

function buildPalette(primary: Rgb) {
  const sea = parseHex(COLORS.sea);
  const land = parseHex(COLORS.land);
  const seaMarks = new Uint32Array(4);
  seaMarks[SeaMark.Graticule] = hexToPixel(COLORS.graticule);
  seaMarks[SeaMark.Equator] = hexToPixel(COLORS.equator);
  seaMarks[SeaMark.Wave] = hexToPixel(COLORS.wave);
  return {
    sea: toPixel(sea),
    seaShade: hexToPixel(COLORS.seaShade),
    land: toPixel(land),
    landShade: hexToPixel(COLORS.landShade),
    landHover: hexToPixel(COLORS.landHover),
    visited: toPixel(primary),
    visitedShade: toPixel(mixRgb(primary, sea, 0.35)),
    visitedHover: toPixel(mixRgb(primary, WHITE, 0.25)),
    stripe: toPixel(mixRgb(land, primary, 0.5)),
    coast: hexToPixel(COLORS.coast),
    border: hexToPixel(COLORS.border),
    limb: hexToPixel(COLORS.limb),
    seaMarks,
  };
}

type Palette = ReturnType<typeof buildPalette>;

let worldPromise: Promise<World> | null = null;

function loadWorld(): Promise<World> {
  worldPromise ??= fetch(worldUrl)
    .then((res) => res.json())
    .then((world) => {
      const features = world.features as CountryFeature[];
      return { features, countryMap: rasterizeCountries(features) };
    });
  return worldPromise;
}

const toMapX = (lon: number) => ((lon + 180) / 360) * COUNTRY_MAP_WIDTH;
const toMapY = (lat: number) => ((90 - lat) / 180) * COUNTRY_MAP_HEIGHT;
const nearestPixelCenter = (coordinate: number) => Math.ceil(coordinate - 0.5);

// Even-odd scanline fill, so holes in a polygon stay empty.
function fillPolygon(
  countryMap: Uint16Array,
  rings: GeoJSON.Position[][],
  countryId: number,
) {
  const projectedRings = rings.map((ring) =>
    ring.map(([lon, lat]) => [toMapX(lon), toMapY(lat)]),
  );
  const ys = projectedRings.flat().map(([, y]) => y);
  const firstRow = Math.max(0, Math.floor(Math.min(...ys)));
  const lastRow = Math.min(COUNTRY_MAP_HEIGHT - 1, Math.ceil(Math.max(...ys)));
  const crossingsByRow: number[][] = Array.from(
    { length: lastRow - firstRow + 1 },
    () => [],
  );

  for (const ring of projectedRings) {
    ring.forEach(([x1, y1], i) => {
      const [x2, y2] = ring[(i + 1) % ring.length];
      if (y1 === y2) return;
      const startRow = Math.max(firstRow, nearestPixelCenter(Math.min(y1, y2)));
      const endRow = Math.min(
        lastRow,
        nearestPixelCenter(Math.max(y1, y2)) - 1,
      );
      for (let row = startRow; row <= endRow; row++) {
        const t = (row + 0.5 - y1) / (y2 - y1);
        crossingsByRow[row - firstRow].push(x1 + t * (x2 - x1));
      }
    });
  }

  crossingsByRow.forEach((crossings, offset) => {
    crossings.sort((a, b) => a - b);
    const rowStart = (firstRow + offset) * COUNTRY_MAP_WIDTH;
    for (let i = 0; i + 1 < crossings.length; i += 2) {
      const from = Math.max(0, nearestPixelCenter(crossings[i]));
      const to = Math.min(
        COUNTRY_MAP_WIDTH - 1,
        nearestPixelCenter(crossings[i + 1]) - 1,
      );
      countryMap.fill(countryId, rowStart + from, rowStart + to + 1);
    }
  });
}

function rasterizeCountries(features: CountryFeature[]): Uint16Array {
  const countryMap = new Uint16Array(COUNTRY_MAP_WIDTH * COUNTRY_MAP_HEIGHT);
  features.forEach(({ geometry }, index) => {
    const polygons =
      geometry.type === "Polygon"
        ? [geometry.coordinates]
        : geometry.coordinates;
    for (const rings of polygons) fillPolygon(countryMap, rings, index + 1);
  });
  return countryMap;
}

// Longitude and latitude are in radians.
function countryAt(countryMap: Uint16Array, lon: number, lat: number) {
  const turns = lon / (2 * Math.PI) + 0.5;
  const x = Math.min(
    COUNTRY_MAP_WIDTH - 1,
    Math.floor((turns - Math.floor(turns)) * COUNTRY_MAP_WIDTH),
  );
  const y = clamp(
    Math.floor((0.5 - lat / Math.PI) * COUNTRY_MAP_HEIGHT),
    0,
    COUNTRY_MAP_HEIGHT - 1,
  );
  return countryMap[y * COUNTRY_MAP_WIDTH + x];
}

const seededRandom = (seed: number) => () => {
  let t = (seed += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// Returns wave positions in radians, spread over open ocean.
function placeWaves(
  countryMap: Uint16Array,
  count: number,
  minSeparationDeg: number,
): LonLat[] {
  const random = seededRandom(WAVE_SEED);
  const margin = WAVE_OCEAN_MARGIN_DEG;
  const clearanceOffsets: LonLat[] = [
    [0, 0],
    [margin, 0],
    [-margin, 0],
    [0, margin],
    [0, -margin],
  ];
  const isOpenOcean = (lon: number, lat: number) =>
    clearanceOffsets.every(
      ([lonOffset, latOffset]) =>
        countryAt(
          countryMap,
          (lon + lonOffset) * DEG,
          clamp(lat + latOffset, -89, 89) * DEG,
        ) === NO_COUNTRY,
    );

  const placed: LonLat[] = [];
  for (
    let attempt = 0;
    placed.length < count && attempt < count * 100;
    attempt++
  ) {
    const lon = random() * 360 - 180;
    const lat = Math.asin(random() * 2 - 1) / DEG;
    if (Math.abs(lat) > WAVE_MAX_LAT || !isOpenOcean(lon, lat)) continue;
    const isCrowded = placed.some(
      (other) => geoDistance([lon, lat], other) < minSeparationDeg * DEG,
    );
    if (!isCrowded) placed.push([lon, lat]);
  }
  return placed.map(([lon, lat]) => [lon * DEG, lat * DEG]);
}

type GraticuleLine = {
  pointAt: (t: number) => LonLat;
  arcLength: number;
  mark: number;
  dash: Dash;
};

const meridian = (lonDeg: number): GraticuleLine => ({
  pointAt: (t) => [lonDeg * DEG, (-80 + t * 160) * DEG],
  arcLength: 160 * DEG,
  mark: SeaMark.Graticule,
  dash: GRATICULE_DASH,
});

const parallel = (latDeg: number, mark: number, dash: Dash): GraticuleLine => ({
  pointAt: (t) => [(t * 360 - 180) * DEG, latDeg * DEG],
  arcLength: 2 * Math.PI * Math.cos(latDeg * DEG),
  mark,
  dash,
});

const GRATICULE_LINES: GraticuleLine[] = [
  ...range(-180, 180, GRATICULE_STEP_DEG).map(meridian),
  ...range(-60, 61, GRATICULE_STEP_DEG)
    .filter((lat) => lat !== 0)
    .map((lat) => parallel(lat, SeaMark.Graticule, GRATICULE_DASH)),
  parallel(TROPIC_LAT, SeaMark.Graticule, TROPIC_DASH),
  parallel(-TROPIC_LAT, SeaMark.Graticule, TROPIC_DASH),
  parallel(0, SeaMark.Equator, EQUATOR_DASH),
];

type CellGrid = {
  cols: number;
  rows: number;
  cellSize: number;
  centerCol: number;
  centerRow: number;
  cellCount: number;
};

function createGrid(width: number, height: number, cellSize: number): CellGrid {
  const cols = Math.floor(width / cellSize);
  const rows = Math.floor(height / cellSize);
  return {
    cols,
    rows,
    cellSize,
    centerCol: cols / 2,
    centerRow: rows / 2,
    cellCount: cols * rows,
  };
}

const cellIndex = (grid: CellGrid, col: number, row: number) =>
  col < 0 || row < 0 || col >= grid.cols || row >= grid.rows
    ? -1
    : row * grid.cols + col;

type CellBounds = {
  firstCol: number;
  lastCol: number;
  firstRow: number;
  lastRow: number;
};

const fullBounds = (grid: CellGrid): CellBounds => ({
  firstCol: 0,
  lastCol: grid.cols - 1,
  firstRow: 0,
  lastRow: grid.rows - 1,
});

const boundsAroundCenter = (grid: CellGrid, radius: number): CellBounds => ({
  firstCol: Math.max(0, Math.floor(grid.centerCol - radius)),
  lastCol: Math.min(grid.cols - 1, Math.ceil(grid.centerCol + radius)),
  firstRow: Math.max(0, Math.floor(grid.centerRow - radius)),
  lastRow: Math.min(grid.rows - 1, Math.ceil(grid.centerRow + radius)),
});

const forEachCell = (
  grid: CellGrid,
  visit: (col: number, row: number, index: number) => void,
  { firstCol, lastCol, firstRow, lastRow }: CellBounds = fullBounds(grid),
) => {
  for (let row = firstRow; row <= lastRow; row++) {
    for (let col = firstCol; col <= lastCol; col++) {
      visit(col, row, row * grid.cols + col);
    }
  }
};

const distanceFromCenter = (grid: CellGrid, col: number, row: number) =>
  Math.hypot(col + 0.5 - grid.centerCol, row + 0.5 - grid.centerRow);

// Bearings are clockwise from north, like a compass.
const cellAtBearing = (
  grid: CellGrid,
  bearing: number,
  radius: number,
): Point => {
  const angle = (bearing - 90) * DEG;
  return [
    Math.floor(grid.centerCol + Math.cos(angle) * radius),
    Math.floor(grid.centerRow + Math.sin(angle) * radius),
  ];
};

function buildCompass(
  grid: CellGrid,
  innerRadius: number,
  primary: Rgb,
): Uint32Array {
  const pixels = new Uint32Array(grid.cellCount);
  const ringColor = hexToPixel(COLORS.compassRing);
  const tickColor = hexToPixel(COLORS.compassTick);
  const bandColor = hexToPixel(COLORS.compassBand);
  const outerRadius = innerRadius + COMPASS_BAND_WIDTH / grid.cellSize;
  const bandWidth = outerRadius - innerRadius;
  const plot = (col: number, row: number, color: number) => {
    const index = cellIndex(grid, col, row);
    if (index >= 0) pixels[index] = color;
  };

  forEachCell(grid, (col, row) => {
    const distance = distanceFromCenter(grid, col, row);
    const isOnRing =
      Math.abs(distance - innerRadius) < 0.5 ||
      Math.abs(distance - outerRadius) < 0.5;
    if (isOnRing) plot(col, row, ringColor);
    else if (distance > innerRadius && distance < outerRadius) {
      plot(col, row, bandColor);
    }
  });

  const tickFor = (bearing: number): [length: number, color: number] => {
    if (bearing % 90 === 0) return [bandWidth + 2, ringColor];
    if (bearing % 30 === 0) return [bandWidth, ringColor];
    if (bearing % 10 === 0) return [bandWidth * 0.6, tickColor];
    return [bandWidth * 0.3, tickColor];
  };
  for (let bearing = 0; bearing < 360; bearing += 5) {
    const [length, color] = tickFor(bearing);
    for (let r = innerRadius; r <= innerRadius + length; r += 0.5) {
      plot(...cellAtBearing(grid, bearing, r), color);
    }
  }

  for (let bearing = 45; bearing < 360; bearing += 90) {
    const [col, row] = cellAtBearing(grid, bearing, outerRadius + 3);
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const reach = Math.abs(dx) + Math.abs(dy);
        if (reach <= 2) {
          plot(col + dx, row + dy, reach === 0 ? bandColor : ringColor);
        }
      }
    }
  }

  const [northCol, northRow] = cellAtBearing(grid, 0, outerRadius);
  const pointerRows = Math.max(3, Math.round(bandWidth));
  for (let i = 0; i < pointerRows; i++) {
    const halfWidth = pointerRows - 1 - i;
    for (let dx = -halfWidth; dx <= halfWidth; dx++) {
      plot(northCol + dx, northRow + 1 + i, toPixel(primary));
    }
  }

  const stampLabel = (text: string, bearing: number, radius: number) => {
    const glyphs = [...text].map((char) => PIXEL_FONT[char]);
    const width = glyphs.reduce((sum, glyph) => sum + glyph[0].length + 1, -1);
    const height = glyphs[0].length;
    const angle = (bearing - 90) * DEG;
    // Push the label out until its bounding box clears the ring.
    const distance =
      radius +
      (Math.abs(Math.cos(angle)) * width) / 2 +
      (Math.abs(Math.sin(angle)) * height) / 2;
    let left = Math.round(
      grid.centerCol + Math.cos(angle) * distance - width / 2,
    );
    const top = Math.round(
      grid.centerRow + Math.sin(angle) * distance - height / 2,
    );
    for (const glyph of glyphs) {
      forEachBitmapPixel(glyph, (x, y) => plot(left + x, top + y, ringColor));
      left += glyph[0].length + 1;
    }
  };
  for (let bearing = 0; bearing < 360; bearing += 30) {
    const cardinal = CARDINAL_LABELS[bearing];
    const gap = (cardinal ? CARDINAL_GAP : NUMERAL_GAP) / grid.cellSize;
    stampLabel(cardinal ?? String(bearing), bearing, outerRadius + gap);
  }

  return pixels;
}

// Unit-sphere coordinates of every cell inside the globe's circle. The circle
// stays fixed while zooming; only the sphere radius behind it grows.
function createSphereCells(grid: CellGrid, clipRadius: number) {
  const kind = new Uint8Array(grid.cellCount);
  const normalX = new Float32Array(grid.cellCount);
  const normalY = new Float32Array(grid.cellCount);
  const normalZ = new Float32Array(grid.cellCount);
  const isShaded = new Uint8Array(grid.cellCount);
  const [lightX, lightY, lightZ] = LIGHT_DIRECTION;

  const setRadius = (radius: number, bounds?: CellBounds) =>
    forEachCell(
      grid,
      (col, row, index) => {
        const distance = distanceFromCenter(grid, col, row);
        if (distance > clipRadius) {
          kind[index] =
            distance <= clipRadius + 1 ? CellKind.Limb : CellKind.Outside;
          return;
        }
        const x = (col + 0.5 - grid.centerCol) / radius;
        const y = -(row + 0.5 - grid.centerRow) / radius;
        const z = Math.sqrt(Math.max(0, 1 - x * x - y * y));
        kind[index] = CellKind.Sphere;
        normalX[index] = x;
        normalY[index] = y;
        normalZ[index] = z;
        const shadeThreshold =
          ((bayerRank(col, row) + 0.5) / BAYER_LEVELS) * SHADE_RANGE;
        isShaded[index] =
          x * lightX + y * lightY + z * lightZ < shadeThreshold ? 1 : 0;
      },
      bounds,
    );

  setRadius(clipRadius);
  return {
    kind,
    normalX,
    normalY,
    normalZ,
    isShaded,
    bounds: boundsAroundCenter(grid, clipRadius + 1),
    setRadius: (radius: number) =>
      setRadius(radius, boundsAroundCenter(grid, clipRadius + 1)),
  };
}

type SphereCells = ReturnType<typeof createSphereCells>;

// The view is the lon/lat point facing the viewer, in degrees.
type View = { lon: number; lat: number };

function createProjection(
  grid: CellGrid,
  view: View,
  radius: number,
  countryMap: Uint16Array,
) {
  const viewLon = view.lon * DEG;
  const sinViewLat = Math.sin(view.lat * DEG);
  const cosViewLat = Math.cos(view.lat * DEG);
  return {
    radius,
    countryAtNormal(x: number, y: number, z: number) {
      const lat = Math.asin(z * sinViewLat + y * cosViewLat);
      const lon = viewLon + Math.atan2(x, z * cosViewLat - y * sinViewLat);
      return countryAt(countryMap, lon, lat);
    },
    // Returns -1 when the point faces away or falls outside the grid.
    cellAt(lon: number, lat: number, minVisibility = 0) {
      const cosLat = Math.cos(lat);
      const sinLat = Math.sin(lat);
      const lonDelta = lon - viewLon;
      const cosLonDelta = Math.cos(lonDelta);
      const visibility =
        sinViewLat * sinLat + cosViewLat * cosLat * cosLonDelta;
      if (visibility <= minVisibility) return -1;
      const x = cosLat * Math.sin(lonDelta);
      const y = cosViewLat * sinLat - sinViewLat * cosLat * cosLonDelta;
      return cellIndex(
        grid,
        Math.floor(grid.centerCol + x * radius),
        Math.floor(grid.centerRow - y * radius),
      );
    },
  };
}

type Projection = ReturnType<typeof createProjection>;

function createPixelCanvas(container: HTMLElement, grid: CellGrid) {
  const width = grid.cols * grid.cellSize;
  const height = grid.rows * grid.cellSize;
  const dpr = window.devicePixelRatio || 1;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  Object.assign(canvas.style, {
    width: `${width}px`,
    height: `${height}px`,
    display: "block",
    imageRendering: "pixelated",
    flexShrink: "0",
  });
  container.appendChild(canvas);
  const context = canvas.getContext("2d")!;
  context.imageSmoothingEnabled = false;

  // One buffer pixel per cell, scaled up without smoothing on present.
  const buffer = document.createElement("canvas");
  buffer.width = grid.cols;
  buffer.height = grid.rows;
  const bufferContext = buffer.getContext("2d")!;
  const image = bufferContext.createImageData(grid.cols, grid.rows);

  return {
    canvas,
    pixels: new Uint32Array(image.data.buffer),
    present() {
      bufferContext.putImageData(image, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(buffer, 0, 0, canvas.width, canvas.height);
    },
  };
}

function createTooltip() {
  const element = document.createElement("div");
  element.className = "globe-tooltip";
  for (const [property, value] of Object.entries(TOOLTIP_STYLES)) {
    element.style.setProperty(property, value);
  }
  document.body.appendChild(element);
  return {
    show(text: string) {
      element.textContent = text;
      element.style.opacity = "1";
    },
    hide() {
      element.style.opacity = "0";
    },
    moveTo({ pageX, pageY }: PagePoint) {
      element.style.left = `${pageX + TOOLTIP_OFFSET}px`;
      element.style.top = `${pageY - TOOLTIP_OFFSET}px`;
    },
    remove() {
      element.remove();
    },
  };
}

function playReveal(onStep: (step: number) => void): () => void {
  const start = performance.now();
  let frame = 0;
  const tick = (now: number) => {
    const step = Math.min(
      BAYER_LEVELS,
      Math.floor(((now - start) / REVEAL_DURATION_MS) * BAYER_LEVELS) + 1,
    );
    onStep(step);
    if (step < BAYER_LEVELS) frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(frame);
}

type GlobeState = {
  view: View;
  zoom: number;
  hoveredCountry: number;
  isPaused: boolean;
  revealStep: number;
  palette: Palette;
  compass: Uint32Array | null;
};

type InteractionOptions = {
  canvas: HTMLCanvasElement;
  grid: CellGrid;
  sphereRadius: number;
  projectionScale: number;
  features: CountryFeature[];
  countries: Uint16Array;
  state: GlobeState;
  draw: () => void;
  setZoom: (zoom: number) => boolean;
};

function attachInteractions({
  canvas,
  grid,
  sphereRadius,
  projectionScale,
  features,
  countries,
  state,
  draw,
  setZoom,
}: InteractionOptions): () => void {
  const tooltip = createTooltip();
  const { cellSize } = grid;
  const centerX = grid.centerCol * cellSize;
  const centerY = grid.centerRow * cellSize;
  const sphereRadiusPx = sphereRadius * cellSize;

  const isOverSphere = ([x, y]: Point) =>
    Math.hypot(x - centerX, y - centerY) <= sphereRadiusPx;

  const countryAtPoint = ([x, y]: Point) => {
    const index = cellIndex(
      grid,
      Math.floor(x / cellSize),
      Math.floor(y / cellSize),
    );
    const country = index < 0 ? OFF_SPHERE : countries[index];
    return country === OFF_SPHERE ? NO_COUNTRY : country;
  };

  const setHoveredCountry = (country: number, at?: PagePoint) => {
    if (country !== state.hoveredCountry) {
      state.hoveredCountry = country;
      canvas.style.cursor = country ? "var(--cursor-pointer)" : "";
      if (country) tooltip.show(features[country - 1].properties.name);
      else tooltip.hide();
      draw();
    }
    if (country && at) tooltip.moveTo(at);
  };

  const rotateBy = (dx: number, dy: number) => {
    const degreesPerPx = DRAG_SENSITIVITY / projectionScale / state.zoom;
    state.view.lon -= dx * degreesPerPx;
    state.view.lat = clamp(state.view.lat + dy * degreesPerPx, -90, 90);
    draw();
  };

  canvas.addEventListener(
    "wheel",
    (event) => {
      if (!isOverSphere(pointer(event, canvas))) return;
      if (setZoom(state.zoom * Math.exp(-event.deltaY * WHEEL_ZOOM_SPEED))) {
        event.preventDefault();
      }
    },
    { passive: false },
  );

  let pinchStart: { distance: number; zoom: number } | null = null;
  let pinchedDuringPress = false;
  const touchDistance = ([first, second]: TouchList) =>
    Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY);
  const endPinch = (event: TouchEvent) => {
    if (event.touches.length < 2) pinchStart = null;
  };

  canvas.style.touchAction = "none";
  canvas.addEventListener(
    "touchstart",
    (event) => {
      if (event.touches.length !== 2) return;
      pinchStart = { distance: touchDistance(event.touches), zoom: state.zoom };
      pinchedDuringPress = true;
      setHoveredCountry(NO_COUNTRY);
    },
    { passive: true },
  );
  canvas.addEventListener(
    "touchmove",
    (event) => {
      if (!pinchStart || event.touches.length !== 2) return;
      event.preventDefault();
      const scale = touchDistance(event.touches) / pinchStart.distance;
      setZoom(pinchStart.zoom * scale);
    },
    { passive: false },
  );
  canvas.addEventListener("touchend", endPinch);
  canvas.addEventListener("touchcancel", endPinch);

  let pressPoint: Point | null = null;
  let lastDragPoint: Point | null = null;
  let isDragging = false;

  select(canvas)
    .on("mousemove", (event: MouseEvent) => {
      const point = pointer(event, canvas);
      if (!pressPoint) state.isPaused = isOverSphere(point);
      setHoveredCountry(isDragging ? NO_COUNTRY : countryAtPoint(point), event);
    })
    .on("mouseleave", () => {
      state.isPaused = false;
      setHoveredCountry(NO_COUNTRY);
    })
    .call(
      drag<HTMLCanvasElement, unknown>()
        .filter(
          (event) =>
            !event.ctrlKey && !event.button && !(event.touches?.length > 1),
        )
        .on("start", (event) => {
          state.isPaused = true;
          pressPoint = [event.x, event.y];
          lastDragPoint = pressPoint;
          isDragging = false;
          pinchedDuringPress = false;
        })
        .on("drag", (event) => {
          if (!pressPoint || !lastDragPoint) return;
          const point: Point = [event.x, event.y];
          if (pinchStart) {
            lastDragPoint = point;
            return;
          }
          if (!isDragging) {
            const distance = Math.hypot(
              point[0] - pressPoint[0],
              point[1] - pressPoint[1],
            );
            if (distance < DRAG_THRESHOLD_PX) return;
            isDragging = true;
            setHoveredCountry(NO_COUNTRY);
          }
          rotateBy(point[0] - lastDragPoint[0], point[1] - lastDragPoint[1]);
          lastDragPoint = point;
        })
        .on("end", (event) => {
          pressPoint = null;
          lastDragPoint = null;
          isDragging = false;
          const source = event.sourceEvent;
          const releasePoint = source.changedTouches?.[0] ?? source;
          const point = pointer(releasePoint, canvas);
          state.isPaused = isOverSphere(point);
          setHoveredCountry(
            pinchedDuringPress ? NO_COUNTRY : countryAtPoint(point),
            releasePoint,
          );
        }),
    );

  return () => tooltip.remove();
}

function computeSizing(
  container: HTMLElement,
  enableHover: boolean,
  requestedScale: number,
) {
  const cellSize =
    requestedScale >= LARGE_GLOBE_MIN_SCALE ? LARGE_CELL_SIZE : SMALL_CELL_SIZE;
  const projectionScale = enableHover
    ? Math.max(
        MIN_FITTED_SCALE,
        Math.min(requestedScale, container.clientWidth / 2 - COMPASS_EXTENT),
      )
    : requestedScale;
  const minSize = enableHover ? (projectionScale + COMPASS_EXTENT) * 2 : 0;
  const grid = createGrid(
    Math.max(container.clientWidth, minSize),
    Math.max(container.clientHeight || FALLBACK_HEIGHT, minSize),
    cellSize,
  );
  const sphereRadius =
    (projectionScale - (enableHover ? GLOBE_COMPASS_GAP : 0)) / cellSize;
  return { grid, projectionScale, sphereRadius };
}

const countryStyleFor = (name: string, visitedCountries: string[]) =>
  name === STRIPED_COUNTRY
    ? CountryStyle.Striped
    : visitedCountries.includes(name)
      ? CountryStyle.Visited
      : CountryStyle.Plain;

type RenderOptions = {
  isStatic?: boolean;
  enableHover?: boolean;
  projectionScale: number;
  visitedCountries: typeof SITE.visitedCountries;
};

function renderGlobe(
  container: HTMLDivElement,
  { features, countryMap }: World,
  {
    isStatic,
    enableHover = false,
    projectionScale: requestedScale,
    visitedCountries,
  }: RenderOptions,
): () => void {
  const { grid, projectionScale, sphereRadius } = computeSizing(
    container,
    enableHover,
    requestedScale,
  );
  const isDetailed = sphereRadius >= DETAIL_MIN_RADIUS;
  const sphere: SphereCells = createSphereCells(grid, sphereRadius);
  const countryStyles = Uint8Array.from([
    CountryStyle.Plain,
    ...features.map((f) =>
      countryStyleFor(f.properties.name, visitedCountries),
    ),
  ]);
  const waves = isDetailed
    ? placeWaves(countryMap, enableHover ? 80 : 20, enableHover ? 9 : 18)
    : [];
  const { canvas, pixels, present } = createPixelCanvas(container, grid);

  const compassInnerRadius =
    (projectionScale + COMPASS_RING_OFFSET) / grid.cellSize;
  const compassFor = (primary: Rgb) =>
    enableHover ? buildCompass(grid, compassInnerRadius, primary) : null;

  const reducedMotion = prefersReducedMotion();
  const primary = readPrimaryColor();
  const state: GlobeState = {
    view: { lon: 0, lat: INITIAL_VIEW_LAT },
    zoom: 1,
    hoveredCountry: NO_COUNTRY,
    isPaused: false,
    revealStep: reducedMotion ? BAYER_LEVELS : 0,
    palette: buildPalette(primary),
    compass: compassFor(primary),
  };

  const countries = new Uint16Array(grid.cellCount).fill(OFF_SPHERE);
  const seaMarks = new Uint8Array(grid.cellCount);
  const { cols } = grid;

  const sampleCountries = (projection: Projection) =>
    forEachCell(
      grid,
      (_col, _row, i) => {
        countries[i] =
          sphere.kind[i] === CellKind.Sphere
            ? projection.countryAtNormal(
                sphere.normalX[i],
                sphere.normalY[i],
                sphere.normalZ[i],
              )
            : OFF_SPHERE;
      },
      sphere.bounds,
    );

  // Single cells of land read as noise at this resolution.
  const dropIsolatedCells = () =>
    forEachCell(
      grid,
      (_col, _row, i) => {
        const country = countries[i];
        if (country === NO_COUNTRY || country === OFF_SPHERE) return;
        const hasSameNeighbor =
          countries[i - 1] === country ||
          countries[i + 1] === country ||
          countries[i - cols] === country ||
          countries[i + cols] === country;
        if (!hasSameNeighbor) countries[i] = NO_COUNTRY;
      },
      sphere.bounds,
    );

  const traceLine = (
    projection: Projection,
    { pointAt, arcLength, mark, dash }: GraticuleLine,
  ) => {
    const steps = Math.ceil(arcLength * projection.radius * 2);
    let previousCell = -1;
    let cellsCrossed = 0;
    for (let step = 0; step <= steps; step++) {
      const cell = projection.cellAt(...pointAt(step / steps));
      if (cell < 0) {
        previousCell = -1;
        continue;
      }
      if (cell === previousCell) continue;
      previousCell = cell;
      cellsCrossed++;
      const isInGap = cellsCrossed % (dash.on + dash.off) >= dash.on;
      if (!isInGap && countries[cell] === NO_COUNTRY) seaMarks[cell] = mark;
    }
  };

  const stampWave = (anchorCell: number) => {
    const left =
      (anchorCell % grid.cols) - Math.floor(WAVE_BITMAP[0].length / 2);
    const top =
      Math.floor(anchorCell / grid.cols) - Math.floor(WAVE_BITMAP.length / 2);
    forEachBitmapPixel(WAVE_BITMAP, (x, y) => {
      const cell = cellIndex(grid, left + x, top + y);
      if (cell >= 0 && countries[cell] === NO_COUNTRY) {
        seaMarks[cell] = SeaMark.Wave;
      }
    });
  };

  const markSea = (projection: Projection) => {
    seaMarks.fill(SeaMark.None);
    for (const line of GRATICULE_LINES) traceLine(projection, line);
    for (const [lon, lat] of waves) {
      const anchorCell = projection.cellAt(lon, lat, WAVE_MIN_VISIBILITY);
      if (anchorCell >= 0) stampWave(anchorCell);
    }
  };

  const landPixel = (
    index: number,
    col: number,
    row: number,
    country: number,
  ) => {
    const { palette } = state;
    if (isDetailed) {
      const left = countries[index - 1];
      const right = countries[index + 1];
      const above = countries[index - cols];
      const below = countries[index + cols];
      const touchesSea =
        left === NO_COUNTRY ||
        right === NO_COUNTRY ||
        above === NO_COUNTRY ||
        below === NO_COUNTRY;
      if (touchesSea) return palette.coast;
      const touchesOtherCountry =
        (right !== country && right !== OFF_SPHERE) ||
        (below !== country && below !== OFF_SPHERE);
      if (touchesOtherCountry) return palette.border;
    }
    const isHovered = country === state.hoveredCountry;
    const isShaded = sphere.isShaded[index] === 1;
    const style = countryStyles[country];
    if (style === CountryStyle.Visited) {
      if (isHovered) return palette.visitedHover;
      return isShaded ? palette.visitedShade : palette.visited;
    }
    if (style === CountryStyle.Striped && (col + row) % 3 === 0) {
      return palette.stripe;
    }
    if (isHovered) return palette.landHover;
    return isShaded ? palette.landShade : palette.land;
  };

  const cellPixel = (index: number, col: number, row: number) => {
    const isRevealing = state.revealStep < BAYER_LEVELS;
    if (isRevealing && bayerRank(col, row) >= state.revealStep) {
      return TRANSPARENT;
    }
    const { palette } = state;
    switch (sphere.kind[index]) {
      case CellKind.Outside:
        return state.compass?.[index] ?? TRANSPARENT;
      case CellKind.Limb:
        return palette.limb;
    }
    const country = countries[index];
    if (country !== NO_COUNTRY) return landPixel(index, col, row, country);
    const mark = seaMarks[index];
    if (mark !== SeaMark.None) return palette.seaMarks[mark];
    return sphere.isShaded[index] === 1 ? palette.seaShade : palette.sea;
  };

  // The compass and empty space only change during the reveal or on a theme
  // change, so ordinary frames repaint just the globe's square.
  let needsFullPaint = true;

  const draw = () => {
    const projection = createProjection(
      grid,
      state.view,
      sphereRadius * state.zoom,
      countryMap,
    );
    sampleCountries(projection);
    if (isDetailed) {
      dropIsolatedCells();
      markSea(projection);
    }
    forEachCell(
      grid,
      (col, row, index) => {
        pixels[index] = cellPixel(index, col, row);
      },
      needsFullPaint ? fullBounds(grid) : sphere.bounds,
    );
    needsFullPaint = state.revealStep < BAYER_LEVELS;
    present();
  };

  const setZoom = (zoom: number) => {
    const nextZoom = clamp(zoom, 1, MAX_ZOOM);
    if (nextZoom === state.zoom) return false;
    state.zoom = nextZoom;
    sphere.setRadius(sphereRadius * nextZoom);
    draw();
    return true;
  };

  draw();

  const onThemeChange = () => {
    const primary = readPrimaryColor();
    state.palette = buildPalette(primary);
    state.compass = compassFor(primary);
    needsFullPaint = true;
    draw();
  };
  document.addEventListener("themechange", onThemeChange);

  const teardown = [
    () => canvas.remove(),
    () => document.removeEventListener("themechange", onThemeChange),
  ];

  if (!reducedMotion) {
    teardown.push(
      playReveal((step) => {
        state.revealStep = step;
        needsFullPaint = true;
        draw();
      }),
    );
  }

  if (enableHover) {
    teardown.push(
      attachInteractions({
        canvas,
        grid,
        sphereRadius,
        projectionScale,
        features,
        countries,
        state,
        draw,
        setZoom,
      }),
    );
  }

  const spinIntervalMs = enableHover ? 0 : SMALL_GLOBE_SPIN_INTERVAL_MS;
  const degreesPerTick =
    (DRAG_SENSITIVITY / DEFAULT_PROJECTION_SCALE) *
    Math.max(1, spinIntervalMs / FRAME_MS);
  teardown.push(
    runWhileVisible(
      container,
      () => {
        if (state.isPaused || isStatic) return;
        state.view.lon += degreesPerTick / state.zoom;
        draw();
      },
      spinIntervalMs,
    ),
  );

  return () => teardown.forEach((dispose) => dispose());
}

const GlobeComponent = ({ isStatic, enableHover, scale }: Props) => {
  let mapContainer: HTMLDivElement | undefined;

  onMount(() => {
    const container = mapContainer;
    if (!container) return;

    let stopGlobe: (() => void) | undefined;
    let stopResizeWatch: (() => void) | undefined;
    let isDisposed = false;
    onCleanup(() => {
      isDisposed = true;
      stopGlobe?.();
      stopResizeWatch?.();
    });

    void loadWorld().then((world) => {
      if (isDisposed) return;
      const mountGlobe = () => {
        stopGlobe?.();
        stopGlobe = renderGlobe(container, world, {
          isStatic,
          enableHover,
          projectionScale: scale ?? DEFAULT_PROJECTION_SCALE,
          visitedCountries: SITE.visitedCountries,
        });
      };
      mountGlobe();
      if (!enableHover) return;
      let lastWidth = container.clientWidth;
      stopResizeWatch = observeResize(container, () => {
        if (container.clientWidth === lastWidth) return;
        lastWidth = container.clientWidth;
        mountGlobe();
      });
    });
  });

  return (
    <div class="flex flex-col text-white justify-center items-center w-full h-full">
      <div
        class="w-full h-full flex justify-center items-center"
        ref={mapContainer}
      ></div>
      {enableHover && (
        <p class="text-sm text-darkslate-300 mt-4 text-center">
          Drag to rotate · scroll or pinch to zoom
        </p>
      )}
    </div>
  );
};

export default GlobeComponent;
