# ⚡️astro-bento-portfolio

## A personal portfolio website made using `Astro`.

![astro-bento-portfolio | Bento-like Personal Porfolio Template](public/preview.png)

To view a demo example, **[click here](https://sparkly-speculoos-0c9197.netlify.app/)**

or my portfolio **[click here](https://gianmarcocavallo.com/)**

## Features

- Modern and Minimal bento-like, sleek UI Design
- All in one page (almost)
- Fully Responsive
- Performances and SEO optimizations
- Ready to be deployed on [Netlify](https://www.netlify.com/)
- Blog
- RSS support (your-domain/rss.xml)
- Cool 3d globe

## Tech Stack

- [Astro](https://astro.build)
- [unocss](https://unocss.dev/)
- [motion](https://motion.dev/)
- [d3](https://d3js.org/)

# Steps ▶️

```bash
# Clone this repository
$ git clone https://github.com/Ladvace/astro-bento-portfolio
```

```bash
# Go into the repository
$ cd astro-bento-portfolio
```

```bash
# Install dependencies
$ pnpm install
or
$ npm install
```

```bash
# Start the project in development
$ pnpm run dev
or
$ npm run dev
```

# Customize your portfolio
After installing dependencies, run:

```bash
$ pnpm run site-setup
```

This updates `src/site-config.ts` (name, links, email, timezone, etc.) and sets `SITE_URL` in `.env`.

Then start the dev server again (`pnpm run dev`).

Even after `site-setup`, you still need to swap the avatar/memoji images (replace `src/assets/me*.webp` with your own).

## REMOVE THE umami analytics script tag (or replace it with your id) in `src/layouts/BasicLayout.astro`

# Configuration

`site` and sitemap/robots URLs are derived from `SITE_URL` (set by `pnpm run site-setup`).

# Deploy on Netlify 🚀

Deploying your website on Netlify it's optional but I reccomand it in order to deploy it faster and easly.

You just need to fork this repo and linking it to your Netlify account.

or

[![Netlify Deploy button](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/Ladvace/astro-bento-portfolio)

## Database Configuration

This project uses Astro DB with Turso for the guestbook feature. Set the following environment variables:

- `ASTRO_DB_REMOTE_URL=libsql://portfolio-ladvace.aws-eu-west-1.turso.io`
- `ASTRO_DB_APP_TOKEN=your-auth-token-here`

Run `pnpm astro db push` to initialize the database schema.

## Authors ❤️

- Gianmarco - https://github.com/Ladvace
