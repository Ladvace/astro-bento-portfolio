import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import Unocss from '@unocss/astro';
import sitemap from '@astrojs/sitemap';
import { sitemapFilter } from './src/lib/seo.mjs';
import { consentTextsIntegration } from './src/lib/consent-texts.mjs';

export default defineConfig({
  // 👇 ESTA LÍNEA ES LA LLAVE. SIN ELLA, NO HAY WEB.
  site: 'https://portfolio.romahomestore.com',

  // Adaptador Node en modo Standalone (Correcto para Coolify)
  adapter: node({
    mode: 'standalone',
  }),

  integrations: [
    Unocss({ injectReset: true }),
    sitemap({
      filter: sitemapFilter,
      i18n: { defaultLocale: 'es', locales: { es: 'es-CO', en: 'en' } },
    }),
    // Writes dist/server/consent-texts.json (consent_version -> text) for /api/lead.
    consentTextsIntegration(),
  ],
});