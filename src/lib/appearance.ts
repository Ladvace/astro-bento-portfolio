import { AVATAR_THEMES } from "./avatar-sprite.mjs";

export const STYLES = [
  { id: "default", label: "Default" },
  { id: "style-glass", label: "Glass" },
  { id: "style-sharp", label: "Sharp" },
  { id: "style-neon", label: "Neon" },
  { id: "style-paper", label: "Paper" },
];

const named = (ids: string[]) => ids.filter((id) => id !== "default");

const THEME_CLASSES = named(
  AVATAR_THEMES.map((t: { theme: string }) => t.theme),
);
const STYLE_CLASSES = named(STYLES.map((s) => s.id));

export const BORDER_KEY = "cardBorder";

export const isCustomBorder = () =>
  (localStorage.getItem(BORDER_KEY) ?? "custom") === "custom";

export function applyAppearance(body: HTMLElement = document.body) {
  const theme = localStorage.getItem("theme");
  const style = localStorage.getItem("portfolioStyle");
  body.classList.remove(...THEME_CLASSES, ...STYLE_CLASSES);
  if (theme && theme !== "default") body.classList.add(theme);
  if (!isCustomBorder() && style && style !== "default")
    body.classList.add(style);
}
