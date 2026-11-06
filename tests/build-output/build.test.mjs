// Runs AFTER `npm run build` (npm run test:dist). Fails, never skips, when dist/ is missing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { sitemapFilter } from '../../src/lib/seo.mjs';

const root = new URL('../../dist/client/', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');
const origin = 'https://portfolio.romahomestore.com';

test('dist/ exists (run `npm run build` first)', () => {
  assert.ok(existsSync(new URL('sitemap-0.xml', root)), 'dist/client/sitemap-0.xml missing: build first');
});

test('built sitemap has no duplicates and covers es and en services', () => {
  const locs = [...read('sitemap-0.xml').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.equal(new Set(locs).size, locs.length);
  assert.ok(locs.every(sitemapFilter));
  for (const l of ['es', 'en']) for (const s of ['legal', 'data']) assert.ok(locs.includes(`${origin}/${l}/servicios/${s}/`));
});

test('built article has hreflang and canonical', () => {
  const built = read('en/blog/analisis-autos-usa/index.html');
  for (const l of ['es', 'en', 'x-default']) assert.ok(built.includes(`hreflang="${l}"`), l);
  assert.ok(built.includes(`rel="canonical" href="${origin}/en/blog/analisis-autos-usa/"`));
});

test('built pages never ship gtag/googletagmanager statically (Consent Mode basic)', () => {
  for (const p of ['es/index.html', 'en/index.html', 'es/blog/analisis-autos-usa/index.html']) {
    const html = read(p);
    assert.ok(!/<script[^>]+src=["'][^"']*googletagmanager/.test(html), `${p}: no static gtag.js <script src>`);
    assert.ok(!/<link[^>]+googletagmanager/.test(html), `${p}: no preload/preconnect to Google`);
  }
});
