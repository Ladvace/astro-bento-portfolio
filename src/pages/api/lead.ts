import type { APIRoute } from 'astro';
import { createLeadHandler } from '../../lib/lead.mjs';
import { readConsentTexts } from '../../lib/consent-texts.mjs';
import { resolveWebsiteContent } from '../../lib/website-model.mjs';

export const prerender = false;

// Server secrets are read at runtime from the container environment (Coolify), never PUBLIC_*.
const env = process.env;

// Consent texts shown by the prerendered forms, written at build time next to the server bundle
// (src/lib/consent-texts.mjs). Read once at startup: the request path never queries the CMS.
const consentTexts = readConsentTexts({ explicitPath: env.LEAD_CONSENT_TEXTS_PATH, fromUrl: import.meta.url });
if (!consentTexts) console.error('[lead] consent-texts.json no encontrado: consent_text se guardará con el texto por defecto marcado [version desconocida]');

const handleLead = createLeadHandler({
  env,
  consentTexts,
  consentFallback: (locale: 'es' | 'en') => resolveWebsiteContent({}, locale).home.consent_label,
  siteOrigin: (import.meta.env.SITE ? new URL(import.meta.env.SITE).origin : undefined),
});

export const POST: APIRoute = ({ request, clientAddress }) => handleLead(request, { clientAddress });
export const ALL: APIRoute = () => new Response(null, { status: 405, headers: { Allow: 'POST' } });
