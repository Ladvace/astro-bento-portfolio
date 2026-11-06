import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createLeadHandler, createRateLimiter, validateLead, clientIp, safePagePath, formErrorPath, rateLimitKey, resolveConsentText,
  MAX_BODY_BYTES, UNKNOWN_CONSENT_PREFIX,
} from '../src/lib/lead.mjs';
import { consentVersion, readConsentTexts } from '../src/lib/consent-texts.mjs';

const SITE = 'https://portfolio.romahomestore.com';
const NOW = 1_800_000_000_000;
const CONSENT_ES = 'Autorizo el tratamiento (es)';
const CONSENT_EN = 'I authorize processing (en)';
const V_ES = consentVersion(CONSENT_ES);
const V_EN = consentVersion(CONSENT_EN);
const CONSENT_TEXTS = { versions: { [V_ES]: { locale: 'es', text: CONSENT_ES }, [V_EN]: { locale: 'en', text: CONSENT_EN } }, current: { es: V_ES, en: V_EN } };
const valid = () => ({
  name: 'Ana Pérez', area: 'legal', message: 'Necesito asesoría sobre un contrato laboral.',
  contact_whatsapp: '+57 300 123 4567', contact_email: '', consent: 'on', hp_field: '',
  locale: 'es', page: '/es/servicios/legal/?utm_source=x', elapsed_ms: '60000', consent_version: V_ES,
  utm_source: 'google', utm_medium: 'cpc', utm_campaign: 'otono', ga_client_id: '1234567890.1700000000',
});

function setup({ env = { DIRECTUS_LEADS_TOKEN: 'tok', DIRECTUS_URL: 'https://cms.test' }, directus = () => new Response(null, { status: 204 }), now = () => NOW, consentTexts = CONSENT_TEXTS, ...limiters } = {}) {
  const calls = [];
  const errors = [];
  const infos = [];
  const fetcher = async (url, init) => { calls.push({ url, init }); return directus(url, init); };
  const handler = createLeadHandler({
    env, fetcher, now, siteOrigin: SITE,
    consentTexts, consentFallback: locale => `fallback-${locale}`,
    ...limiters,
    logger: { error: (...args) => errors.push(args.join(' ')), info: (...args) => infos.push(args.join(' ')) },
  });
  return { handler, calls, errors, infos };
}

function post(body, { json = false, accept = json ? 'application/json' : 'text/html', origin = SITE, headers = {} } = {}) {
  const data = json ? JSON.stringify(body) : new URLSearchParams(body).toString();
  return new Request(`${SITE}/api/lead`, {
    method: 'POST', body: data,
    headers: { 'content-type': json ? 'application/json' : 'application/x-www-form-urlencoded', accept, ...(origin ? { origin } : {}), ...headers },
  });
}

test('valid form lead is stored in Directus and redirects 303 to the thank-you page', async () => {
  const { handler, calls } = setup();
  const response = await handler(post(valid()), { clientAddress: '1.1.1.1' });
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('location'), '/es/gracias/?area=legal');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://cms.test/items/leads');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer tok');
  const lead = JSON.parse(calls[0].init.body);
  assert.deepEqual(Object.keys(lead).sort(), ['area', 'consent', 'consent_text', 'contact_email', 'contact_whatsapp', 'locale', 'message', 'name', 'page', 'ga_client_id', 'utm_campaign', 'utm_medium', 'utm_source'].sort());
  assert.equal(lead.contact_whatsapp, '+573001234567');
  assert.equal(lead.page, '/es/servicios/legal/');
  assert.equal(lead.consent, true);
  assert.equal(lead.consent_text, CONSENT_ES);
  assert.equal(lead.ga_client_id, '1234567890.1700000000');
});

test('JSON request gets JSON response; Directus 200 is also success', async () => {
  const { handler } = setup({ directus: () => Response.json({ data: { id: 1 } }) });
  const response = await handler(post({ ...valid(), consent: true, area: 'data', locale: 'en', contact_email: 'A@Example.com', contact_whatsapp: '' }, { json: true }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, redirect: '/en/gracias/?area=data' });
});

