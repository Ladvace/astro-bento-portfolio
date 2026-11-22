# <img src=".github/readme/icons/bolt.svg" width="28" height="28" alt="" /> astro-bento-portfolio

A modern, bento-style personal portfolio built with **[Astro](https://astro.build)**.

![astro-bento-portfolio — a bento-like personal portfolio template](public/preview.webp)

**Live:** [gianmarcocavallo.com](https://gianmarcocavallo.com/) · **Demo:** [demo.gianmarcocavallo.com](https://demo.gianmarcocavallo.com/)

---

## Features

- <img src=".github/readme/icons/puzzle.svg" width="16" height="16" alt="" /> **Bento-grid layout** — sleek, minimal, single-page-first design
- <img src=".github/readme/icons/palette.svg" width="16" height="16" alt="" /> **Switchable UI themes** — glass, sharp, neon and paper styles, with color variants
- <img src=".github/readme/icons/phone.svg" width="16" height="16" alt="" /> **Fully responsive**
- <img src=".github/readme/icons/pencil.svg" width="16" height="16" alt="" /> **Blog** with Markdown content, reading-time estimates and **RSS** (`/rss.xml`)
- <img src=".github/readme/icons/puzzle.svg" width="16" height="16" alt="" /> **Works** — Markdown case studies for your projects (`/works`)
- <img src=".github/readme/icons/speech.svg" width="16" height="16" alt="" /> **Guestbook** — visitors can leave messages and reactions (backed by libSQL)
- <img src=".github/readme/icons/globe.svg" width="16" height="16" alt="" /> **Interactive 3D globe** and a **travel map** of visited countries
- <img src=".github/readme/icons/flask.svg" width="16" height="16" alt="" /> **Playground** — a collection of animation/interaction experiments (GSAP morphs, Rive, WebGL-ish effects, scroll animations, and more)
- <img src=".github/readme/icons/speaker.svg" width="16" height="16" alt="" /> Subtle **UI sound effects** (toggleable)
- <img src=".github/readme/icons/rocket.svg" width="16" height="16" alt="" /> **Performance & SEO optimized** — sitemap, robots.txt, Open Graph tags
- <img src=".github/readme/icons/cloud.svg" width="16" height="16" alt="" /> Ready to deploy on **[Netlify](https://www.netlify.com/)** (SSR)

## Tech Stack

| Area       | Tools                                                                                                                             |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Framework  | [Astro](https://astro.build) (SSR)                                                                                                |
| Styling    | [UnoCSS](https://unocss.dev/)                                                                                                     |
| UI islands | [SolidJS](https://www.solidjs.com/), [Svelte](https://svelte.dev/)                                                                |
| Animation  | [Motion](https://motion.dev/), [GSAP](https://gsap.com/), [Lenis](https://lenis.darkroom.engineering/), [Rive](https://rive.app/) |
| Dataviz    | [D3](https://d3js.org/) (globe)                                                                                                   |
| Database   | [Drizzle ORM](https://orm.drizzle.team/) on [libSQL / Turso](https://turso.tech/) (guestbook)                                     |
| Hosting    | [Netlify adapter](https://docs.astro.build/en/guides/integrations-guide/netlify/)                                                 |

## Prerequisites

- **Node.js** `24.13.0` (see [`.nvmrc`](.nvmrc) — run `nvm use`)
- **[pnpm](https://pnpm.io/)** (this repo uses `pnpm@10`)

## Getting Started

```bash
# 1. Clone
git clone https://github.com/Ladvace/astro-bento-portfolio
cd astro-bento-portfolio

# 2. Install dependencies
pnpm install

# 3. Start the dev server (http://localhost:4321)
pnpm dev
```

## Make It Yours

Run the interactive setup to personalize the site:

```bash
pnpm site-setup
```

This walks you through your name, links, email, location/timezone and more, updating `src/site-config.ts` and writing `SITE_URL` to `.env`. Restart the dev server afterwards.

A few things the script **doesn't** cover:

- Swap the avatar/memoji images — replace `src/assets/me-dither*.webp` with your own.
- Remove (or replace with your own ID) the **Umami analytics** script tag in `src/layouts/BasicLayout.astro`.

### Works or Blog on the home grid

The home grid has one tile shared by **Works** and **Blog**, picked by what you've written: it links to whichever has entries, and splits into two half tiles when both do. With neither, it shows Blog.

To add a project, drop a Markdown file in `src/data/works/`. Two options under `works` in `src/site-config.ts` control how much each card shows: `descriptions: true` adds the description to the card, and `detailPages: true` turns each file's body into a case study page at `/works/<file-name>`:

```md
---
title: My project
description: One-line summary (shown when works.descriptions is on).
year: 2026
role: Design & development # optional
stack: [Astro, TypeScript]
cover: ../../assets/works/my-project.webp # optional
url: https://example.com # optional
repo: https://github.com/you/my-project # optional
current: true # optional, still ongoing: shows "2026 – Now"
endYear: 2027 # optional, finished: shows "2026 – 2027" (use one or the other)
personal: true # optional, Personal instead of Professional badge
order: 1 # optional, breaks ties within a year
---

## Overview

What it is, what you did, how it turned out.
```

### Demo mode

Building with `DEMO=true` reads content from `src/data/demo/` instead of `src/data/`: sample blog posts and no works, so the home grid shows the Blog tile and `/works` redirects home. Demo pages are also marked `noindex` so they don't compete with your real site in search results. Preview it locally with `pnpm dev:demo`.

To host a demo next to your real site, create a second Netlify site from the same repo, set the `DEMO=true` environment variable on it, and give it its own domain (e.g. `demo.yourdomain.com`).

## Scripts

| Command           | Description                          |
| ----------------- | ------------------------------------ |
| `pnpm dev`        | Start the dev server                 |
| `pnpm dev:demo`   | Start the dev server in demo mode    |
| `pnpm build`      | Production build                     |
| `pnpm preview`    | Preview the production build locally |
| `pnpm check`      | Type-check with `astro check`        |
| `pnpm eslint`     | Lint `src`                           |
| `pnpm format`     | Format with Prettier                 |
| `pnpm site-setup` | Interactive personalization          |

## Database (Guestbook) (optional)

The guestbook uses [Drizzle ORM](https://orm.drizzle.team/) over a remote **libSQL** database (e.g. [Turso](https://turso.tech/)). The rest of the site builds and runs without it; only the guestbook page needs it. Provide your database credentials as environment variables:

```bash
TURSO_DATABASE_URL=libsql://<your-database>.turso.io
TURSO_AUTH_TOKEN=<your-auth-token>
GUESTBOOK_ADMIN_SECRET=<output of: openssl rand -hex 32>
```

Only you can reply to guestbook messages. Log in at `/guestbook/login` with `GUESTBOOK_ADMIN_SECRET` and the reply forms appear on the guestbook. Without a secret of at least 32 characters, replying stays disabled.

Then create the table:

```sql
CREATE TABLE "Guestbook" (
  "id" integer PRIMARY KEY,
  "name" text NOT NULL,
  "message" text NOT NULL,
  "website" text,
  "parentId" integer,
  "heartCount" integer,
  "createdAt" text NOT NULL
);
```

The client and schema live in `src/lib/db.ts`. `createdAt` is stored as an ISO 8601 string.

> These variables must be set in your deploy environment. If you don't need the guestbook, delete `src/lib/db.ts`, `src/pages/guestbook.astro`, `src/pages/guestbook/login.astro`, `src/lib/guestbook-auth.ts` and the `src/pages/api/guestbook.ts` / `api/guestbook/session.ts` / `reactions.ts` routes.

## Deploy on Netlify <img src=".github/readme/icons/rocket.svg" width="24" height="24" alt="" />

Deploying on Netlify is optional but recommended for the quickest setup. Fork this repo and link it to your Netlify account — or use the one-click button below. If you use the guestbook, set the database environment variables (above) in your Netlify site settings.

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/Ladvace/astro-bento-portfolio)

## License

Released under the [MIT License](LICENSE).

## Author

**Gianmarco Cavallo** — [github.com/Ladvace](https://github.com/Ladvace) · [gianmarcocavallo.com](https://gianmarcocavallo.com/)
