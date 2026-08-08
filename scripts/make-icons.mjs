#!/usr/bin/env node
/**
 * Generate the favicon / manifest icon set from the avatar's head.
 *
 *   node scripts/make-icons.mjs --in <frames-dir> [--out public]
 *
 * Each size is quantised at its own resolution, never downscaled from a larger
 * dither, so the dots stay one pixel. Below ~96px the dither is dropped
 * entirely: the checkerboard turns the face to noise, while flat quantisation
 * still reads at 16px. Needs a frame rendered at TT_SIZE=1536.
 */
import { createCanvas, loadImage } from "canvas";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { readPalettes } from "../src/lib/avatar-palettes.mjs";
import { bleedEdges, ditherImage } from "../src/lib/dither.mjs";

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};

const inDir = flag("in");
const outDir = flag("out", "public");
if (!inDir) {
  console.error(
    "usage: node scripts/make-icons.mjs --in <frames-dir> [--out public]",
  );
  process.exit(1);
}

const PALETTE = readPalettes("src/style.css").red;
const BACKDROP = PALETTE[2];

/** Fractions of the frame; any lower and the collar reads as a stem. */
const CROP = [0.3242, 0.1133, 0.6758, 0.4648];

/** `pad` is empty space per side; 12% keeps maskable icons inside the safe zone. */
const TARGETS = [
  { file: "web-app-manifest-512x512.png", size: 512, pad: 0.12, dither: true },
  { file: "web-app-manifest-192x192.png", size: 192, pad: 0.12, dither: true },
  { file: "apple-touch-icon.png", size: 180, pad: 0.08, dither: true },
  { file: "favicon-96x96.png", size: 96, pad: 0.06, dither: false },
];
const ICO_SIZES = [16, 32, 48];
const SVG_SIZE = 32;

const imageDataOf = async (src) => {
  const img = await loadImage(src);
  const c = createCanvas(img.width, img.height);
  const ctx = c.getContext("2d");
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, img.width, img.height);
};

const frame = await imageDataOf(path.join(inDir, "frame_000.png"));
const head = (() => {
  const c = createCanvas(frame.width, frame.height);
  const ctx = c.getContext("2d");
  ctx.putImageData(frame, 0, 0);
  const [x0, y0, x1, y1] = CROP.map((f, i) =>
    Math.round(f * (i % 2 === 0 ? frame.width : frame.height)),
  );
  return ctx.getImageData(x0, y0, x1 - x0, y1 - y0);
})();
bleedEdges(head);

const source = createCanvas(head.width, head.height);
source.getContext("2d").putImageData(head, 0, 0);

const needed = Math.max(
  ...TARGETS.map((t) => Math.round(t.size * (1 - t.pad * 2))),
);
if (head.width < needed) {
  console.error(
    `head crop is ${head.width}px but ${needed}px is needed; ` +
      `re-render frame 0 with TT_SIZE=${Math.ceil((needed / 0.3516 / 256) * 256)}`,
  );
  process.exit(1);
}

function render(size, pad, dither) {
  const c = createCanvas(size, size);
  const ctx = c.getContext("2d");
  ctx.fillStyle = BACKDROP;
  ctx.fillRect(0, 0, size, size);

  const inset = Math.round(size * pad);
  ctx.drawImage(source, inset, inset, size - inset * 2, size - inset * 2);

  const data = ctx.getImageData(0, 0, size, size);
  ditherImage(data, { palette: PALETTE, matrix: [2, 2], ordered: dither });
  ctx.putImageData(data, 0, 0);
  return c;
}

fs.mkdirSync(outDir, { recursive: true });
const written = [];

for (const { file, size, pad, dither } of TARGETS) {
  const target = path.join(outDir, file);
  fs.writeFileSync(target, render(size, pad, dither).toBuffer("image/png"));
  written.push(file);
}

/** ICO is just a directory of embedded PNGs. */
function ico(sizes) {
  const pngs = sizes.map((size) =>
    render(size, 0.04, false).toBuffer("image/png"),
  );
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);

  let offset = 6 + pngs.length * 16;
  const entries = pngs.map((png, i) => {
    const e = Buffer.alloc(16);
    e.writeUInt8(sizes[i], 0);
    e.writeUInt8(sizes[i], 1);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(png.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += png.length;
    return e;
  });
  return Buffer.concat([header, ...entries, ...pngs]);
}

fs.writeFileSync(path.join(outDir, "favicon.ico"), ico(ICO_SIZES));
written.push(`favicon.ico (${ICO_SIZES.join("/")})`);

/** Flat quantisation leaves solid regions, so runs merge into a few rects. */
function svgOf(size) {
  const px = render(size, 0.04, false)
    .getContext("2d")
    .getImageData(0, 0, size, size).data;
  const hex = (i) =>
    `#${[0, 1, 2].map((k) => px[i + k].toString(16).padStart(2, "0")).join("")}`;

  const rects = [];
  for (let y = 0; y < size; y++) {
    let start = 0;
    let color = hex(y * size * 4);
    for (let x = 1; x <= size; x++) {
      const next = x < size ? hex((y * size + x) * 4) : null;
      if (next === color) continue;
      if (color !== BACKDROP) {
        rects.push(
          `<rect x="${start}" y="${y}" width="${x - start}" height="1" fill="${color}"/>`,
        );
      }
      start = x;
      color = next;
    }
  }
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">`,
    `<rect width="${size}" height="${size}" fill="${BACKDROP}"/>`,
    ...rects,
    "</svg>\n",
  ].join("");
}

const svg = svgOf(SVG_SIZE);
fs.writeFileSync(path.join(outDir, "favicon.svg"), svg);
written.push(`favicon.svg (${svg.split("<rect").length - 2} rects)`);

const manifest = {
  name: "Gianmarco Cavallo",
  short_name: "Gian. C.",
  icons: [
    {
      src: "/web-app-manifest-192x192.png",
      sizes: "192x192",
      type: "image/png",
      purpose: "any maskable",
    },
    {
      src: "/web-app-manifest-512x512.png",
      sizes: "512x512",
      type: "image/png",
      purpose: "any maskable",
    },
  ],
  theme_color: BACKDROP,
  background_color: BACKDROP,
  display: "standalone",
};
fs.writeFileSync(
  path.join(outDir, "site.webmanifest"),
  `${JSON.stringify(manifest, null, 2)}\n`,
);
written.push("site.webmanifest");

const kb = (f) => (fs.statSync(path.join(outDir, f)).size / 1024).toFixed(1);
console.log(`palette ${PALETTE.join(" ")}  backdrop ${BACKDROP}`);
for (const f of written) {
  const name = f.split(" ")[0];
  console.log(
    `  ${name.padEnd(30)} ${kb(name).padStart(7)} kB  ${f.slice(name.length)}`,
  );
}
