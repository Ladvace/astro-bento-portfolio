import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { legacyRedirect, sitemapFilter, robotsTxt, buildGraph, serializeJsonLd, llmsTxt } from '../src/lib/seo.mjs';
import defaults from '../src/content/website-defaults.json' with { type: 'json' };

const origin = new URL('https://portfolio.romahomestore.com');
const site = (locale) => ({
  globals: defaults.website_globals.find((g) => g.locale === locale) ?? defaults.website_globals[0],
  common: defaults.website_common.find((g) => g.locale === locale) ?? defaults.website_common[0],
  home: defaults.website_home.find((g) => g.locale === locale) ?? defaults.website_home[0],
  practices: Object.fromEntries(defaults.website_practices.filter((p) => p.locale === locale).map((p) => [p.key, p])),
  people: Object.fromEntries(defaults.website_people.filter((p) => p.locale === locale).map((p) => [p.key, p])),
});

test('legacy redirect table', () => {
  const cases = [
    ['/blog/', '/es/blog/'], ['/blog', '/es/blog/'], ['/project/', '/es/blog/'], ['/project', '/es/blog/'],
    ['/es/project/', '/es/blog/'], ['/en/project/', '/en/blog/'],
    ['/blog/x/', '/es/blog/x/'], ['/blog/x', '/es/blog/x/'], ['/project/x/', '/es/blog/x/'],
    ['/es/project/x/', '/es/blog/x/'], ['/en/project/x/', '/en/blog/x/'],
    ['/es/blog/x/', null], ['/en/blog/', null], ['/es/', null], ['/', null], ['/en/servicios/legal/', null], ['/rss.xml', null],
  ];
  for (const [from, to] of cases) assert.equal(legacyRedirect(from), to, from);
  // single hop: a target is never itself redirected
  for (const [, to] of cases) if (to) assert.equal(legacyRedirect(to), null, `chain at ${to}`);
});

test('sitemap filter keeps only canonical indexable pages', () => {
  const u = (p) => `https://portfolio.romahomestore.com${p}`;
  for (const p of ['/es/', '/en/', '/es/blog/', '/en/blog/x/', '/es/servicios/legal/', '/en/servicios/data/', '/es/privacidad/']) assert.equal(sitemapFilter(u(p)), true, p);
  for (const p of ['/blog/', '/blog/x/', '/project/x/', '/es/project/', '/en/project/x/', '/gracias/', '/es/gracias/'.replace('/es', ''), '/api/lead']) assert.equal(sitemapFilter(u(p)), false, p);
});

test('built sitemap has no duplicates and covers es and en services', { skip: !safeRead('dist/client/sitemap-0.xml') }, () => {
  const locs = [...safeRead('dist/client/sitemap-0.xml').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.equal(new Set(locs).size, locs.length);
  assert.ok(locs.every(sitemapFilter));
  for (const l of ['es', 'en']) for (const s of ['legal', 'data']) assert.ok(locs.includes(`${origin.origin}/${l}/servicios/${s}/`));
});
function safeRead(p) { try { return readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'); } catch { return null; } }

test('robots.txt', () => {
  const open = robotsTxt({ origin });
  assert.match(open, /Allow: \//); assert.match(open, /Disallow: \/api\//);
  assert.match(open, /Sitemap: https:\/\/portfolio\.romahomestore\.com\/sitemap-index\.xml/);
  const closed = robotsTxt({ origin, noindex: true });
  assert.match(closed, /Disallow: \/\n/); assert.doesNotMatch(closed, /Allow:/);
});

test('JSON-LD graph: entities, breadcrumbs, article, optional FAQ and sameAs', () => {
  const s = site('es');
  const base = { locale: 'es', origin, site: s, title: 'T', description: 'D', canonical: `${origin.origin}/es/blog/x/` };
  const types = (g) => g['@graph'].map((n) => n['@type']);
  for (const k of ['tatiana', 'henry']) s.people[k].linkedin_url = '';
  const page = buildGraph({ ...base, crumbs: [{ name: 'A', path: '/es/' }, { name: 'B', path: '/es/blog/' }] });
  for (const t of ['ProfessionalService', 'LegalService', 'Person', 'WebSite', 'BreadcrumbList']) assert.ok(types(page).includes(t), t);
  assert.equal(types(page).filter((t) => t === 'Person').length, 2);
  assert.ok(!types(page).includes('FAQPage'));
  assert.ok(page['@graph'].every((n) => !('sameAs' in n)), 'no sameAs without linkedin_url');
  const legal = page['@graph'].find((n) => n['@type'] === 'LegalService');
  assert.equal(legal.areaServed.name, 'Colombia'); assert.equal(legal.knowsLanguage, 'es');
  const art = buildGraph({ ...base, article: true, pubDate: '2025-01-02T00:00:00Z' });
  const post = art['@graph'].find((n) => n['@type'] === 'BlogPosting');
  assert.equal(post.inLanguage, 'en'); assert.equal(post.datePublished, '2025-01-02T00:00:00Z');
  const rich = structuredClone(s);
  rich.people.henry.linkedin_url = 'https://www.linkedin.com/in/henry';
  rich.faq = [{ question: 'Q?', answer: 'A.' }, { question: '', answer: 'x' }];
  const home = buildGraph({ ...base, site: rich, canonical: `${origin.origin}/es/`, isHome: true });
  assert.deepEqual(home['@graph'].find((n) => n['@id'].endsWith('#henry')).sameAs, ['https://www.linkedin.com/in/henry']);
  assert.equal(home['@graph'].find((n) => n['@type'] === 'FAQPage').mainEntity.length, 1);
  const out = serializeJsonLd({ t: '</script><b>' });
  assert.ok(!out.includes('<')); assert.equal(JSON.parse(out).t, '</script><b>');
});

test('layout emits hreflang for articles too and no Google Fonts', () => {
  const layout = readFileSync(new URL('../src/layouts/RomaLayout.astro', import.meta.url), 'utf8');
  assert.ok(!/!article\s*&&\s*<>\s*<link rel="alternate"/.test(layout));
  assert.ok(!layout.includes('fonts.googleapis') && !layout.includes('fonts.gstatic'));
  const built = safeRead('dist/client/en/blog/analisis-autos-usa/index.html');
  if (built) {
    for (const l of ['es', 'en', 'x-default']) assert.ok(built.includes(`hreflang="${l}"`), l);
    assert.ok(built.includes('rel="canonical" href="https://portfolio.romahomestore.com/en/blog/analisis-autos-usa/"'));
  }
});

test('llms.txt lists services and blog per language', () => {
  const txt = llmsTxt({ origin, locales: { es: site('es'), en: site('en') }, articles: { es: [{ slug: 'a', title: 'A' }], en: [{ slug: 'a', title: 'A' }] } });
  for (const u of ['/es/servicios/legal/', '/en/servicios/data/', '/es/blog/a/', '/en/blog/']) assert.ok(txt.includes(origin.origin + u), u);
});