test('honeypot and too-fast submissions get a fake success, are not stored and are counted without PII', async () => {
  for (const payload of [{ ...valid(), hp_field: 'x' }, { ...valid(), website: 'http://spam' }, { ...valid(), elapsed_ms: '2499' }, { ...valid(), elapsed_ms: '0' }]) {
    const { handler, calls, infos } = setup();
    const response = await handler(post(payload, { json: true }));
    assert.deepEqual(await response.json(), { ok: true, redirect: '/es/gracias/?area=legal' });
    assert.equal(calls.length, 0);
    assert.equal(infos.length, 1);
    assert.match(infos[0], /descartes por bot .*honeypot=\d+ rapido=\d+/);
    assert.doesNotMatch(infos[0], /Ana|300|\d+\.\d+\.\d+\.\d+/);
  }
  for (const name of ['hp_field', 'website']) {
    const { handler, calls } = setup();
    const body = `${new URLSearchParams(valid())}&${name}=spam`;
    await handler(new Request(`${SITE}/api/lead`, { method: 'POST', body, headers: { 'content-type': 'application/x-www-form-urlencoded', origin: SITE } }));
    assert.equal(calls.length, 0, `duplicated honeypot field ${name}`);
  }
  // Exactly at the threshold is human.
  const { handler, calls } = setup();
  assert.equal((await handler(post({ ...valid(), elapsed_ms: '2500' }, { json: true }))).status, 200);
  assert.equal(calls.length, 1);
});

test('elapsed_ms: required from the page script (JSON), optional without JS but with a 2/10 min quota', async () => {
  {
    const { handler, calls } = setup();
    const response = await handler(post({ ...valid(), elapsed_ms: '' }, { json: true }));
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { ok: false, error: 'invalid', field: 'elapsed_ms' });
    assert.equal(calls.length, 0);
  }
  {
    // No JS: the form posts urlencoded without elapsed_ms (or with the legacy started_at only).
    const { handler, calls } = setup();
    const noJs = (patch = {}) => { const body = { ...valid(), ...patch }; delete body.elapsed_ms; return post(body, { headers: { 'x-forwarded-for': '5.5.5.5' } }); };
    assert.equal((await handler(noJs())).headers.get('location'), '/es/gracias/?area=legal');
    assert.equal((await handler(noJs({ started_at: String(NOW) }))).headers.get('location'), '/es/gracias/?area=legal');
    assert.equal((await handler(noJs())).headers.get('location'), '/es/servicios/legal/?error=rate_limited#lead-error-rate_limited');
    assert.equal(calls.length, 2);
    // The same IP with JS still has its normal quota left (5 total per IP).
    assert.equal((await handler(post(valid(), { json: true, headers: { 'x-forwarded-for': '5.5.5.5' } }))).status, 200);
  }
});

