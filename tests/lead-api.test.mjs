import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createLeadHandler, createRateLimiter, validateLead, clientIp, safePagePath, formErrorPath, MAX_BODY_BYTES,
} from '../src/lib/lead.mjs';
import { createLeadTracker } from '../src/lib/posthog-server.mjs';
import { proxyTarget, assetsHostFor, forwardRequestHeaders, forwardResponseHeaders, createPosthogProxy } from '../src/lib/posthog-proxy.mjs';

const SITE = 'https://portfolio.romahomestore.com';
const NOW = 1_800_000_000_000;
const valid = () => ({
  name: 'Ana Pérez', area: 'legal', message: 'Necesito asesoría sobre un contrato laboral.',
  contact_whatsapp: '+57 300 123 4567', contact_email: '', consent: 'on', website: '',
  locale: 'es', page: '/es/servicios/legal/?utm_source=x', started_at: String(NOW - 60_000),
  utm_source: 'google', utm_medium: 'cpc', utm_campaign: 'otono', posthog_distinct_id: '0192f-abc',
});

function setup({ env = { DIRECTUS_LEADS_TOKEN: 'tok', DIRECTUS_URL: 'https://cms.test' }, directus = () => new Response(null, { status: 204 }), track, limiter } = {}) {
  const calls = [];
  const tracked = [];
  const errors = [];
  const fetcher = async (url, init) => { calls.push({ url, init }); return directus(url, init); };
  const handler = createLeadHandler({
    env, fetcher, now: () => NOW, siteOrigin: SITE,
    consentText: locale => `consent-${locale}`,
    track: track ?? (async event => { tracked.push(event); }),
    rateLimiter: limiter ?? createRateLimiter(),
    logger: { error: (...args) => errors.push(args.join(' ')) },
  });
  return { handler, calls, tracked, errors };
}

function post(body, { json = false, accept = json ? 'application/json' : 'text/html', origin = SITE, headers = {} } = {}) {
  const data = json ? JSON.stringify(body) : new URLSearchParams(body).toString();
  return new Request(`${SITE}/api/lead`, {
    method: 'POST', body: data,
    headers: { 'content-type': json ? 'application/json' : 'application/x-www-form-urlencoded', accept, ...(origin ? { origin } : {}), ...headers },
  });
}

test('valid form lead is stored in Directus and redirects 303 to the thank-you page', async () => {
  const { handler, calls, tracked } = setup();
  const response = await handler(post(valid()), { clientAddress: '1.1.1.1' });
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('location'), '/es/gracias/?area=legal');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://cms.test/items/leads');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer tok');
  const lead = JSON.parse(calls[0].init.body);
  assert.deepEqual(Object.keys(lead).sort(), ['area', 'consent', 'consent_text', 'contact_email', 'contact_whatsapp', 'locale', 'message', 'name', 'page', 'posthog_distinct_id', 'utm_campaign', 'utm_medium', 'utm_source'].sort());
  assert.equal(lead.contact_whatsapp, '+573001234567');
  assert.equal(lead.page, '/es/servicios/legal/');
  assert.equal(lead.consent, true);
  assert.equal(lead.consent_text, 'consent-es');
  // Analytics gets no personal data.
  assert.deepEqual(tracked, [{ distinctId: '0192f-abc', area: 'legal', locale: 'es', utm_source: 'google', utm_medium: 'cpc', utm_campaign: 'otono' }]);
});

test('JSON request gets JSON response; Directus 200 is also success', async () => {
  const { handler } = setup({ directus: () => Response.json({ data: { id: 1 } }) });
  const response = await handler(post({ ...valid(), consent: true, area: 'data', locale: 'en', contact_email: 'A@Example.com', contact_whatsapp: '' }, { json: true }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, redirect: '/en/gracias/?area=data' });
});

test('honeypot and too-fast submissions get a fake success and are not stored', async () => {
  for (const payload of [{ ...valid(), website: 'http://spam' }, { ...valid(), started_at: String(NOW - 1000) }]) {
    const { handler, calls, tracked } = setup();
    const response = await handler(post(payload, { json: true }));
    assert.deepEqual(await response.json(), { ok: true, redirect: '/es/gracias/?area=legal' });
    assert.equal(calls.length, 0);
    assert.equal(tracked.length, 0);
  }
  {
    const { handler, calls } = setup();
    const body = `${new URLSearchParams(valid())}&website=spam`;
    await handler(new Request(`${SITE}/api/lead`, { method: 'POST', body, headers: { 'content-type': 'application/x-www-form-urlencoded', origin: SITE } }));
    assert.equal(calls.length, 0, 'duplicated honeypot field');
  }
  // No started_at (no JS) or a client clock ahead of the server is not treated as a bot.
  for (const started_at of ['', String(NOW + 120_000)]) {
    const { handler, calls } = setup();
    await handler(post({ ...valid(), started_at }));
    assert.equal(calls.length, 1);
  }
});

