import { randomUUID } from 'node:crypto';

export const DEFAULT_POSTHOG_HOST = 'https://eu.i.posthog.com';

/**
 * Server-side `lead_created` capture. Only non-personal properties are sent (area, locale, UTM).
 * The flush is bounded by `timeoutMs`; any PostHog failure is swallowed by the caller.
 * @param {{ apiKey?: string, host?: string, timeoutMs?: number, createClient?: (key: string, options: object) => any }} options
 */
export function createLeadTracker({ apiKey, host = DEFAULT_POSTHOG_HOST, timeoutMs = 1500, createClient } = {}) {
  if (!apiKey) return async () => {};
  let client;
  /** @param {{ distinctId?: string, area: string, locale: string, utm_source?: string|null, utm_medium?: string|null, utm_campaign?: string|null }} event */
  return async function trackLead({ distinctId, area, locale, utm_source, utm_medium, utm_campaign }) {
    if (!client) {
      const factory = createClient ?? (async (key, options) => new (await import('posthog-node')).PostHog(key, options));
      client = await factory(apiKey, { host, flushAt: 1, flushInterval: 0, requestTimeout: timeoutMs });
    }
    const anonymous = !distinctId;
    client.capture({
      distinctId: distinctId || randomUUID(),
      event: 'lead_created',
      properties: {
        area, locale,
        ...(utm_source ? { utm_source } : {}), ...(utm_medium ? { utm_medium } : {}), ...(utm_campaign ? { utm_campaign } : {}),
        source: 'api_lead',
        // No browser id (no JS / blocked): count the event without creating a throwaway person.
        ...(anonymous ? { $process_person_profile: false } : {}),
      },
    });
    let timer;
    try {
      await Promise.race([
        client.flush(),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('PostHog flush timeout')), timeoutMs); }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  };
}
