import eslintPluginAstro from "eslint-plugin-astro";

export default [
  ...eslintPluginAstro.configs.base,
  ...eslintPluginAstro.configs.recommended,
  {
    files: ["**/*.{js,astro}"],
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

      // You can add more rules here as needed
    },
  },
];