test('validation errors return the offending field (JSON and no-JS redirect)', async () => {
  const cases = [
    [{ consent: '' }, 'consent'],
    [{ contact_whatsapp: '', contact_email: '' }, 'contact'],
    [{ area: 'tax' }, 'invalid', 'area'],
    [{ locale: 'fr' }, 'invalid'],
    [{ name: 'A' }, 'invalid', 'name'],
    [{ name: 'x'.repeat(121) }, 'invalid', 'name'],
    [{ message: 'corto' }, 'invalid', 'message'],
    [{ message: '         x          ' }, 'invalid', 'message'],
    [{ message: 'x'.repeat(1501) }, 'invalid', 'message'],
    [{ contact_email: 'no-arroba' }, 'invalid', 'contact_email'],
    [{ contact_whatsapp: '12ab34567' }, 'invalid', 'contact_whatsapp'],
    [{ contact_whatsapp: '123' }, 'invalid', 'contact_whatsapp'],
    [{ contact_whatsapp: '+57 300 123 4567 ext 12' }, 'invalid', 'contact_whatsapp'],
    [{ contact_whatsapp: '+1234567890123456' }, 'invalid', 'contact_whatsapp'], // 16 digits > E.164
    [{ contact_whatsapp: '1234567890123456' }, 'invalid', 'contact_whatsapp'],
    [{ contact_whatsapp: '+0573001234567' }, 'invalid', 'contact_whatsapp'],
  ];
  for (const [patch, error, field] of cases) {
    const { handler, calls } = setup();
    const response = await handler(post({ ...valid(), ...patch }, { json: true }));
    assert.equal(response.status, 400, JSON.stringify(patch));
    assert.deepEqual(await response.json(), field ? { ok: false, error, field } : { ok: false, error }, JSON.stringify(patch));
    assert.equal(calls.length, 0);
  }
  for (const phone of ['+123456789012345', '3001234567', '(300) 123-4567']) {
    const { handler, calls } = setup();
    assert.equal((await handler(post({ ...valid(), contact_whatsapp: phone }, { json: true }))).status, 200, phone);
    assert.equal(JSON.parse(calls[0].init.body).contact_whatsapp.replace('+', '').length <= 15, true);
  }
  const { handler } = setup();
  const consent = await handler(post({ ...valid(), consent: '' }));
  assert.equal(consent.status, 303);
  assert.equal(consent.headers.get('location'), '/es/servicios/legal/?error=consent#lead-error-consent');
  const message = await handler(post({ ...valid(), message: 'corto' }));
  assert.equal(message.headers.get('location'), '/es/servicios/legal/?error=invalid&field=message#lead-error-message');
});

test('validation errors (4xx) do not consume the rate-limit quota', async () => {
  const { handler, calls } = setup();
  const from = body => post(body, { json: true, headers: { 'x-forwarded-for': '7.7.7.7' } });
  for (let i = 0; i < 20; i += 1) assert.equal((await handler(from({ ...valid(), message: 'corto' }))).status, 400);
  for (let i = 0; i < 5; i += 1) assert.equal((await handler(from(valid()))).status, 200, `valid #${i + 1}`);
  assert.equal((await handler(from(valid()))).status, 429);
  assert.equal(calls.length, 5);
});

test('payload larger than 10 KB is rejected with too_large', async () => {
  const { handler, calls } = setup();
  const response = await handler(post({ ...valid(), message: 'x'.repeat(MAX_BODY_BYTES) }, { json: true }));
  assert.equal(response.status, 413);
  assert.deepEqual(await response.json(), { ok: false, error: 'too_large' });
  assert.equal(calls.length, 0);
});

test('unsupported content type and malformed JSON', async () => {
  const { handler } = setup();
  const text = new Request(`${SITE}/api/lead`, { method: 'POST', body: 'x', headers: { 'content-type': 'text/plain', origin: SITE, accept: 'application/json' } });
  assert.deepEqual(await (await handler(text)).json(), { ok: false, error: 'unsupported' });
  const bad = new Request(`${SITE}/api/lead`, { method: 'POST', body: '{', headers: { 'content-type': 'application/json', origin: SITE, accept: 'application/json' } });
  assert.deepEqual(await (await handler(bad)).json(), { ok: false, error: 'invalid' });
});

test('Directus 500 or network failure returns generic server error without logging PII', async () => {
  for (const directus of [() => Response.json({ errors: [{ message: 'Ana Pérez', extensions: { code: 'INTERNAL' } }] }, { status: 500 }), () => { throw new TypeError('fetch failed'); }]) {
    const { handler, errors } = setup({ directus });
    const response = await handler(post(valid(), { json: true }));
    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), { ok: false, error: 'server' });
    assert.equal(errors.length, 1);
    assert.doesNotMatch(errors[0], /Ana|300|asesor/);
  }
  const { handler } = setup({ directus: () => new Response('x', { status: 500 }) });
  const response = await handler(post(valid()));
  assert.equal(response.headers.get('location'), '/es/servicios/legal/?error=server#lead-error');
});

