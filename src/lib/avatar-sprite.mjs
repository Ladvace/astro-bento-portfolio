/** Geometry and paths for the spritesheets built by scripts/dither-avatar.mjs. */

const COLS = 6;
const ROWS = 4;

export const SPRITE = {
  COLS,
  ROWS,
  FRAMES: COLS * ROWS,
  CELL_W: 414,
  CELL_H: 390,
};

/** `theme` is the localStorage class, `name` is dither-avatar.mjs's --themes. */
export const AVATAR_THEMES = [
  { theme: "default", name: "red" },
  { theme: "yellow-theme", name: "yellow" },
  { theme: "green-theme", name: "green" },
  { theme: "blue-theme", name: "blue" },
  { theme: "purple-theme", name: "purple" },
].map((t) => ({ ...t, sheet: `/avatar-spin-${t.name}.webp` }));

export const UNDITHERED_SHEET = "/avatar-spin.webp";

export const SHEET_BY_THEME = Object.fromEntries(
  AVATAR_THEMES.map((t) => [t.theme, t.sheet]),
);

export const SHEET_BY_NAME = Object.fromEntries(
  AVATAR_THEMES.map((t) => [t.name, t.sheet]),
);

export const DEFAULT_SHEET = SHEET_BY_THEME.default;
