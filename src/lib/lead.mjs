/**
 * Lead capture: pure request handling for POST /api/lead (no Astro, no globals).
 *
 * Everything with side effects (Directus fetch, PostHog, clock, logger, consent text) is injected,
 * so the whole flow is testable with web-standard Request/Response objects.
 *
 * Client IP (rate limit): Astro's `clientAddress` is the FIRST X-Forwarded-For value, which any client
 * can forge. Behind Coolify's Traefik the reliable value is the one appended by our own proxy, i.e.
 * the value `trustedProxyHops` positions from the RIGHT (default 1 = last value, set by Traefik from
 * the TCP peer). If the request carries no X-Forwarded-For (direct connection, local run) the
 * socket address supplied by the adapter is used. Set LEAD_TRUSTED_PROXY_HOPS=2 if a CDN
 * (e.g. Cloudflare) is ever placed in front of Traefik, or 0 to ignore the header entirely.
 */

export const LEAD_AREAS = Object.freeze(['legal', 'data']);
export const LEAD_LOCALES = Object.freeze(['es', 'en']);
export const LEAD_ERROR_CODES = Object.freeze([
  'invalid', 'consent', 'contact', 'forbidden', 'too_large', 'unsupported', 'rate_limited', 'unavailable', 'server',
]);
export const MAX_BODY_BYTES = 10 * 1024;
export const MIN_FILL_MS = 3000;
export const DIRECTUS_TIMEOUT_MS = 8000;
export const DEFAULT_DIRECTUS_URL = 'https://cms.romahomestore.com';
export const DEFAULT_SITE_ORIGIN = 'https://portfolio.romahomestore.com';

const STATUS = { invalid: 400, consent: 400, contact: 400, forbidden: 403, too_large: 413, unsupported: 415, rate_limited: 429, unavailable: 503, server: 502 };

// ------------------------------------------------------------------------------------------------
// Rate limiting (fixed window per key, in memory: per process, resets on deploy/restart)
// ------------------------------------------------------------------------------------------------
export function createRateLimiter({ limit = 5, windowMs = 10 * 60 * 1000, maxKeys = 10000, now = Date.now } = {}) {
  const hits = new Map();
  function prune(t) {
    for (const [key, entry] of hits) if (entry.reset <= t) hits.delete(key);
  }
  return {
    /** Counts one attempt; returns false when the key is over the limit. */
    hit(key) {
      const t = now();
      let entry = hits.get(key);
      if (!entry || entry.reset <= t) {
        if (hits.size >= maxKeys) prune(t);
        // Still full after pruning: fail closed for new keys instead of growing without bound.
        if (hits.size >= maxKeys) return false;
        entry = { count: 0, reset: t + windowMs };
        hits.set(key, entry);
      }
      entry.count += 1;
      return entry.count <= limit;
    },
    size: () => hits.size,
  };
}

/** Trusted client IP: see module comment. */
export function clientIp(headers, fallback = '', trustedProxyHops = 1) {
  const chain = String(headers.get('x-forwarded-for') ?? '').split(',').map(value => value.trim()).filter(Boolean);
  const hops = Number.isInteger(trustedProxyHops) && trustedProxyHops > 0 ? trustedProxyHops : 0;
  if (hops > 0 && chain.length > 0) return chain[Math.max(0, chain.length - hops)];
  return String(fallback || 'unknown');
}

