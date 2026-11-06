import type { APIRoute } from 'astro';
import { createLeadHandler } from '../../lib/lead.mjs';
import { getWebsiteContent } from '../../lib/website-content';
import { resolveWebsiteContent } from '../../lib/website-model.mjs';

export const prerender = false;

// Server secrets are read at runtime from the container environment (Coolify), never PUBLIC_*.
const env = process.env;

/** Consent text currently shown by the form for that locale (same source as the built pages). */
async function consentText(locale: 'es' | 'en'): Promise<string> {
  try {
    return (await getWebsiteContent(locale)).home.consent_label;
  } catch {
    return resolveWebsiteContent({}, locale).home.consent_label;
  }
}

const handleLead = createLeadHandler({
  env,
  consentText,
  siteOrigin: (import.meta.env.SITE ? new URL(import.meta.env.SITE).origin : undefined),
});

export const POST: APIRoute = ({ request, clientAddress }) => handleLead(request, { clientAddress });
export const ALL: APIRoute = () => new Response(null, { status: 405, headers: { Allow: 'POST' } });
