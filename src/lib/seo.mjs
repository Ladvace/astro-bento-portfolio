/** SEO helpers: canonical routing, sitemap filtering, robots, llms.txt and JSON-LD. Pure; no env access. */
import { locales } from './i18n.mjs';

const isLocale = (value) => locales.includes(value);

/**
 * Legacy article/archive URLs -> canonical /{locale}/blog/... (single hop, no chains).
 * Returns null when the path is not a legacy route.
 */
export function legacyRedirect(pathname) {
  const parts = String(pathname).split(/[?#]/, 1)[0].split('/').filter(Boolean);
  const prefixed = isLocale(parts[0]);
  const locale = prefixed ? parts.shift() : 'es';
  const [section, slug, ...rest] = parts;
  if (rest.length || slug === undefined && section === undefined) return null;
  // Canonical: /{locale}/blog/... Legacy: any /project/..., and unprefixed /blog/...
  const legacy = section === 'project' || (!prefixed && section === 'blog');
  if (!legacy) return null;
  return slug ? `/${locale}/blog/${slug}/` : `/${locale}/blog/`;
}

const EXCLUDED_PREFIXES = ['/gracias', '/api'];
/** Sitemap filter: only canonical indexable pages (no legacy duplicates, no utility routes). */
export function sitemapFilter(page) {
  let path;
  try { path = new URL(page).pathname; } catch { return false; }
  if (EXCLUDED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) return false;
  const segments = path.split('/').filter(Boolean);
  if (!isLocale(segments[0])) return false; // unprefixed = legacy or redirect
  if (segments[1] === 'project') return false;
  if (segments[1] === 'gracias') return false; // noindex thank-you page, per locale
  return true;
}

export function robotsTxt({ origin, noindex = false }) {
  const lines = noindex
    ? ['User-agent: *', 'Disallow: /']
    : ['User-agent: *', 'Allow: /', 'Disallow: /api/'];
  lines.push('', `Sitemap: ${new URL('/sitemap-index.xml', origin).href}`, '');
  return lines.join('\n');
}

export function llmsTxt({ origin, locales: byLocale, articles = {} }) {
  const abs = (p) => new URL(p, origin).href;
  const out = [];
  const es = byLocale.es;
  out.push(`# ${es.globals.full_name}`, '');
  out.push(`> ${es.home.seo_description}`, '');
  out.push('ROMA / Bilingual (es, en). Tatiana Rodríguez: legal practice, Colombia only. Henry Mariño: digital marketing, data and AI, LATAM.', '');
  for (const lang of ['es', 'en']) {
    const c = byLocale[lang];
    out.push(`## ${lang === 'es' ? 'Español' : 'English'}`, '');
    out.push(`- [${c.globals.brand_name}](${abs(`/${lang}/`)}): ${c.home.seo_description}`);
    for (const key of ['legal', 'data']) {
      const p = c.practices[key];
      out.push(`- [${p.page_title}](${abs(`/${lang}/servicios/${key}/`)}): ${p.page_description}`);
    }
    out.push(`- [Blog](${abs(`/${lang}/blog/`)}): ${c.common.blog_description}`);
    for (const a of articles[lang] ?? []) out.push(`  - [${a.title}](${abs(`/${lang}/blog/${a.slug}/`)})`);
    out.push('');
  }
  return out.join('\n');
}

const first = (...values) => values.find((v) => typeof v === 'string' && v.trim());

/** JSON-LD @graph. Optional data (faq, linkedin_url, photo, whatsapp) is used only when present. */
export function buildGraph({ locale, origin, site, title, description, canonical, article = false, pubDate, image, crumbs = /** @type {{name:string,path:string}[]} */ ([]), isHome = false }) {
  const { globals, people } = site;
  const base = origin.href.replace(/\/$/, '');
  const abs = (p) => new URL(p, origin).href;
  const id = (name) => `${base}/#${name}`;
  const lang = locale === 'es' ? 'es' : 'en';
  const person = (key, extra) => {
    const p = people[key];
    const sameAs = [p.linkedin_url].filter((u) => typeof u === 'string' && /^https?:\/\//.test(u));
    const photo = first(p.photo);
    return {
      '@type': 'Person', '@id': id(key), name: p.name, jobTitle: p.role, worksFor: { '@id': id('roma') },
      ...(photo ? { image: abs(photo) } : {}), ...(sameAs.length ? { sameAs } : {}), ...extra,
    };
  };
  const romaSameAs = [globals.linkedin_url].filter((u) => typeof u === 'string' && /^https?:\/\//.test(u));
  const graph = [
    {
      '@type': 'ProfessionalService', '@id': id('roma'), name: globals.full_name, alternateName: globals.brand_name, url: base + '/',
      logo: { '@type': 'ImageObject', url: abs(globals.symbol_image || globals.header_logo) }, image: abs(globals.social_image),
      description: site.home?.seo_description || description,
      areaServed: [{ '@type': 'Place', name: 'Latin America' }],
      founder: [{ '@id': id('tatiana') }, { '@id': id('henry') }], employee: [{ '@id': id('tatiana') }, { '@id': id('henry') }],
      ...(romaSameAs.length ? { sameAs: romaSameAs } : {}),
    },
    {
      '@type': 'LegalService', '@id': id('legal'), name: `${globals.brand_name} — ${people.tatiana.name}`, url: abs(`/${lang}/servicios/legal/`),
      parentOrganization: { '@id': id('roma') }, provider: { '@id': id('tatiana') },
      areaServed: { '@type': 'Country', name: 'Colombia' }, knowsLanguage: 'es',
    },
    person('tatiana', { knowsLanguage: 'es', areaServed: { '@type': 'Country', name: 'Colombia' } }),
    person('henry', { knowsLanguage: ['es', 'en'] }),
    { '@type': 'WebSite', '@id': id('website'), url: base + '/', name: globals.full_name, inLanguage: lang, publisher: { '@id': id('roma') } },
  ];
  const pageNode = { '@type': 'WebPage', '@id': `${canonical}#webpage`, url: canonical, name: title, description, inLanguage: lang, isPartOf: { '@id': id('website') } };
  if (crumbs.length) {
    graph.push({
      '@type': 'BreadcrumbList', '@id': `${canonical}#breadcrumb`,
      itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: abs(c.path) })),
    });
    pageNode.breadcrumb = { '@id': `${canonical}#breadcrumb` };
  }
  if (article) {
    graph.push({
      '@type': 'BlogPosting', '@id': `${canonical}#article`, headline: title, description, mainEntityOfPage: canonical, url: canonical,
      inLanguage: 'en', // article bodies are authored in English (see lang="en" on .prose-content)
      author: { '@id': id('henry') }, publisher: { '@id': id('roma') },
      ...(image ? { image } : {}), ...(pubDate && !Number.isNaN(Date.parse(pubDate)) ? { datePublished: pubDate } : {}),
    });
  } else {
    graph.push(pageNode);
  }
  const faq = Array.isArray(site.faq) ? site.faq : [];
  const entities = faq.map((f) => ({ q: first(f.question, f.q, f.title), a: first(f.answer, f.a, f.body) })).filter((f) => f.q && f.a);
  if (isHome && entities.length) {
    graph.push({
      '@type': 'FAQPage', '@id': `${canonical}#faq`, inLanguage: lang,
      mainEntity: entities.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    });
  }
  return { '@context': 'https://schema.org', '@graph': graph };
}

export const serializeJsonLd = (data) => JSON.stringify(data).replace(/</g, '\\u003c');