// ------------------------------------------------------------------------------------------------
// Validation (pure)
// ------------------------------------------------------------------------------------------------
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const EMAIL = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}@(?=.{1,253}$)[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;
const PHONE = /^\+?\d{7,20}$/;
const DISTINCT_ID = /^[A-Za-z0-9._:@$-]{1,200}$/;
const TRUE_VALUES = new Set(['true', 'on', '1', 'yes', 'si', 'sí']);

const text = (value, max) => (typeof value === 'string' || typeof value === 'number' ? String(value) : '')
  .replace(CONTROL, '').trim().slice(0, max);
const singleLine = (value, max) => text(value, max * 2).replace(/\s+/g, ' ').slice(0, max);

/** Internal pathname only ("/es/", "/en/servicios/legal/"); anything else becomes ''. */
export function safePagePath(value) {
  const raw = text(value, 2048);
  if (!raw) return '';
  try {
    const base = new URL('https://internal.invalid');
    const url = new URL(raw, base);
    if (url.origin !== base.origin) return '';
    return url.pathname.slice(0, 2048);
  } catch {
    return '';
  }
}

/**
 * Normalizes and validates a submitted payload.
 * @returns {{ ok: true, lead: object, bot: boolean } | { ok: false, error: string, locale: string, page: string }}
 */
export function validateLead(input, { now = Date.now(), consentText = () => '' } = {}) {
  const field = key => (input && Object.hasOwn(input, key) ? input[key] : undefined);
  const localeRaw = text(field('locale'), 8);
  const locale = LEAD_LOCALES.includes(localeRaw) ? localeRaw : 'es';
  const page = safePagePath(field('page'));
  const fail = error => ({ ok: false, error, locale, page });

  // Bot traps first: they always get a fake success and nothing is stored.
  const honeypot = text(field('website'), 500);
  const startedAt = Number(text(field('started_at'), 20));
  // Only a small, non-negative delta is "too fast": a missing value (no JS) or a client clock that is
  // ahead of the server never blocks a real person.
  const elapsed = Number.isFinite(startedAt) && startedAt > 0 ? now - startedAt : Infinity;
  const area = text(field('area'), 16);
  if (honeypot || (elapsed >= 0 && elapsed < MIN_FILL_MS)) {
    return { ok: true, bot: true, lead: { area: LEAD_AREAS.includes(area) ? area : 'legal', locale, page } };
  }

  if (!LEAD_LOCALES.includes(localeRaw) || !LEAD_AREAS.includes(area)) return fail('invalid');
  const name = singleLine(field('name'), 200);
  if (name.length < 2 || name.length > 120) return fail('invalid');
  const message = text(field('message'), 3000).replace(/\r\n?/g, '\n');
  if (message.length < 10 || message.length > 1500) return fail('invalid');

  const emailRaw = text(field('contact_email'), 300);
  const phoneRaw = text(field('contact_whatsapp'), 60).replace(/[\s().-]/g, '');
  if (emailRaw && (emailRaw.length > 254 || !EMAIL.test(emailRaw))) return fail('invalid');
  if (phoneRaw && !PHONE.test(phoneRaw)) return fail('invalid');
  if (!emailRaw && !phoneRaw) return fail('contact');

  const consentValue = field('consent');
  const consent = consentValue === true || TRUE_VALUES.has(text(consentValue, 8).toLowerCase());
  if (!consent) return fail('consent');

  const distinct = text(field('posthog_distinct_id'), 200);
  const lead = {
    name, area, message,
    contact_whatsapp: phoneRaw || null,
    contact_email: emailRaw ? emailRaw.toLowerCase() : null,
    locale, consent: true,
    consent_text: String(consentText(locale) ?? '').slice(0, 2000),
    page: page || null,
    utm_source: singleLine(field('utm_source'), 255) || null,
    utm_medium: singleLine(field('utm_medium'), 255) || null,
    utm_campaign: singleLine(field('utm_campaign'), 255) || null,
    posthog_distinct_id: DISTINCT_ID.test(distinct) ? distinct : null,
  };
  return { ok: true, bot: false, lead };
}

// ------------------------------------------------------------------------------------------------
// HTTP helpers
// ------------------------------------------------------------------------------------------------
/** Reads at most `limit` bytes; returns null when the body is larger. */
export async function readLimitedBody(request, limit = MAX_BODY_BYTES) {
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > limit) return null;
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
}

export function parsePayload(raw, contentType) {
  const type = String(contentType ?? '').split(';')[0].trim().toLowerCase();
  if (type === 'application/json') {
    try {
      const data = JSON.parse(raw);
      return data && typeof data === 'object' && !Array.isArray(data) ? data : null;
    } catch {
      return null;
    }
  }
  if (type === 'application/x-www-form-urlencoded') {
    const data = Object.create(null);
    const params = new URLSearchParams(raw);
    for (const [key, value] of params) if (!(key in data)) data[key] = value;
    // Duplicated honeypot fields must not hide a filled one behind an empty first value.
    if (params.has('website')) data.website = params.getAll('website').join('');
    return data;
  }
  return undefined; // unsupported media type
}

/** Origin (or Referer) must be the site itself: basic CSRF protection on top of Astro's checkOrigin. */
export function isAllowedOrigin(request, allowedOrigins) {
  const source = request.headers.get('origin') || request.headers.get('referer');
  if (!source || source === 'null') return false;
  try {
    const origin = new URL(source).origin;
    return allowedOrigins.some(allowed => allowed === origin);
  } catch {
    return false;
  }
}

const wantsJson = request => /\bapplication\/json\b/i.test(request.headers.get('accept') ?? '');
export const thanksPath = (locale, area) => `/${locale}/gracias/?area=${encodeURIComponent(area)}`;
export function formErrorPath(locale, page, error) {
  const path = page && (page === `/${locale}` || page.startsWith(`/${locale}/`)) ? page : `/${locale}/`;
  return `${path}?error=${encodeURIComponent(error)}#contacto`;
}

const noStore = { 'Cache-Control': 'no-store' };
function respond(request, { ok, error, locale = 'es', page = '', area = 'legal' }) {
  const redirect = ok ? thanksPath(locale, area) : formErrorPath(locale, page, error);
  if (wantsJson(request)) {
    const body = ok ? { ok: true, redirect } : { ok: false, error };
    return new Response(JSON.stringify(body), {
      status: ok ? 200 : STATUS[error] ?? 400,
      headers: { 'Content-Type': 'application/json; charset=utf-8', ...noStore, ...(error === 'rate_limited' ? { 'Retry-After': '600' } : {}) },
    });
  }
  return new Response(null, { status: 303, headers: { Location: redirect, ...noStore } });
}

