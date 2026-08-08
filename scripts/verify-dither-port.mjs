#!/usr/bin/env node
/**
 * Assert src/lib/dither.mjs still reproduces `dither-me-this` exactly.
 *
 *   node scripts/verify-dither-port.mjs <a-frame.png>
 *
 * Alpha is excluded; destroying it is the one upstream behaviour not copied.
 */
import { createCanvas, loadImage } from "canvas";
import process from "node:process";
import library from "dither-me-this";
import { bayerMatrix, ditherImage } from "../src/lib/dither.mjs";

const file = process.argv[2];
if (!file) {
  console.error("usage: node scripts/verify-dither-port.mjs <a-frame.png>");
  process.exit(1);
}

const PALETTE = ["#f7fafc", "#e63946", "#171717", "#b82534", "#891321"];

/** Opaque on purpose: the library takes one more premultiplying encode hop. */
const imageDataOf = async (src) => {
  const img = await loadImage(src);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);
  const image = ctx.getImageData(0, 0, img.width, img.height);
  for (let p = 3; p < image.data.length; p += 4) image.data[p] = 255;
  return image;
};

const toPng = (image) => {
  const canvas = createCanvas(image.width, image.height);
  canvas.getContext("2d").putImageData(image, 0, 0);
  return canvas.toBuffer("image/png");
};

const libMatrix = (await import("dither-me-this/src/functions/bayer-matrix.js"))
  .default;
for (const size of [
  [2, 2],
  [3, 3],
  [4, 4],
  [8, 8],
]) {
  const a = JSON.stringify(libMatrix(size));
  const b = JSON.stringify(bayerMatrix(size));
  if (a !== b) {
    console.error(`FAIL bayerMatrix(${size}):\n  library ${a}\n  port    ${b}`);
    process.exit(1);
  }
  console.log(`ok  bayerMatrix(${size.join("x")})`);
}

let failures = 0;
for (const matrix of [
  [2, 2],
  [4, 4],
  [8, 8],
]) {
  const source = await imageDataOf(file);

  const fromLibrary = await imageDataOf(
    await library(toPng(source), {
      ditheringType: "ordered",
      orderedDitheringType: "bayer",
      orderedDitheringMatrix: matrix,
      palette: PALETTE,
    }),
  );

  const fromPort = ditherImage(await imageDataOf(file), {
    palette: PALETTE,
    matrix,
  });

  let diff = 0;
  let firstAt = null;
  for (let p = 0; p < fromPort.data.length; p += 4) {
    for (let c = 0; c < 3; c++) {
      if (fromLibrary.data[p + c] !== fromPort.data[p + c]) {
        if (firstAt === null) firstAt = p / 4;
        diff++;
        break;
      }
    }
  }

  const total = fromPort.data.length / 4;
  if (diff) {
    failures++;
    const i = firstAt;
    console.error(
      `FAIL ${matrix.join("x")}: ${diff}/${total} pixels differ, first at index ${i} ` +
        `(library ${[0, 1, 2].map((c) => fromLibrary.data[i * 4 + c])} ` +
        `vs port ${[0, 1, 2].map((c) => fromPort.data[i * 4 + c])})`,
    );
  } else {
    console.log(`ok  ${matrix.join("x")} dither: ${total} pixels identical`);
  }
}

if (failures) process.exit(1);
console.log("\nport is byte-identical to dither-me-this");
