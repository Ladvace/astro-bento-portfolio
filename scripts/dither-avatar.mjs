#!/usr/bin/env node
/**
 * Dither the rendered turntable frames into per-theme spritesheets.
 *
 *   node scripts/dither-avatar.mjs --in <frames-dir> [options]
 *
 *     --themes  red,green      which theme palettes to build
 *     --out     public         output directory
 *     --matrix  2              Bayer matrix size (2, 4 or 8)
 *     --block   1              dither at 1/block scale, then nearest-upscale
 *     --bright  0              added to each channel before quantising
 *     --contrast 1             1 = unchanged, pivots on mid grey
 *     --palette "#a,#b,..."    override the theme palette with explicit hex
 *     --alpha-levels 16        alpha steps kept; 256 for bit-exact alpha
 *     --gamma   1              >1 lifts shadows (applied before contrast)
 *     --mask    <dir>          head-mask frames from render_head_mask.py
 *     --face-bright / --face-contrast / --face-gamma
 *                              tone used where the mask is solid; the tone is
 *                              interpolated across the mask edge
 *
 * Tune interactively at /playground/dither-lab, which shares the dither code.
 */
import { createCanvas, loadImage } from "canvas";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { readPalettes } from "../src/lib/avatar-palettes.mjs";
import { SPRITE } from "../src/lib/avatar-sprite.mjs";
import { bleedEdges, ditherImage } from "../src/lib/dither.mjs";

const { COLS, ROWS } = SPRITE;

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};

const inDir = flag("in");
const outDir = flag("out", "public");
const themeNames = flag("themes", "red,green")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const matrixSize = Number(flag("matrix", "2"));
const block = Number(flag("block", "1"));
const brightness = Number(flag("bright", "0"));
const contrast = Number(flag("contrast", "1"));
const alphaLevels = Number(flag("alpha-levels", "16"));
const gamma = Number(flag("gamma", "1"));
const maskDir = flag("mask");
const faceTone = maskDir
  ? {
      brightness: Number(flag("face-bright", String(brightness))),
      contrast: Number(flag("face-contrast", String(contrast))),
      gamma: Number(flag("face-gamma", String(gamma))),
    }
  : null;
const paletteOverride = flag("palette")
  ?.split(",")
  .map((c) => c.trim())
  .filter(Boolean);

if (!inDir) {
  console.error(
    "usage: node scripts/dither-avatar.mjs --in <frames-dir> " +
      "[--themes red,green] [--out public] [--matrix 2] [--block 1] " +
      "[--bright 0] [--contrast 1]",
  );
  process.exit(1);
}
if (!Number.isInteger(block) || block < 1) {
  console.error(`--block must be a positive integer, got ${flag("block")}`);
  process.exit(1);
}
if (![2, 4, 8].includes(matrixSize)) {
  console.error(`--matrix must be 2, 4 or 8, got ${flag("matrix")}`);
  process.exit(1);
}
if (!Number.isInteger(alphaLevels) || alphaLevels < 2 || alphaLevels > 256) {
  console.error(`--alpha-levels must be 2..256, got ${flag("alpha-levels")}`);
  process.exit(1);
}
if (paletteOverride) {
  const bad = paletteOverride.filter((c) => !/^#[0-9a-f]{6}$/i.test(c));
  if (bad.length) {
    console.error(`--palette entries must be #rrggbb, got: ${bad.join(", ")}`);
    process.exit(1);
  }
  if (paletteOverride.length < 2) {
    console.error("--palette needs at least 2 colours");
    process.exit(1);
  }
}

const imageDataOf = async (src) => {
  const img = await loadImage(src);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, img.width, img.height);
};

function crop(imageData, box) {
  const [left, top, right, bottom] = box;
  const c = createCanvas(imageData.width, imageData.height);
  const ctx = c.getContext("2d");
  ctx.putImageData(imageData, 0, 0);
  return ctx.getImageData(left, top, right - left, bottom - top);
}

/** Symmetric about the centre, or the sprite lurches between cells. */
function unionAlphaBox(frames) {
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const { width: w, height: h, data } of frames) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (data[(y * w + x) * 4 + 3] === 0) continue;
        if (x < left) left = x;
        if (x + 1 > right) right = x + 1;
        if (y < top) top = y;
        if (y + 1 > bottom) bottom = y + 1;
      }
    }
  }
  const { width: w } = frames[0];
  const cx = w / 2;
  const half = Math.max(cx - left, right - cx);
  return [
    Math.max(0, Math.round(cx - half)),
    top,
    Math.min(w, Math.round(cx + half)),
    bottom,
  ];
}