test('validation errors: consent, contact, area, lengths, email and phone formats', async () => {
  const cases = [
    [{ consent: '' }, 'consent'],
    [{ contact_whatsapp: '', contact_email: '' }, 'contact'],
    [{ area: 'tax' }, 'invalid'],
    [{ locale: 'fr' }, 'invalid'],
    [{ name: 'A' }, 'invalid'],
    [{ name: 'x'.repeat(121) }, 'invalid'],
    [{ message: 'corto' }, 'invalid'],
    [{ message: 'x'.repeat(1501) }, 'invalid'],
    [{ contact_email: 'no-arroba' }, 'invalid'],
    [{ contact_whatsapp: '12ab34567' }, 'invalid'],
    [{ contact_whatsapp: '123' }, 'invalid'],
  ];
  for (const [patch, error] of cases) {
    const { handler, calls } = setup();
    const response = await handler(post({ ...valid(), ...patch }, { json: true }));
    assert.equal(response.status, 400, JSON.stringify(patch));
    assert.deepEqual(await response.json(), { ok: false, error });
    assert.equal(calls.length, 0);
  }
  const { handler } = setup();
  const response = await handler(post({ ...valid(), consent: '' }));
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('location'), '/es/servicios/legal/?error=consent#contacto');
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
    const { handler, errors, tracked } = setup({ directus });
    const response = await handler(post(valid(), { json: true }));
    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), { ok: false, error: 'server' });
    assert.equal(tracked.length, 0);
    assert.equal(errors.length, 1);
    assert.doesNotMatch(errors[0], /Ana|300|asesor/);
  }
  const { handler } = setup({ directus: () => new Response('x', { status: 500 }) });
  const response = await handler(post(valid()));
  assert.equal(response.headers.get('location'), '/es/servicios/legal/?error=server#contacto');
});

test('missing DIRECTUS_LEADS_TOKEN returns unavailable and calls nothing', async () => {
  const { handler, calls } = setup({ env: {} });
  const response = await handler(post(valid(), { json: true }));
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { ok: false, error: 'unavailable' });
  assert.equal(calls.length, 0);
});

test('PostHog failure never breaks a stored lead', async () => {
  const { handler, calls, errors } = setup({ track: async () => { throw new Error('down'); } });
  const response = await handler(post(valid(), { json: true }));
  assert.deepEqual(await response.json(), { ok: true, redirect: '/es/gracias/?area=legal' });
  assert.equal(calls.length, 1);
  assert.equal(errors.length, 1);
});

test('rate limit: 5 attempts per IP per 10 minutes, keyed on the proxy-appended XFF value', async () => {
  let t = NOW;
  const limiter = createRateLimiter({ now: () => t });
  const { handler } = setup({ limiter });
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
  assert.equal(formErrorPath('en', '/es/', 'invalid'), '/en/?error=invalid#contacto');
  const result = validateLead({ ...valid(), posthog_distinct_id: '<script>', utm_source: 'a\u0000b' }, { now: NOW, consentText: () => 'c' });
  assert.equal(result.ok, true);
  assert.equal(result.lead.posthog_distinct_id, null);
  assert.equal(result.lead.utm_source, 'ab');
});

test('lead_created tracker sends only non-personal properties and bounds the flush', async () => {
  const captured = [];
  const fake = { capture: event => captured.push(event), flush: () => new Promise(() => {}) };
  const track = createLeadTracker({ apiKey: 'phc_test', timeoutMs: 20, createClient: () => fake });
  await assert.rejects(track({ area: 'data', locale: 'en', utm_source: null, utm_medium: null, utm_campaign: 'x' }), /timeout/);
  assert.equal(captured[0].event, 'lead_created');
  assert.match(captured[0].distinctId, /^[0-9a-f-]{36}$/);
  assert.deepEqual(captured[0].properties, { area: 'data', locale: 'en', utm_campaign: 'x', source: 'api_lead', $process_person_profile: false });
  assert.equal(await createLeadTracker({})({ area: 'legal', locale: 'es' }), undefined);
});

