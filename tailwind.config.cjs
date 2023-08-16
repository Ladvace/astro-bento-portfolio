/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  theme: {
    extend: {
      colors: {
        darkslate: {
          100: "#5B5B5B",
          200: "#505050",
          300: "#454545",
          400: "#3A3A3A",
          500: "#2F2F2F",
          600: "#242424",
          700: "#191919",
          800: "#0E0E0E",
          900: "#030303",
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