test('missing DIRECTUS_LEADS_TOKEN returns unavailable and calls nothing', async () => {
  const { handler, calls } = setup({ env: {} });
  const response = await handler(post(valid(), { json: true }));
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { ok: false, error: 'unavailable' });
  assert.equal(calls.length, 0);
});

test('rate limit: 5 attempts per IP per 10 minutes, keyed on the proxy-appended XFF value', async () => {
  let t = NOW;
  const { handler } = setup({ now: () => t });
  const from = ip => post(valid(), { json: true, headers: { 'x-forwarded-for': `6.6.6.6, ${ip}` } });
  for (let i = 0; i < 5; i += 1) assert.equal((await handler(from('9.9.9.9'))).status, 200);
  const blocked = await handler(from('9.9.9.9'));
  assert.equal(blocked.status, 429);
  assert.deepEqual(await blocked.json(), { ok: false, error: 'rate_limited' });
  // Forging the first XFF value does not reset the counter; another real IP is unaffected.
  assert.equal((await handler(post(valid(), { json: true, headers: { 'x-forwarded-for': '1.2.3.4, 9.9.9.9' } }))).status, 429);
  assert.equal((await handler(from('8.8.8.8'))).status, 200);
  t += 10 * 60 * 1000;
  assert.equal((await handler(from('9.9.9.9'))).status, 200);
});

test('IPv6 clients are limited per /64; IPv4-mapped addresses map to IPv4', async () => {
  assert.equal(rateLimitKey('2001:db8:aa:bb:1:2:3:4'), '2001:db8:aa:bb::/64');
  assert.equal(rateLimitKey('2001:0DB8:00aa:00bb::9'), '2001:db8:aa:bb::/64');
  assert.equal(rateLimitKey('[2001:db8:aa:bb::1]'), '2001:db8:aa:bb::/64');
  assert.equal(rateLimitKey('2001:db8::1'), '2001:db8:0:0::/64');
  assert.equal(rateLimitKey('::ffff:203.0.113.7'), '203.0.113.7');
  assert.equal(rateLimitKey('203.0.113.7'), '203.0.113.7');
  const { handler } = setup();
  const from = ip => post(valid(), { json: true, headers: { 'x-forwarded-for': ip } });
  for (let i = 1; i <= 5; i += 1) assert.equal((await handler(from(`2001:db8:aa:bb::${i.toString(16)}`))).status, 200);
  assert.equal((await handler(from('2001:db8:aa:bb:ffff:1:2:3'))).status, 429, 'same /64, different address');
  assert.equal((await handler(from('2001:db8:aa:bc::1'))).status, 200, 'another /64');
});

test('a full limiter evicts the oldest windows: a flood of 10,001 IPs never blocks a new IP', async () => {
  const limiter = createRateLimiter({ limit: 5, maxKeys: 10_000, now: () => NOW });
  for (let i = 0; i <= 10_000; i += 1) assert.equal(limiter.hit(`ip-${i}`), true);
  assert.equal(limiter.size(), 10_000);
  assert.equal(limiter.hit('new-ip'), true);
  assert.ok(limiter.size() <= 10_000);
  // Through the handler: 10,001 bot-trap submissions from distinct IPs, then a real person.
  const { handler, calls } = setup();
  for (let i = 0; i <= 10_000; i += 1) {
    const ip = `10.${(i >> 16) & 255}.${(i >> 8) & 255}.${i & 255}`;
    await handler(post({ ...valid(), hp_field: 'spam' }, { json: true, headers: { 'x-forwarded-for': ip } }));
  }
  assert.equal(calls.length, 0);
  assert.equal((await handler(post(valid(), { json: true, headers: { 'x-forwarded-for': '198.51.100.1' } }))).status, 200);
  assert.equal(calls.length, 1);
});