// ------------------------------------------------------------------------------------------------ proxy
test('proxy maps /ingest/static to the assets host and the rest to the API host, keeping the query', () => {
  assert.equal(assetsHostFor('https://eu.i.posthog.com'), 'https://eu-assets.i.posthog.com');
  assert.equal(proxyTarget(`${SITE}/ingest/static/array.js?v=1`).href, 'https://eu-assets.i.posthog.com/static/array.js?v=1');
  assert.equal(proxyTarget(`${SITE}/ingest/e/?ip=0&_=1&ver=1.2`).href, 'https://eu.i.posthog.com/e/?ip=0&_=1&ver=1.2');
  assert.equal(proxyTarget(`${SITE}/ingest/decide?v=3`).href, 'https://eu.i.posthog.com/decide?v=3');
  assert.equal(proxyTarget(`${SITE}/ingest/staticx`).href, 'https://eu.i.posthog.com/staticx');
  assert.equal(proxyTarget(`${SITE}/other`), null);
});

test('proxy strips cookies, auth and forwarding headers and sets X-Forwarded-For', () => {
  const out = forwardRequestHeaders(new Headers({
    cookie: 'session=1', authorization: 'Bearer x', host: 'portfolio', 'x-forwarded-for': 'forged', 'content-type': 'text/plain', 'user-agent': 'UA', 'cf-connecting-ip': '1.1.1.1',
  }), '203.0.113.9');
  assert.equal(out.get('cookie'), null);
  assert.equal(out.get('authorization'), null);
  assert.equal(out.get('host'), null);
  assert.equal(out.get('cf-connecting-ip'), null);
  assert.equal(out.get('x-forwarded-for'), '203.0.113.9');
  assert.equal(out.get('content-type'), 'text/plain');
  assert.equal(out.get('user-agent'), 'UA');
  const back = forwardResponseHeaders(new Headers({ 'set-cookie': 'a=1', 'content-encoding': 'gzip', 'content-type': 'application/json' }));
  assert.equal(back.get('set-cookie'), null);
  assert.equal(back.get('content-encoding'), null);
  assert.equal(back.get('content-type'), 'application/json');
});

test('proxy: 404 without key, method filter, body forwarding and 1 MB limit', async () => {
  const calls = [];
  const fetcher = async (url, init) => { calls.push({ url, init }); return new Response('{"ok":1}', { status: 200, headers: { 'content-type': 'application/json' } }); };
  assert.equal((await createPosthogProxy({ fetcher })(new Request(`${SITE}/ingest/decide`))).status, 404);
  const proxy = createPosthogProxy({ apiKey: 'phc_x', fetcher, logger: { error() {} } });
  assert.equal((await proxy(new Request(`${SITE}/ingest/e/`, { method: 'PUT', body: 'x' }))).status, 405);
  const ok = await proxy(new Request(`${SITE}/ingest/e/?compression=gzip-js`, { method: 'POST', body: 'payload', headers: { cookie: 'a=1', 'x-forwarded-for': '198.51.100.7' } }), { clientAddress: '10.0.0.2' });
  assert.equal(ok.status, 200);
  assert.equal(calls[0].url, 'https://eu.i.posthog.com/e/?compression=gzip-js');
  assert.equal(new TextDecoder().decode(calls[0].init.body), 'payload');
  assert.equal(calls[0].init.headers.get('cookie'), null);
  assert.equal(calls[0].init.headers.get('x-forwarded-for'), '198.51.100.7');
  const big = await proxy(new Request(`${SITE}/ingest/e/`, { method: 'POST', body: new Uint8Array(1024 * 1024 + 1) }));
  assert.equal(big.status, 413);
  assert.equal(calls.length, 1);
});

test('endpoints are on-demand and the layout delegates analytics to Analytics.astro', async () => {
  const read = path => readFile(new URL(path, import.meta.url), 'utf8');
  assert.match(await read('../src/pages/api/lead.ts'), /export const prerender = false/);
  assert.match(await read('../src/pages/ingest/[...path].ts'), /export const prerender = false/);
  const layout = await read('../src/layouts/RomaLayout.astro');
  assert.match(layout, /<Analytics ga4Id=\{globals\.ga4_id\} \/>/);
  assert.doesNotMatch(layout, /googletagmanager/);
  const analytics = await read('../src/components/roma/Analytics.astro');
  assert.match(analytics, /api_host: '\/ingest'/);
  assert.match(analytics, /maskAllInputs: true/);
  assert.doesNotMatch(analytics, /capture_value_css_selector_allowlist:/);
});
