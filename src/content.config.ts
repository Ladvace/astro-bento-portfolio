import { defineCollection } from "astro:content";
import { z } from "astro/zod";
import { glob } from "astro/loaders";
import { rssSchema } from "@astrojs/rss";

const dataDir = process.env.DEMO === "true" ? "./src/data/demo" : "./src/data";

const blog = defineCollection({
  loader: glob({ pattern: "**/[^_]*.md", base: `${dataDir}/blog` }),
  schema: rssSchema,
});

const works = defineCollection({
  loader: glob({ pattern: "**/[^_]*.md", base: `${dataDir}/works` }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string(),
      year: z.number(),
      current: z.boolean().default(false),
      endYear: z.number().optional(),
      role: z.string().optional(),
      stack: z.array(z.string()).default([]),
      cover: image().optional(),
      logo: image().optional(),
      logoBg: z.string().optional(),
      url: z.url().optional(),
      repo: z.url().optional(),
      featured: z.boolean().default(false),
      personal: z.boolean().default(false),
      order: z.number().optional(),
    }),
});

export const collections = { blog, works };