test('global cap: 30 stored leads per 10 minutes, then 429 busy for everyone (form suggests WhatsApp)', async () => {
  let t = NOW;
  const { handler, calls, errors } = setup({ now: () => t });
  const from = (i, opts = {}) => post(valid(), { json: true, ...opts, headers: { 'x-forwarded-for': `192.0.2.${i}` } });
  for (let i = 1; i <= 30; i += 1) assert.equal((await handler(from(i))).status, 200, `lead #${i}`);
  const busy = await handler(from(31));
  assert.equal(busy.status, 429);
  assert.equal(busy.headers.get('retry-after'), '600');
  assert.deepEqual(await busy.json(), { ok: false, error: 'busy' });
  assert.equal((await handler(post(valid(), { headers: { 'x-forwarded-for': '192.0.2.32' } }))).headers.get('location'), '/es/servicios/legal/?error=busy#lead-error-busy');
  assert.equal(calls.length, 30);
  assert.match(errors.at(-1), /tope global/);
  // Bot traps and validation errors never eat the global budget.
  t += 10 * 60 * 1000;
  for (let i = 0; i < 50; i += 1) await handler(post({ ...valid(), hp_field: 'x' }, { json: true, headers: { 'x-forwarded-for': `203.0.113.${i}` } }));
  for (let i = 0; i < 50; i += 1) await handler(post({ ...valid(), name: '' }, { json: true, headers: { 'x-forwarded-for': `203.0.113.${i}` } }));
  assert.equal((await handler(from(33))).status, 200);
});

test('consent_version maps to the exact build-time text; unknown version is flagged', async () => {
  {
    const { handler, calls } = setup();
    await handler(post({ ...valid(), locale: 'en', page: '/en/', consent_version: V_EN }, { json: true }));
    assert.equal(JSON.parse(calls[0].init.body).consent_text, CONSENT_EN);
  }
  for (const consent_version of ['', 'deadbeef0000', '__proto__', 'x'.repeat(80)]) {
    const { handler, calls } = setup();
    await handler(post({ ...valid(), consent_version }, { json: true }));
    assert.equal(JSON.parse(calls[0].init.body).consent_text, `${UNKNOWN_CONSENT_PREFIX}${CONSENT_ES}`, consent_version);
  }
  {
    // No build map at all (dev server): default text, still flagged; the CMS is never called.
    const { handler, calls } = setup({ consentTexts: null });
    await handler(post(valid(), { json: true }));
    assert.equal(calls.length, 1);
    assert.equal(JSON.parse(calls[0].init.body).consent_text, `${UNKNOWN_CONSENT_PREFIX}fallback-es`);
  }
  assert.equal(resolveConsentText(CONSENT_TEXTS, V_EN, 'es'), CONSENT_EN, 'the text actually shown wins over the locale');
  assert.match(consentVersion('abc'), /^[0-9a-f]{12}$/);
  assert.match(consentVersion('abc', '2026-11'), /^2026-11-[0-9a-f]{12}$/);
  assert.equal(consentVersion('abc', 'bad version!'), consentVersion('abc'));
  assert.notEqual(consentVersion('abc'), consentVersion('abd'));
});

