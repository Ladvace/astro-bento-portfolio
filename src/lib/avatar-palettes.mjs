import fs from "node:fs";
import { AVATAR_THEMES } from "./avatar-sprite.mjs";

const HIGHLIGHT = "#f7fafc";

const THEME_SELECTORS = Object.fromEntries(
  AVATAR_THEMES.map(({ theme, name }) => [
    name,
    theme === "default" ? ":root" : `.${theme}`,
  ]),
);

export function readPalettes(cssPath = "src/style.css") {
  const css = fs.readFileSync(cssPath, "utf8");

  const blockFor = (selector) => {
    const re = new RegExp(
      `${selector.replace(/[.:]/g, "\\$&")}\\s*\\{([^}]*)\\}`,
    );
    const m = css.match(re);
    if (!m) throw new Error(`no ${selector} block in ${cssPath}`);
    return m[1];
  };

  const varFrom = (text, name) => {
    const m = text.match(new RegExp(`--${name}\\s*:\\s*(#[0-9a-f]{3,8})`, "i"));
    if (!m) throw new Error(`no --${name} found in ${cssPath}`);
    return m[1];
  };

  const shadow = varFrom(blockFor(":root"), "darkslate-500");

  return Object.fromEntries(
    Object.entries(THEME_SELECTORS).map(([name, selector]) => {
      const text = blockFor(selector);
      return [
        name,
        [
          HIGHLIGHT,
          varFrom(text, "primary-500"),
          shadow,
          varFrom(text, "primary-700"),
          varFrom(text, "primary-900"),
        ],
      ];
    }),
  );
}
