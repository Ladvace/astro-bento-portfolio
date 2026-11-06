import type { APIRoute } from 'astro';
import { createLeadHandler } from '../../lib/lead.mjs';
import { createLeadTracker, DEFAULT_POSTHOG_HOST } from '../../lib/posthog-server.mjs';
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
  track: createLeadTracker({
    apiKey: env.PUBLIC_POSTHOG_KEY || import.meta.env.PUBLIC_POSTHOG_KEY,
    host: env.POSTHOG_HOST || DEFAULT_POSTHOG_HOST,
  }),
});

export const POST: APIRoute = ({ request, clientAddress }) => handleLead(request, { clientAddress });
export const ALL: APIRoute = () => new Response(null, { status: 405, headers: { Allow: 'POST' } });
