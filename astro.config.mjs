import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import netlify from "@astrojs/netlify";
import robotsTxt from "astro-robots-txt";
import UnoCSS from "@unocss/astro";
import icon from "astro-icon";

import solidJs from "@astrojs/solid-js";
import { remarkReadingTime } from "./src/lib/remark-reading-time.mjs";

import svelte from "@astrojs/svelte";

import db from "@astrojs/db";

// https://astro.build/config
export default defineConfig({
  experimental: {
    svgo: true,
    fonts: [
      {
        provider: "local",
        name: "CabinetGrotesk",
        cssVariable: "--font-cabinet-grotesk",
        variants: [
          {
            weight: "100 1000",
            style: "normal",
            src: ["./src/assets/fonts/CabinetGrotesk-Variable.ttf"],
          },
        ],
      },
      {
        provider: "local",
        name: "Satoshi",
        cssVariable: "--font-satoshi",
        variants: [
          {
            weight: "100 1000",
            style: "normal",
            src: ["./src/assets/fonts/Satoshi-Variable.ttf"],
          },
          {
            weight: "100 1000",
            style: "italic",
            src: ["./src/assets/fonts/Satoshi-VariableItalic.ttf"],
          },
        ],
      },
    ],
  },
  site: "https://gianmarcocavallo.com/",
  integrations: [
    sitemap(),
    robotsTxt({
      sitemap: [
        "https://gianmarcocavallo.com/sitemap-index.xml",
        "https://gianmarcocavallo.com/sitemap-0.xml",
      ],
    }),
    solidJs(),
    UnoCSS({ injectReset: true }),
    icon(),
    svelte(),
    db(),
  ],
  markdown: {
    remarkPlugins: [remarkReadingTime],
  },
  output: "server",
  adapter: netlify({ edgeMiddleware: true }),
  vite: {
    assetsInclude: "**/*.riv",
  },
});
