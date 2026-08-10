/** Bayer dither ported from `dither-me-this`. Upstream's quirks are kept on
 *  purpose; scripts/verify-dither-port.mjs asserts they still match. */

/** Upstream's matrix, duplicated 32 and missing 23 included. */
const BIG_MATRIX = [
  [0, 48, 12, 60, 3, 51, 15, 63],
  [32, 16, 44, 28, 35, 19, 47, 31],
  [8, 56, 4, 52, 11, 59, 7, 55],
  [40, 24, 36, 20, 43, 27, 39, 32],
  [2, 50, 14, 62, 1, 49, 13, 61],
  [34, 18, 46, 30, 33, 17, 45, 29],
  [10, 58, 6, 54, 9, 57, 5, 53],
  [42, 26, 38, 22, 41, 25, 37, 21],
];

const THRESHOLD_STEP = 256 / 4;
const OPAQUE = 250;

export function bayerMatrix([sizeX, sizeY]) {
  const width = Math.min(sizeX, 8);
  const height = Math.min(sizeY, 8);
  if (width === 8 && height === 8) return BIG_MATRIX;

  const matrix = [];
  for (let y = 0; y < height; y++) {
    const row = [];
    for (let x = 0; x < width; x++) row.push(BIG_MATRIX[x][y]); // transposed
    matrix.push(row);
  }

  const rank = new Map();
  matrix
    .flat()
    .sort((a, b) => a - b)
    .forEach((n, i) => rank.set(n, i));
  return matrix.map((row) => row.map((cell) => rank.get(cell)));
}

function hexToRgb(hex) {
  let value = hex.replace(/^#/, "");
  if (value.length === 3) {
    value = value
      .split("")
      .map((c) => c + c)
      .join("");
  }
  const n = parseInt(value, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function luminance(hex) {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function closest(r, g, b, palette) {
  let best = palette[0];
  let bestDistance = Infinity;
  for (const color of palette) {
    const dr = color[0] - r;
    const dg = color[1] - g;
    const db = color[2] - b;
    const distance = dr * dr + dg * dg + db * db;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = color;
    }
  }
  return best;
}

export function bleedEdges(image, passes = 3) {
  const { width: w, height: h, data } = image;
  let solid = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) solid[p] = data[p * 4 + 3] >= OPAQUE ? 1 : 0;

  for (let pass = 0; pass < passes; pass++) {
    const next = solid.slice();
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const p = y * w + x;
        if (solid[p]) continue;

        let r = 0;
        let g = 0;
        let b = 0;
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            const q = ny * w + nx;
            if (!solid[q]) continue;
            r += data[q * 4];
            g += data[q * 4 + 1];
            b += data[q * 4 + 2];
            n++;
          }
        }
        if (!n) continue;

        data[p * 4] = Math.round(r / n);
        data[p * 4 + 1] = Math.round(g / n);
        data[p * 4 + 2] = Math.round(b / n);
        next[p] = 1;
      }
    }
    solid = next;
  }
  return image;
}

export function ditherImage(image, options) {
  const {
    palette,
    matrix = [2, 2],
    gamma = 1,
    brightness = 0,
    contrast = 1,
    ordered = true,
    mask = null,
    maskTone = null,
  } = options;

  const graded = Boolean(mask && maskTone);
  const farGamma = maskTone?.gamma ?? gamma;
  const farBright = maskTone?.brightness ?? brightness;
  const farContrast = maskTone?.contrast ?? contrast;

  const rgb = palette.map(hexToRgb);
  const map = bayerMatrix(matrix);
  const mh = map.length;
  const mw = map[0].length;
  const scale = mh * mw;
  const { width, height, data } = image;

  for (let y = 0; y < height; y++) {
    const mapRow = map[y % mh];
    for (let x = 0; x < width; x++) {
      const p = (y * width + x) * 4;

      let g1 = gamma;
      let b1 = brightness;
      let c1 = contrast;
      if (graded) {
        const w = mask[y * width + x] / 255;
        g1 += (farGamma - gamma) * w;
        b1 += (farBright - brightness) * w;
        c1 += (farContrast - contrast) * w;
      }

      let r = data[p];
      let g = data[p + 1];
      let b = data[p + 2];

      if (g1 !== 1) {
        const inv = 1 / g1;
        r = 255 * (r / 255) ** inv;
        g = 255 * (g / 255) ** inv;
        b = 255 * (b / 255) ** inv;
      }
      if (c1 !== 1) {
        r = (r - 128) * c1 + 128;
        g = (g - 128) * c1 + 128;
        b = (b - 128) * c1 + 128;
      }
      const bump =
        b1 + (ordered ? (mapRow[x % mw] / scale) * THRESHOLD_STEP : 0);
      r += bump;
      g += bump;
      b += bump;

      const best = closest(r, g, b, rgb);
      data[p] = best[0];
      data[p + 1] = best[1];
      data[p + 2] = best[2];
    }
  }

  return image;
}
