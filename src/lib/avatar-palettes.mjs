import fs from "node:fs";

export const HIGHLIGHT = "#f7fafc";

export const THEME_SELECTORS = {
  red: ":root",
  yellow: ".yellow-theme",
  green: ".green-theme",
  blue: ".blue-theme",
  purple: ".purple-theme",
};

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
