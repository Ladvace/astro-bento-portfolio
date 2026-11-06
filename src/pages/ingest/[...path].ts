import type { APIRoute } from 'astro';
import { createPosthogProxy } from '../../lib/posthog-proxy.mjs';
import { DEFAULT_POSTHOG_HOST } from '../../lib/posthog-server.mjs';

export const prerender = false;

const env = process.env;
const hops = env.LEAD_TRUSTED_PROXY_HOPS === undefined || env.LEAD_TRUSTED_PROXY_HOPS === '' ? 1 : Number(env.LEAD_TRUSTED_PROXY_HOPS);

const proxy = createPosthogProxy({
  apiKey: env.PUBLIC_POSTHOG_KEY || import.meta.env.PUBLIC_POSTHOG_KEY,
  apiHost: env.POSTHOG_HOST || DEFAULT_POSTHOG_HOST,
  assetsHost: env.POSTHOG_ASSETS_HOST || undefined,
  trustedProxyHops: hops,
});

export const ALL: APIRoute = ({ request, clientAddress }) => proxy(request, { clientAddress });
