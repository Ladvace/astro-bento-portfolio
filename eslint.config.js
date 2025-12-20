import eslintPluginAstro from "eslint-plugin-astro";
import jsxA11y from "eslint-plugin-jsx-a11y";

export default [
  ...eslintPluginAstro.configs.base,
  ...eslintPluginAstro.configs.recommended,
  {
    files: ["**/*.{js,astro}"],
    plugins: {
      "jsx-a11y": jsxA11y,
    },
    rules: {
      // Basic JS rules
      "no-unused-vars": "warn",
      "no-undef": "error",
      "no-console": "warn",
      "no-debugger": "error",

      // Astro-specific rules
      // "astro/no-conflict-set-directives": "error",
      "astro/no-unused-define-vars-in-style": "error",
      "astro/valid-compile": "error",

      // Accessibility rules (jsx-a11y recommended rules)
      ...jsxA11y.configs.recommended.rules,

      // You can add more rules here as needed
    },
  },
];
