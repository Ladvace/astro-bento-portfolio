const defaultTheme = require("tailwindcss/defaultTheme");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["CabinetGrotesk", "Satoshi", ...defaultTheme.fontFamily.sans],
      },
      gridTemplateRows: {
        "auto-250": "repeat(auto-fill, 250px)",
      },
      gridTemplateColumns: {
        "4-minmax": "repeat(4, minmax(150px, 1fr))",
      },
      colors: {
        darkslate: {
          50: "#3D3D3D",
          100: "#2C2C2C",
          200: "#262626",
          300: "#202020",
          400: "#1A1A1A",
          500: "#171717" /* Exactly your example for the background */,
          600: "#141414",
          700: "#111111",
          800: "#0E0E0E",
          900: "#0B0B0B" /* Deeper and darker */,
        },
        primary: {
          100: "#F9CDD3",
          200: "#F3A3AA",
          300: "#EC7981",
          400: "#E64F59",
          500: "#E63946",
          600: "#CF2F3D",
          700: "#B82534",
          800: "#A01B2B",
          900: "#891321",
        },
      },
    },
  },
  plugins: [],
};
