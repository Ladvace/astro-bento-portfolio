export const CLIP_CELL = { W: 207, H: 336 };

export const CLIPS = {
  walk: { sheet: "/avatar-walk.webp", cols: 6, rows: 2, frames: 12, fps: 14 },
  idle: { sheet: "/avatar-idle.webp", cols: 4, rows: 2, frames: 8, fps: 8 },
  sit: { sheet: "/avatar-sit.webp", cols: 4, rows: 2, frames: 8, fps: 6 },
  wave: { sheet: "/avatar-wave.webp", cols: 8, rows: 2, frames: 16, fps: 13 },
  "sit-down": {
    sheet: "/avatar-sit-down.webp",
    cols: 4,
    rows: 2,
    frames: 8,
    fps: 11,
  },
};

export const ONE_SHOT = ["wave", "sit-down"];

export const WALK_SETTLE = [3, 9];

export const WALK_LOOP_M = 1.3376;
export const CHARACTER_HEIGHT_M = 1.978;
export const WALK_SPEED = WALK_LOOP_M / CHARACTER_HEIGHT_M;

export function clipCellPosition(clip, index) {
  const { cols, rows, frames } = CLIPS[clip];
  const i = ((index % frames) + frames) % frames;
  const col = i % cols;
  const row = Math.floor(i / cols);
  return `${(col * 100) / (cols - 1)}% ${(row * 100) / (rows - 1)}%`;
}

export function clipBackgroundSize(clip) {
  const { cols, rows } = CLIPS[clip];
  return `${cols * 100}% ${rows * 100}%`;
}