// ------------------------------------------------------------------------------------------------
// Directus
// ------------------------------------------------------------------------------------------------
export async function saveLead(lead, { directusUrl, token, fetcher, timeoutMs = DIRECTUS_TIMEOUT_MS }) {
  const response = await fetcher(new URL('/items/leads', directusUrl).href, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(lead),
    redirect: 'error',
    signal: AbortSignal.timeout(timeoutMs),
  });
  // Without read permission Directus answers 204 to a successful create: same as 200.
  if (response.status === 200 || response.status === 204) {
    await response.body?.cancel().catch(() => {});
    return;
  }
  let code = '';
  try { code = String((await response.json())?.errors?.[0]?.extensions?.code ?? '').slice(0, 60); } catch { /* opaque */ }
  throw Object.assign(new Error(`Directus HTTP ${response.status}${code ? ` ${code}` : ''}`), { status: response.status });
}

// ------------------------------------------------------------------------------------------------
// Handler
// ------------------------------------------------------------------------------------------------
/**
 * @param {object} deps
 * @param {Record<string,string|undefined>} [deps.env] DIRECTUS_URL, DIRECTUS_LEADS_TOKEN, LEAD_ALLOWED_ORIGINS, LEAD_TRUSTED_PROXY_HOPS
 * @param {typeof fetch} [deps.fetcher]
 * @param {(locale: 'es'|'en') => string | Promise<string>} [deps.consentText]
 * @param {(event: {distinctId?: string, area: string, locale: string, utm_source: string|null, utm_medium: string|null, utm_campaign: string|null}) => Promise<void>} [deps.track]
 * @param {ReturnType<typeof createRateLimiter>} [deps.rateLimiter]
 * @param {() => number} [deps.now]
 * @param {{ error: (...args: unknown[]) => void }} [deps.logger]
 * @param {string} [deps.siteOrigin]
 */
export function createLeadHandler({
  env = {}, fetcher = globalThis.fetch, consentText = () => '', track = async () => {},
  rateLimiter = createRateLimiter(), now = Date.now, logger = console, siteOrigin = DEFAULT_SITE_ORIGIN,
} = {}) {
  const extraOrigins = String(env.LEAD_ALLOWED_ORIGINS ?? '').split(',').map(value => value.trim()).filter(Boolean);
  const hops = env.LEAD_TRUSTED_PROXY_HOPS === undefined || env.LEAD_TRUSTED_PROXY_HOPS === '' ? 1 : Number(env.LEAD_TRUSTED_PROXY_HOPS);

  /** @param {Request} request @param {{ clientAddress?: string }} [context] */
  return async function handleLead(request, { clientAddress = '' } = {}) {
    if (request.method !== 'POST') return new Response(null, { status: 405, headers: { Allow: 'POST' } });

    const requestOrigin = new URL(request.url).origin;
    if (!isAllowedOrigin(request, [siteOrigin, requestOrigin, ...extraOrigins])) return respond(request, { ok: false, error: 'forbidden' });

    if (!rateLimiter.hit(clientIp(request.headers, clientAddress, hops))) return respond(request, { ok: false, error: 'rate_limited' });

    const raw = await readLimitedBody(request, MAX_BODY_BYTES);
    if (raw === null) return respond(request, { ok: false, error: 'too_large' });
    const payload = parsePayload(raw, request.headers.get('content-type'));
    if (payload === undefined) return respond(request, { ok: false, error: 'unsupported' });
    if (payload === null) return respond(request, { ok: false, error: 'invalid' });

    let text = '';
    try {
      const localeHint = LEAD_LOCALES.includes(payload.locale) ? payload.locale : 'es';
      text = String(await consentText(localeHint) ?? '');
    } catch {
      text = '';
    }
    const result = validateLead(payload, { now: now(), consentText: () => text });
    if (!result.ok) return respond(request, result);
    const { lead } = result;
    if (result.bot) return respond(request, { ok: true, locale: lead.locale, area: lead.area });

    const token = env.DIRECTUS_LEADS_TOKEN;
    if (!token) {
      logger.error('[lead] DIRECTUS_LEADS_TOKEN no configurado: lead no guardado');
      return respond(request, { ok: false, error: 'unavailable', locale: lead.locale, page: lead.page ?? '' });
    }
    try {
      await saveLead(lead, { directusUrl: env.DIRECTUS_URL || DEFAULT_DIRECTUS_URL, token, fetcher });
    } catch (error) {
      // Status/code only: never the payload, which contains personal data.
      logger.error(`[lead] Directus rechazó o no respondió: ${error?.status ? error.message : error?.name ?? 'Error'}`);
      return respond(request, { ok: false, error: 'server', locale: lead.locale, page: lead.page ?? '' });
    }

    try {
      await track({
        distinctId: lead.posthog_distinct_id ?? undefined, area: lead.area, locale: lead.locale,
        utm_source: lead.utm_source, utm_medium: lead.utm_medium, utm_campaign: lead.utm_campaign,
      });
    } catch (error) {
      logger.error(`[lead] PostHog lead_created falló: ${error?.name ?? 'Error'}`);
    }
    return respond(request, { ok: true, locale: lead.locale, area: lead.area });
  };
}
