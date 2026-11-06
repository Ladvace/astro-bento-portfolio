# SEO técnico

## URLs canónicas
- Artículos: `/{es|en}/blog/<slug>/`. Índice: `/{es|en}/blog/`. Servicios: `/{es|en}/servicios/{legal|data}/`.
- Legado con 301 directo (sin cadenas), implementado como rutas SSR en `src/pages/{blog,project,[locale]/project}/` con `legacyRedirect()` de `src/lib/seo.mjs`:
  `/blog/*`, `/project/*`, `/es/project/*` -> `/es/blog/*`; `/en/project/*` -> `/en/blog/*`; índices `/blog/`, `/project/` -> `/es/blog/`; `/{locale}/project/` -> `/{locale}/blog/`.
- No se generan HTML para esas rutas. `/travel` -> `/` (301).
- Un slug inexistente redirige igual y la canónica responde 404.

## Sitemap, robots, llms.txt
- `@astrojs/sitemap` con i18n (es -> es-CO, en) y `sitemapFilter` (solo `/{locale}/...`, sin `/project/`, `/gracias`, `/api`, `/ingest`). Índice: `/sitemap-index.xml`.
- `/robots.txt` (estático): `Disallow: /` si `PUBLIC_NOINDEX=true` en build.
- `/llms.txt` generado en build desde `getWebsiteContent` y los artículos.
- Nota: hreflang en `<head>` usa `es`/`en`; el sitemap emite `es-CO`/`en`.

## JSON-LD
`buildGraph()` en `src/lib/seo.mjs` (usado por `RomaLayout`): ProfessionalService, LegalService, 2 Person, WebSite, WebPage/BlogPosting, BreadcrumbList (servicios y artículos). `sameAs` solo si hay `linkedin_url` (personas) o `globals.linkedin_url`; `image` si hay `photo`; FAQPage solo en la home si `site.faq` es un arreglo con `question|q|title` y `answer|a|body`. Artículos: `inLanguage: en` (el cuerpo está en inglés).

## Fuentes
Self-host en `public/roma/fonts/` (woff2 latin, licencia OFL en `LICENSE.txt`), `@font-face` inline con `font-display: swap`, preload solo de IBM Plex Sans.

## Cache-Control
- `/_astro/*`: el adaptador node ya envía `public, max-age=31536000, immutable`.
- `/roma/fonts/*` (y el resto de `public/`): el adaptador **no** permite fijar cabeceras para archivos estáticos (se sirven antes del middleware) y responde `max-age=0`. Alternativa en Traefik (middleware de cabeceras en las labels del servicio en Coolify):

```
traefik.http.middlewares.roma-fonts-cache.headers.customresponseheaders.Cache-Control=public, max-age=31536000, immutable
traefik.http.routers.roma-fonts.rule=Host(`portfolio.romahomestore.com`) && PathPrefix(`/roma/fonts/`)
traefik.http.routers.roma-fonts.middlewares=roma-fonts-cache
```
(el router debe replicar entrypoints/tls/servicio del router principal). Los nombres de archivo de fuentes son versionables: si se cambian, renombrar el archivo.
