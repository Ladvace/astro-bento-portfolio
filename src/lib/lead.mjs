/**
 * Lead capture: pure request handling for POST /api/lead (no Astro, no globals).
 *
 * Everything with side effects (Directus fetch, clock, logger, consent text) is injected,
 * so the whole flow is testable with web-standard Request/Response objects.
 *
 * Client IP (rate limit): Astro's `clientAddress` is the FIRST X-Forwarded-For value, which any client
 * can forge. Behind Coolify's Traefik the reliable value is the one appended by our own proxy, i.e.
 * the value `trustedProxyHops` positions from the RIGHT (default 1 = last value, set by Traefik from
 * the TCP peer). If the request carries no X-Forwarded-For (direct connection, local run) the
 * socket address supplied by the adapter is used. Set LEAD_TRUSTED_PROXY_HOPS=2 if a CDN
 * (e.g. Cloudflare) is ever placed in front of Traefik, or 0 to ignore the header entirely.
 *
 * Anti-spam without losing real leads:
 * - Honeypot `hp_field` (neutral name so password managers/autofill leave it alone; autocomplete=off,
 *   tabindex=-1, aria-hidden, positioned off-screen). `website` is still honoured for cached pages.
 * - `elapsed_ms`: fill duration measured in the browser with performance.now() (relative, so a wrong
 *   client clock is irrelevant). Silent fake success ONLY when present and < MIN_FILL_MS. Requests from
 *   the page script (Accept: application/json) must send it; without it (no JS) the lead is accepted
 *   under a stricter per-IP quota (NO_JS_IP_LIMIT).
 * - Quotas: validation errors (4xx) never consume quota; bot traps and valid attempts do. IPv6 keys are
 *   grouped by /64. A full limiter evicts its oldest windows (never rejects new IPs). A global cap of
 *   GLOBAL_LIMIT stored leads per window answers 429 `busy` (the form then suggests WhatsApp).
 */

export const LEAD_AREAS = Object.freeze(['legal', 'data']);
export const LEAD_LOCALES = Object.freeze(['es', 'en']);
export const LEAD_ERROR_CODES = Object.freeze([
  'invalid', 'consent', 'contact', 'forbidden', 'too_large', 'unsupported', 'rate_limited', 'busy', 'unavailable', 'server',
]);
/** Fields a validation error can point at (`field` in the JSON error / `&field=` in the redirect). */
export const LEAD_ERROR_FIELDS = Object.freeze(['name', 'area', 'message', 'contact_whatsapp', 'contact_email', 'elapsed_ms']);
export const MAX_BODY_BYTES = 10 * 1024;
/** Below this many ms between page load and submit (measured in the browser with performance.now()) it is a bot. */
export const MIN_FILL_MS = 2500;
export const RATE_WINDOW_MS = 10 * 60 * 1000;
export const IP_LIMIT = 5; // per IP (IPv6: per /64) and window, submissions that carry elapsed_ms (JS)
export const NO_JS_IP_LIMIT = 2; // per IP and window, submissions without elapsed_ms (no JS, or a script)
export const GLOBAL_LIMIT = 30; // stored leads per window for the whole process
export const DIRECTUS_TIMEOUT_MS = 8000;
export const DEFAULT_DIRECTUS_URL = 'https://cms.romahomestore.com';
export const DEFAULT_SITE_ORIGIN = 'https://portfolio.romahomestore.com';
/** Prefix stored in consent_text when the submitted consent_version is not in the build map. */
export const UNKNOWN_CONSENT_PREFIX = '[version desconocida] ';
/** Honeypot field names: `hp_field` (current form) and `website` (pages cached before the rename). */
export const HONEYPOT_FIELDS = Object.freeze(['hp_field', 'website']);

const STATUS = { invalid: 400, consent: 400, contact: 400, forbidden: 403, too_large: 413, unsupported: 415, rate_limited: 429, busy: 429, unavailable: 503, server: 502 };

// ------------------------------------------------------------------------------------------------
// Rate limiting (fixed window per key, in memory: per process, resets on deploy/restart)
// ------------------------------------------------------------------------------------------------
/**
 * Bounded map of fixed windows. When `maxKeys` is reached the OLDEST windows are evicted (Map keeps
 * insertion order and a renewed window is re-inserted at the end), so a flood of distinct IPs can at
 * worst free old counters: it never blocks a new, legitimate IP.
 */
