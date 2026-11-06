/**
 * First-party reverse proxy for PostHog (/ingest/*), so analytics requests are not blocked as
 * third-party and no PostHog domain is called directly from the browser.
 *   /ingest/static/*  -> https://eu-assets.i.posthog.com/static/*
 *   /ingest/*         -> https://eu.i.posthog.com/*
 */
import { clientIp } from './lead.mjs';

export const PROXY_PREFIX = '/ingest';
export const PROXY_METHODS = Object.freeze(['GET', 'POST', 'OPTIONS']);
export const MAX_PROXY_BODY_BYTES = 1024 * 1024;
export const PROXY_TIMEOUT_MS = 10000;

// Hop-by-hop, client credentials and anything identifying the original edge are never forwarded.
const DROP_REQUEST_HEADERS = new Set([
  'host', 'cookie', 'authorization', 'proxy-authorization', 'connection', 'keep-alive', 'transfer-encoding', 'te', 'trailer',
  'upgrade', 'content-length', 'forwarded', 'x-forwarded-for', 'x-forwarded-host', 'x-forwarded-proto', 'x-forwarded-port',
  'x-forwarded-server', 'x-real-ip', 'via', 'cf-connecting-ip', 'true-client-ip', 'expect',
]);
// fetch() already decoded the body, so encoding/length from upstream would be wrong for the client.
const DROP_RESPONSE_HEADERS = new Set([
  'set-cookie', 'connection', 'keep-alive', 'transfer-encoding', 'content-encoding', 'content-length', 'trailer', 'upgrade',
  'strict-transport-security', 'alt-svc',
]);

/** Derives the assets host: https://eu.i.posthog.com -> https://eu-assets.i.posthog.com */
export function assetsHostFor(apiHost) {
  const url = new URL(apiHost);
  const match = url.hostname.match(/^([a-z]+)\.i\.posthog\.com$/);
  if (match) url.hostname = `${match[1]}-assets.i.posthog.com`;
  return url.origin;
}

/** Maps an incoming /ingest URL to the PostHog URL, preserving the query string. */
export function proxyTarget(requestUrl, { apiHost = 'https://eu.i.posthog.com', assetsHost = assetsHostFor(apiHost) } = {}) {
  const url = new URL(requestUrl);
  if (url.pathname !== PROXY_PREFIX && !url.pathname.startsWith(`${PROXY_PREFIX}/`)) return null;
  const rest = url.pathname.slice(PROXY_PREFIX.length) || '/';
  if (rest.split('/').some(segment => segment === '..' || segment === '.')) return null;
  const base = rest === '/static' || rest.startsWith('/static/') ? assetsHost : apiHost;
  const target = new URL(rest, new URL(base).origin);
  target.search = url.search;
  return target;
}

export function forwardRequestHeaders(headers, ip) {
  const out = new Headers();
  for (const [name, value] of headers) {
    const key = name.toLowerCase();
    if (DROP_REQUEST_HEADERS.has(key) || key.startsWith('cf-') || key.startsWith('sec-')) continue;
    out.set(key, value);
  }
  if (ip && ip !== 'unknown') out.set('x-forwarded-for', ip);
  return out;
}

export function forwardResponseHeaders(headers) {
  const out = new Headers();
  for (const [name, value] of headers) if (!DROP_RESPONSE_HEADERS.has(name.toLowerCase())) out.set(name, value);
  return out;
}

async function readBody(request, limit) {
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > limit) return null;
  if (!request.body) return undefined;
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) { await reader.cancel().catch(() => {}); return null; }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

/**
 * @param {{ apiKey?: string, apiHost?: string, assetsHost?: string, fetcher?: typeof fetch, trustedProxyHops?: number, logger?: { error: (...a: unknown[]) => void } }} options
 */
export function createPosthogProxy({ apiKey, apiHost = 'https://eu.i.posthog.com', assetsHost, fetcher = globalThis.fetch, trustedProxyHops = 1, logger = console } = {}) {
  const resolvedAssets = assetsHost || assetsHostFor(apiHost);
  /** @param {Request} request @param {{ clientAddress?: string }} [context] */
  return async function proxy(request, { clientAddress = '' } = {}) {
    if (!apiKey) return new Response('Not found', { status: 404 });
    if (!PROXY_METHODS.includes(request.method)) return new Response(null, { status: 405, headers: { Allow: PROXY_METHODS.join(', ') } });
    const target = proxyTarget(request.url, { apiHost, assetsHost: resolvedAssets });
    if (!target) return new Response('Not found', { status: 404 });

    let body;
    if (request.method === 'POST') {
      body = await readBody(request, MAX_PROXY_BODY_BYTES);
      if (body === null) return new Response('Payload too large', { status: 413 });
    }
    try {
      const upstream = await fetcher(target.href, {
        method: request.method,
        headers: forwardRequestHeaders(request.headers, clientIp(request.headers, clientAddress, trustedProxyHops)),
        body,
        redirect: 'manual',
        signal: AbortSignal.timeout(PROXY_TIMEOUT_MS),
      });
      const nullBody = [101, 204, 205, 304].includes(upstream.status);
      return new Response(nullBody ? null : upstream.body, { status: upstream.status, statusText: upstream.statusText, headers: forwardResponseHeaders(upstream.headers) });
    } catch (error) {
      logger.error(`[ingest] PostHog no respondió: ${error?.name ?? 'Error'}`);
      return new Response('Bad gateway', { status: 502 });
    }
  };
}
