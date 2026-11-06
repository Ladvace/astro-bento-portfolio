import type { APIRoute } from 'astro';
import { robotsTxt } from '../lib/seo.mjs';

export const prerender = true;

export const GET: APIRoute = ({ site }) => new Response(
  robotsTxt({ origin: site ?? new URL('https://portfolio.romahomestore.com'), noindex: import.meta.env.PUBLIC_NOINDEX === 'true' }),
  { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
);
