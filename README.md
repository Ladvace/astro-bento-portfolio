# ROMA — Rodríguez Mariño Consulting

Bilingual (ES/EN) lead-generation site. Astro 5 (`@astrojs/node`, standalone) + UnoCSS. Content comes from Directus (`cms.romahomestore.com`) with a local fallback in `src/content/website-defaults.json`.

```bash
pnpm install --frozen-lockfile
pnpm dev        # local dev
pnpm build      # production build
pnpm test       # node --test tests/*.test.mjs
pnpm check      # astro check
```

See `docs/` for CMS editing, locale routing, publication and QA notes.
