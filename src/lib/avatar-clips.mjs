export const CLIP_CELL = { W: 207, H: 336 };

export const ATLAS = { sheet: "/avatar-atlas.webp", cols: 13, rows: 4 };

export const ATLAS_BACKGROUND_SIZE = `${ATLAS.cols * 100}% ${ATLAS.rows * 100}%`;

export const CLIPS = {
  walk: { offset: 0, frames: 12, fps: 14 },
  idle: { offset: 12, frames: 8, fps: 8 },
  sit: { offset: 20, frames: 8, fps: 6 },
  wave: { offset: 28, frames: 16, fps: 13 },
  "sit-down": { offset: 44, frames: 8, fps: 11 },
};

export const ONE_SHOT = ["wave", "sit-down"];

export const WALK_SETTLE = [3, 9];

export const WALK_LOOP_M = 1.3376;
export const CHARACTER_HEIGHT_M = 1.978;
export const WALK_SPEED = WALK_LOOP_M / CHARACTER_HEIGHT_M;

export function clipCellPosition(clip, index) {
  const { offset, frames } = CLIPS[clip];
  const cell = offset + (((index % frames) + frames) % frames);
  const col = cell % ATLAS.cols;
  const row = Math.floor(cell / ATLAS.cols);
  return `${(col * 100) / (ATLAS.cols - 1)}% ${(row * 100) / (ATLAS.rows - 1)}%`;
}