function resize(imageData, w, h, smooth) {
  const src = createCanvas(imageData.width, imageData.height);
  src.getContext("2d").putImageData(imageData, 0, 0);

  const dst = createCanvas(w, h);
  const ctx = dst.getContext("2d");
  ctx.imageSmoothingEnabled = smooth;
  ctx.patternQuality = smooth ? "best" : "nearest";
  if (!smooth) ctx.quality = "nearest";
  ctx.drawImage(src, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}

async function ditherFrame(file, palette, box, maskFile) {
  const source = crop(await imageDataOf(file), box);
  const { width: w, height: h } = source;

  let mask = null;
  if (maskFile) {
    const m = crop(await imageDataOf(maskFile), box);
    mask = new Uint8ClampedArray(w * h);
    for (let p = 0; p < w * h; p++) mask[p] = m.data[p * 4 + 3];
  }

  const alpha = new Uint8ClampedArray(w * h);
  for (let p = 0; p < w * h; p++) alpha[p] = source.data[p * 4 + 3];

  bleedEdges(source);

  let out =
    block > 1
      ? resize(source, Math.round(w / block), Math.round(h / block), true)
      : source;

  ditherImage(out, {
    palette,
    matrix: [matrixSize, matrixSize],
    gamma,
    brightness,
    contrast,
    mask: block > 1 ? null : mask,
    maskTone: faceTone,
  });

  if (out.width !== w || out.height !== h) out = resize(out, w, h, false);

  for (let p = 0; p < w * h; p++) out.data[p * 4 + 3] = alpha[p];
  return out;
}

async function buildTheme(name, palette, files, box, maskFiles) {
  const frames = [];
  for (const [i, file] of files.entries()) {
    frames.push(await ditherFrame(file, palette, box, maskFiles?.[i]));
  }

  const cw = frames[0].width;
  const ch = frames[0].height;
  const sheetW = cw * COLS;
  const sheetH = ch * ROWS;

  // Not a canvas: node-canvas premultiplies, pushing edge pixels off-palette.
  const sheet = new Uint8ClampedArray(sheetW * sheetH * 4);
  frames.forEach((frame, i) => {
    const originX = (i % COLS) * cw;
    const originY = Math.floor(i / COLS) * ch;
    for (let y = 0; y < ch; y++) {
      const from = y * cw * 4;
      const to = ((originY + y) * sheetW + originX) * 4;
      sheet.set(frame.data.subarray(from, from + cw * 4), to);
    }
  });

  // bleedEdges' hidden colour is invisible once dithered, and costs ~10%.
  for (let p = 0; p < sheetW * sheetH; p++) {
    if (sheet[p * 4 + 3] !== 0) continue;
    sheet[p * 4] = 0;
    sheet[p * 4 + 1] = 0;
    sheet[p * 4 + 2] = 0;
  }

  // ~18% smaller for a shift of <=8/255 on the rim; 0 and 255 land exactly.
  if (alphaLevels < 256) {
    const step = 255 / (alphaLevels - 1);
    for (let p = 3; p < sheet.length; p += 4) {
      sheet[p] = Math.round(Math.round(sheet[p] / step) * step);
    }
  }

  const pam = path.join(outDir, `avatar-spin-${name}.pam`);
  const webp = path.join(outDir, `avatar-spin-${name}.webp`);
  const header =
    `P7\nWIDTH ${sheetW}\nHEIGHT ${sheetH}\nDEPTH 4\n` +
    `MAXVAL 255\nTUPLTYPE RGB_ALPHA\nENDHDR\n`;
  fs.writeFileSync(
    pam,
    Buffer.concat([Buffer.from(header), Buffer.from(sheet.buffer)]),
  );
  // Lossless wins here: the dither breaks DCT (-q 75 doubles it), PNG is +186%.
  execFileSync("cwebp", [
    "-quiet",
    "-lossless",
    "-exact",
    "-z",
    "9",
    pam,
    "-o",
    webp,
  ]);
  fs.unlinkSync(pam);

  const kb = (fs.statSync(webp).size / 1024).toFixed(1);
  console.log(
    `  ${name.padEnd(7)} ${palette.join(" ")}  ->  ${path.basename(webp)} ` +
      `(${sheetW}x${sheetH}, ${kb} kB)`,
  );
}

const palettes = readPalettes("src/style.css");

for (const name of themeNames) {
  if (!palettes[name]) {
    console.error(
      `unknown theme "${name}" (have: ${Object.keys(palettes).join(", ")})`,
    );
    process.exit(1);
  }
}

const files = fs
  .readdirSync(inDir)
  .filter((f) => /^frame_\d+\.png$/.test(f))
  .sort()
  .map((f) => path.join(inDir, f));

if (files.length !== COLS * ROWS) {
  console.error(
    `expected ${COLS * ROWS} frames in ${inDir}, found ${files.length}`,
  );
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });

let maskFiles = null;
if (maskDir) {
  maskFiles = fs
    .readdirSync(maskDir)
    .filter((f) => /^frame_\d+\.png$/.test(f))
    .sort()
    .map((f) => path.join(maskDir, f));
  if (maskFiles.length !== files.length) {
    console.error(
      `--mask has ${maskFiles.length} frames but --in has ${files.length}`,
    );
    process.exit(1);
  }
  if (block > 1) {
    console.error("--mask is ignored with --block > 1; rerun without --block");
    process.exit(1);
  }
}

const box = unionAlphaBox(await Promise.all(files.map(imageDataOf)));
console.log(
  `bayer ${matrixSize}x${matrixSize} · ${files.length} frames · block ${block} · ` +
    `gamma ${gamma} · bright ${brightness} · contrast ${contrast} · ` +
    (faceTone
      ? `face ${faceTone.brightness}/${faceTone.contrast}/${faceTone.gamma} · `
      : "") +
    `cell ${box[2] - box[0]}x${box[3] - box[1]} · -> ${outDir}/`,
);

for (const name of themeNames) {
  await buildTheme(
    name,
    paletteOverride ?? palettes[name],
    files,
    box,
    maskFiles,
  );
}