test('readConsentTexts finds the build map walking up from the bundled endpoint', async () => {
  const { mkdtemp, mkdir, writeFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { pathToFileURL } = await import('node:url');
  const dir = await mkdtemp(join(tmpdir(), 'consent-'));
  try {
    await mkdir(join(dir, 'pages', 'api'), { recursive: true });
    await writeFile(join(dir, 'consent-texts.json'), JSON.stringify(CONSENT_TEXTS));
    assert.deepEqual(readConsentTexts({ fromUrl: pathToFileURL(join(dir, 'pages', 'api', 'lead.mjs')).href }), CONSENT_TEXTS);
    assert.equal(readConsentTexts({ explicitPath: join(dir, 'missing.json') }), null);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('clientIp honours trusted proxy hops and falls back to the socket address', () => {
  const headers = new Headers({ 'x-forwarded-for': 'forged, 203.0.113.9' });
  assert.equal(clientIp(headers, '10.0.0.2'), '203.0.113.9');
  assert.equal(clientIp(headers, '10.0.0.2', 2), 'forged');
  assert.equal(clientIp(headers, '10.0.0.2', 0), '10.0.0.2');
  assert.equal(clientIp(new Headers(), '127.0.0.1'), '127.0.0.1');
});

test('foreign or missing Origin is forbidden (CSRF); Referer is accepted as fallback', async () => {
  const { handler, calls } = setup();
  const foreign = await handler(post(valid(), { json: true, origin: 'https://evil.example' }));
  assert.equal(foreign.status, 403);
  assert.deepEqual(await foreign.json(), { ok: false, error: 'forbidden' });
  const missing = await handler(post(valid(), { json: true, origin: '' }));
  assert.equal(missing.status, 403);
  assert.equal(calls.length, 0);
  const viaReferer = await handler(post(valid(), { json: true, origin: '', headers: { referer: `${SITE}/es/` } }));
  assert.equal(viaReferer.status, 200);
});

test('non-POST methods are rejected', async () => {
  const { handler } = setup();
  assert.equal((await handler(new Request(`${SITE}/api/lead`))).status, 405);
});

test('pure helpers: page path, error path and normalization', () => {
  assert.equal(safePagePath('https://evil.example/es/'), '');
  assert.equal(safePagePath('//evil.example/x'), '');
  assert.equal(safePagePath('javascript:alert(1)'), '');
  assert.equal(safePagePath('/en/servicios/data/?a=1#b'), '/en/servicios/data/');
  assert.equal(formErrorPath('en', '/es/', 'invalid'), '/en/?error=invalid#lead-error');
  assert.equal(formErrorPath('es', '/es/', 'invalid', 'evil<x>'), '/es/?error=invalid#lead-error');
  assert.equal(formErrorPath('es', '/es/', 'busy'), '/es/?error=busy#lead-error-busy');
  const result = validateLead({ ...valid(), ga_client_id: '<script>', utm_source: 'a\u0000b' }, { now: NOW, consentText: () => 'c' });
  assert.equal(result.ok, true);
  assert.equal(result.lead.ga_client_id, null);
  assert.equal(result.lead.utm_source, 'ab');
});

test('endpoints are on-demand and the layout delegates analytics to Analytics.astro', async () => {
  const read = path => readFile(new URL(path, import.meta.url), 'utf8');
  assert.match(await read('../src/pages/api/lead.ts'), /export const prerender = false/);
  const layout = await read('../src/layouts/RomaLayout.astro');
  assert.match(layout, /<Analytics ga4Id=\{globals\.ga4_id\} \/>/);
  assert.doesNotMatch(layout, /googletagmanager/);
  const analytics = await read('../src/components/roma/Analytics.astro');
});

test('ga_client_id accepts only GA client ids', () => {
  for (const [value, expected] of [['123.456', '123.456'], ['a b', null], ['x'.repeat(65), null], ['', null]]) {
    const result = validateLead({ ...valid(), ga_client_id: value }, { now: NOW, consentText: () => 'c' });
    assert.equal(result.lead.ga_client_id, expected);
  }
});

test('Analytics.astro: consent default before config, ads denied, no PII', async () => {
  const src = await readFile(new URL('../src/components/roma/Analytics.astro', import.meta.url), 'utf8');
  const iDefault = src.indexOf("gtag('consent','default'");
  assert.ok(iDefault > 0 && iDefault < src.indexOf("gtag('config'"), 'consent default must precede config');
  assert.match(src, /ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',wait_for_update:500/);
  assert.match(src, /\^G-\[A-Z0-9\]\+\$/);
  assert.match(src, /analytics_storage: state/);
  assert.doesNotMatch(src, /ad_storage: 'granted'|ad_user_data: 'granted'/);
  for (const name of ['cta_click', "'contact'", 'lang_switch', 'form_start', 'form_submit_attempt', 'generate_lead']) assert.ok(src.includes(name), name);
  assert.doesNotMatch(src, /\.get\('(name|message|contact_email|contact_whatsapp)'\)/);
});