export function createRateLimiter({ limit = IP_LIMIT, windowMs = RATE_WINDOW_MS, maxKeys = 10000, now = Date.now } = {}) {
  const hits = new Map();
  return {
    /** Counts one attempt; returns false when the key is over the limit. */
    hit(key) {
      const t = now();
      let entry = hits.get(key);
      if (!entry || entry.reset <= t) {
        if (entry) hits.delete(key);
        while (hits.size >= maxKeys) hits.delete(hits.keys().next().value);
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

/**
 * Rate-limit key for an IP: IPv4 as is (also when IPv4-mapped), IPv6 grouped by its /64 prefix
 * (one subscriber usually owns a whole /64, so per-address keys would be trivial to rotate).
 */
export function rateLimitKey(ip) {
  let value = String(ip ?? '').trim().toLowerCase();
  if (value.startsWith('[')) value = value.slice(1, value.indexOf(']') > 0 ? value.indexOf(']') : undefined);
  value = value.replace(/%.*$/, '');
  const mapped = value.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mapped) return mapped[1];
  if (!value.includes(':')) return value || 'unknown';
  const split = part => (part ? part.split(':') : []);
  const expandV4 = groups => (groups.length && groups.at(-1).includes('.') ? [...groups.slice(0, -1), '0', '0'] : groups);
  let groups;
  if (value.includes('::')) {
    const [head, tail, extra] = value.split('::');
    if (extra !== undefined) return value;
    const left = split(head);
    const right = expandV4(split(tail));
    const missing = 8 - left.length - right.length;
    if (missing < 1) return value;
    groups = [...left, ...Array(missing).fill('0'), ...right];
  } else {
    groups = expandV4(value.split(':'));
  }
  if (groups.length !== 8 || !groups.every(group => /^[0-9a-f]{1,4}$/.test(group))) return value;
  return `${groups.slice(0, 4).map(group => Number.parseInt(group, 16).toString(16)).join(':')}::/64`;
}

// ------------------------------------------------------------------------------------------------
// Consent text (build-time map, see src/lib/consent-texts.mjs)
// ------------------------------------------------------------------------------------------------
const CONSENT_VERSION = /^[A-Za-z0-9._-]{1,40}$/;

/**
 * Text the person saw for `version`; unknown/missing version -> the current text of that locale (or
 * `fallbackText`) prefixed with UNKNOWN_CONSENT_PREFIX, so the record never pretends to be exact.
 */
export function resolveConsentText(texts, version, locale, fallbackText = '') {
  const versions = texts && typeof texts.versions === 'object' && texts.versions ? texts.versions : {};
  const known = CONSENT_VERSION.test(String(version ?? '')) && Object.hasOwn(versions, version) ? versions[version] : null;
  if (known && typeof known.text === 'string' && known.text) return known.text;
  const currentVersion = texts?.current && Object.hasOwn(texts.current, locale) ? texts.current[locale] : '';
  const current = Object.hasOwn(versions, currentVersion) && typeof versions[currentVersion]?.text === 'string' ? versions[currentVersion].text : '';
  return `${UNKNOWN_CONSENT_PREFIX}${current || String(fallbackText ?? '')}`;
}

// ------------------------------------------------------------------------------------------------
// Validation (pure)
// ------------------------------------------------------------------------------------------------
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const EMAIL = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}@(?=.{1,253}$)[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;
/** E.164 (+ and 7-15 digits, no leading 0) or a local number of 7-15 digits. No extensions. */
const PHONE = /^(?:\+[1-9]\d{6,14}|\d{7,15})$/;
const GA_CLIENT_ID = /^[A-Za-z0-9.]{1,64}$/;
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

/** Fill duration reported by the browser (ms, integer) or null when absent/malformed. */
export function parseElapsed(value) {
  const raw = text(value, 16);
  return /^\d{1,12}$/.test(raw) ? Number(raw) : null;
}

/**
 * Normalizes and validates a submitted payload.
 * @param {object} input
 * @param {{ consentText?: (locale: string, version: string) => string, requireElapsed?: boolean }} [options]
 *   requireElapsed: the request came from the page's script (Accept: application/json), which always sends elapsed_ms.
 * @returns {{ ok: true, bot: false, js: boolean, lead: object }
 *   | { ok: true, bot: true, reason: 'honeypot'|'fast', lead: object }
 *   | { ok: false, error: string, field?: string, locale: string, page: string }}
 */
export function validateLead(input, { consentText = () => '', requireElapsed = false } = {}) {
  const field = key => (input && Object.hasOwn(input, key) ? input[key] : undefined);
  const localeRaw = text(field('locale'), 8);
  const locale = LEAD_LOCALES.includes(localeRaw) ? localeRaw : 'es';
  const page = safePagePath(field('page'));
  const fail = (error, name) => ({ ok: false, error, ...(name ? { field: name } : {}), locale, page });

  // Bot traps first: they always get a fake success and nothing is stored. Only an elapsed_ms that
  // is PRESENT and short is "too fast": a missing value (no JS) goes to the stricter no-JS limit.
  const honeypot = HONEYPOT_FIELDS.some(name => text(field(name), 500));
  const elapsed = parseElapsed(field('elapsed_ms'));
  const area = text(field('area'), 16);
  if (honeypot || (elapsed !== null && elapsed < MIN_FILL_MS)) {
    return { ok: true, bot: true, reason: honeypot ? 'honeypot' : 'fast', lead: { area: LEAD_AREAS.includes(area) ? area : 'legal', locale, page } };
  }
  if (requireElapsed && elapsed === null) return fail('invalid', 'elapsed_ms');

  if (!LEAD_LOCALES.includes(localeRaw)) return fail('invalid');
  if (!LEAD_AREAS.includes(area)) return fail('invalid', 'area');
  const name = singleLine(field('name'), 200);
  if (name.length < 2 || name.length > 120) return fail('invalid', 'name');
  const message = text(field('message'), 3000).replace(/\r\n?/g, '\n');
  if (message.length < 10 || message.length > 1500) return fail('invalid', 'message');

  const emailRaw = text(field('contact_email'), 300);
  const phoneRaw = text(field('contact_whatsapp'), 60).replace(/[\s().-]/g, '');
  if (emailRaw && (emailRaw.length > 254 || !EMAIL.test(emailRaw))) return fail('invalid', 'contact_email');
  if (phoneRaw && !PHONE.test(phoneRaw)) return fail('invalid', 'contact_whatsapp');
  if (!emailRaw && !phoneRaw) return fail('contact');

  const consentValue = field('consent');
  const consent = consentValue === true || TRUE_VALUES.has(text(consentValue, 8).toLowerCase());
  if (!consent) return fail('consent');

  const gaClientId = text(field('ga_client_id'), 65);
  const lead = {
    name, area, message,
    contact_whatsapp: phoneRaw || null,
    contact_email: emailRaw ? emailRaw.toLowerCase() : null,
    locale, consent: true,
    consent_text: String(consentText(locale, text(field('consent_version'), 40)) ?? '').slice(0, 2000),
    page: page || null,
    utm_source: singleLine(field('utm_source'), 255) || null,
    utm_medium: singleLine(field('utm_medium'), 255) || null,
    utm_campaign: singleLine(field('utm_campaign'), 255) || null,
    ga_client_id: GA_CLIENT_ID.test(gaClientId) ? gaClientId : null,
  };
  return { ok: true, bot: false, js: elapsed !== null, lead };
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
    for (const name of HONEYPOT_FIELDS) if (params.has(name)) data[name] = params.getAll(name).join('');
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

/**
 * Fragment for the no-JS redirect. The form renders hidden blocks with these ids that CSS reveals
 * with :target, so the error is visible even without JavaScript (see ContactForm.astro).
 */
export function errorAnchor(error, field) {
  if (field && LEAD_ERROR_FIELDS.includes(field) && field !== 'elapsed_ms') return `lead-error-${field}`;
  if (['contact', 'consent', 'rate_limited', 'busy'].includes(error)) return `lead-error-${error}`;
  return 'lead-error';
}

export function formErrorPath(locale, page, error, field) {
  const path = page && (page === `/${locale}` || page.startsWith(`/${locale}/`)) ? page : `/${locale}/`;
  const fieldPart = field && LEAD_ERROR_FIELDS.includes(field) ? `&field=${encodeURIComponent(field)}` : '';
  return `${path}?error=${encodeURIComponent(error)}${fieldPart}#${errorAnchor(error, field)}`;
}

const noStore = { 'Cache-Control': 'no-store' };
function respond(request, { ok, error, field, locale = 'es', page = '', area = 'legal' }) {
  const redirect = ok ? thanksPath(locale, area) : formErrorPath(locale, page, error, field);
  if (wantsJson(request)) {
    const body = ok ? { ok: true, redirect } : { ok: false, error, ...(field ? { field } : {}) };
    return new Response(JSON.stringify(body), {
      status: ok ? 200 : STATUS[error] ?? 400,
      headers: { 'Content-Type': 'application/json; charset=utf-8', ...noStore, ...(STATUS[error] === 429 ? { 'Retry-After': '600' } : {}) },
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
 * Order matters for "no legitimate lead is lost":
 *   origin -> body/parse -> validation (4xx here never consume quota) -> bot traps (count per IP,
 *   fake success) -> per-IP quota (5 with JS, 2 without) -> global quota (30 stored leads) -> Directus.
 *
 * @param {object} deps
 * @param {Record<string,string|undefined>} [deps.env] DIRECTUS_URL, DIRECTUS_LEADS_TOKEN, LEAD_ALLOWED_ORIGINS, LEAD_TRUSTED_PROXY_HOPS
 * @param {typeof fetch} [deps.fetcher]
 * @param {{ versions: Record<string,{locale:string,text:string}>, current: Record<string,string> } | null} [deps.consentTexts] build map
 * @param {(locale: 'es'|'en') => string} [deps.consentFallback] text used when the map has nothing for the locale
 * @param {ReturnType<typeof createRateLimiter>} [deps.rateLimiter] per IP, submissions with elapsed_ms
 * @param {ReturnType<typeof createRateLimiter>} [deps.noJsRateLimiter] per IP, submissions without elapsed_ms
 * @param {ReturnType<typeof createRateLimiter>} [deps.globalRateLimiter] whole process
 * @param {() => number} [deps.now]
 * @param {{ error: (...args: unknown[]) => void, info?: (...args: unknown[]) => void }} [deps.logger]
 * @param {string} [deps.siteOrigin]
 */
export function createLeadHandler({
  env = {}, fetcher = globalThis.fetch, consentTexts = null, consentFallback = () => '',
  rateLimiter, noJsRateLimiter, globalRateLimiter,
  now = Date.now, logger = console, siteOrigin = DEFAULT_SITE_ORIGIN,
} = {}) {
  const perIp = rateLimiter ?? createRateLimiter({ limit: IP_LIMIT, now });
  const perIpNoJs = noJsRateLimiter ?? createRateLimiter({ limit: NO_JS_IP_LIMIT, now });
  const global = globalRateLimiter ?? createRateLimiter({ limit: GLOBAL_LIMIT, maxKeys: 1, now });
  const extraOrigins = String(env.LEAD_ALLOWED_ORIGINS ?? '').split(',').map(value => value.trim()).filter(Boolean);
  const hops = env.LEAD_TRUSTED_PROXY_HOPS === undefined || env.LEAD_TRUSTED_PROXY_HOPS === '' ? 1 : Number(env.LEAD_TRUSTED_PROXY_HOPS);
  const consentText = (locale, version) => resolveConsentText(consentTexts, version, locale, consentFallback(locale));

  // Bot discards: counters only (no IP, no payload), logged at most once a minute.
  const discards = { honeypot: 0, fast: 0 };
  let lastDiscardLog = -Infinity;
  function countDiscard(reason) {
    discards[reason] += 1;
    const t = now();
    if (t - lastDiscardLog < 60_000) return;
    lastDiscardLog = t;
    (logger.info ?? logger.log ?? (() => {})).call(logger, `[lead] descartes por bot (acumulado desde arranque): honeypot=${discards.honeypot} rapido=${discards.fast}`);
  }

  /** @param {Request} request @param {{ clientAddress?: string }} [context] */
  return async function handleLead(request, { clientAddress = '' } = {}) {
    if (request.method !== 'POST') return new Response(null, { status: 405, headers: { Allow: 'POST' } });

    const requestOrigin = new URL(request.url).origin;
    if (!isAllowedOrigin(request, [siteOrigin, requestOrigin, ...extraOrigins])) return respond(request, { ok: false, error: 'forbidden' });

    const raw = await readLimitedBody(request, MAX_BODY_BYTES);
    if (raw === null) return respond(request, { ok: false, error: 'too_large' });
    const payload = parsePayload(raw, request.headers.get('content-type'));
    if (payload === undefined) return respond(request, { ok: false, error: 'unsupported' });
    if (payload === null) return respond(request, { ok: false, error: 'invalid' });

    const result = validateLead(payload, { consentText, requireElapsed: wantsJson(request) });
    if (!result.ok) return respond(request, result);
    const { lead } = result;
    const key = rateLimitKey(clientIp(request.headers, clientAddress, hops));
    if (result.bot) {
      perIp.hit(key);
      countDiscard(result.reason);
      return respond(request, { ok: true, locale: lead.locale, area: lead.area });
    }

    const fail = error => respond(request, { ok: false, error, locale: lead.locale, page: lead.page ?? '' });
    const ipOk = perIp.hit(key);
    if (!ipOk || (!result.js && !perIpNoJs.hit(key))) return fail('rate_limited');
    if (!global.hit('all')) {
      logger.error(`[lead] tope global alcanzado (${GLOBAL_LIMIT} leads/10 min): respondiendo 429 busy`);
      return fail('busy');
    }

    const token = env.DIRECTUS_LEADS_TOKEN;
    if (!token) {
      logger.error('[lead] DIRECTUS_LEADS_TOKEN no configurado: lead no guardado');
      return fail('unavailable');
    }
    try {
      await saveLead(lead, { directusUrl: env.DIRECTUS_URL || DEFAULT_DIRECTUS_URL, token, fetcher });
    } catch (error) {
      // Status/code only: never the payload, which contains personal data.
      logger.error(`[lead] Directus rechazó o no respondió: ${error?.status ? error.message : error?.name ?? 'Error'}`);
      return fail('server');
    }

    return respond(request, { ok: true, locale: lead.locale, area: lead.area });
  };
}
