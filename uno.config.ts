// uno.config.ts
import { defineConfig, presetWind3 } from "unocss";

export default defineConfig({
  content: {
    filesystem: [
      "src/**/*.{html,js,ts,jsx,tsx,vue,svelte,astro}",
    ],
  },
  shortcuts: {
    /* Shared chrome for Button and BackLink: outline, lift and press. */
    "btn-chrome":
      "border border-primary-500 bg-darkslate-900 text-darkslate-50 shadow-custom shadow-primary-500 hover:text-primary-500 active:shadow-none active:translate-x-[3px] active:translate-y-[3px] transition-colors duration-100 ease-in-out",
  },
  safelist: [
    "bg-violet-500",
    "bg-sky-500",
    "bg-emerald-500",
    "bg-amber-500",
    "bg-rose-500",
    "bg-indigo-500",
    "bg-teal-500",
    "bg-orange-500",
  ],
  theme: {
    boxShadow: {
      custom: `2px 2px 0`,
      "custom-hover": `1px 1px 0`,
    },
    fontFamily: {
      sans: "var(--font-satoshi)",
    },
    fontSize: {
      "2xs": ["0.6875rem", "1rem"],
      "3xs": ["0.625rem", "0.875rem"],
      "4xs": ["0.5rem", "0.75rem"],
      "fluid-2xl": ["clamp(2.375rem, 4.75vw, 3.8rem)", "1.1"],
      "fluid-xl": ["clamp(1.4rem, 1.9vw, 2.375rem)", "1.1"],
      "fluid-lg": ["clamp(1.25rem, 3vw, 1.875rem)", "1.2"],
    },
    colors: {
      darkslate: {
        50: "var(--darkslate-50)",
        100: "var(--darkslate-100)",
        200: "var(--darkslate-200)",
        300: "var(--darkslate-300)",
        400: "var(--darkslate-400)",
        500: "var(--darkslate-500)",
        600: "var(--darkslate-600)",
        700: "var(--darkslate-700)",
        800: "var(--darkslate-800)",
        900: "var(--darkslate-900)",
      },
      primary: {
        100: "var(--primary-100)",
        200: "var(--primary-200)",
        300: "var(--primary-300)",
        400: "var(--primary-400)",
        500: "var(--primary-500)",
        600: "var(--primary-600)",
        700: "var(--primary-700)",
        800: "var(--primary-800)",
        900: "var(--primary-900)",
      },
    },
  },
  presets: [presetWind3()],
});
