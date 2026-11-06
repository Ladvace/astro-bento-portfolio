import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { safeExternalUrl, sanitizeArticleHtml } from '../src/lib/rich-text.mjs';
import { resolveWebsiteContent } from '../src/lib/website-model.mjs';

const bi = 'https://bi.romahomestore.com/public/question/b64d24e6-736c-4008-8131-4de7585a68f5';

test('safeExternalUrl rejects executable, relative, credentialed and malformed URLs', () => {
  for (const value of [null, undefined, '', 'javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,test', '//evil.test', '/relative', 'a-slug', 'https://user:pass@example.com', 'https://example.com\n/path', '<iframe src=']) {
    assert.equal(safeExternalUrl(value), null, String(value));
  }
  assert.equal(safeExternalUrl('https://github.com/henrymarinho90/ecommerceproject'), 'https://github.com/henrymarinho90/ecommerceproject');
  assert.equal(safeExternalUrl('http://bi.romahomestore.com/public/question/existing'), 'http://bi.romahomestore.com/public/question/existing');
});

test('sanitizer preserves real longform semantics and demotes body h1 for a unique page heading', () => {
  const result = sanitizeArticleHtml('<header><h1>Original title</h1></header><h2>Results</h2><p>SQL <strong>validation</strong> &amp; QA.</p><ul><li>Revenue</li></ul><ol><li>ETL</li></ol><pre><code class="language-sql">SELECT * FROM orders;</code></pre><table><caption>QA</caption><thead><tr><th scope="col">Metric</th></tr></thead><tbody><tr><td>5.74M</td></tr></tbody></table><figure><img src="https://cms.romahomestore.com/assets/example" alt="Dashboard" width="800"><figcaption>Original chart</figcaption></figure>');
  assert.match(result, /<h2>Original title<\/h2>/);
  assert.doesNotMatch(result, /<h1/);
  for (const token of ['<h2>Results', '<strong>validation', '<ul>', '<ol>', '<pre>', 'class="language-sql"', '<table>', '<caption>QA', 'scope="col"', '<figure>', 'alt="Dashboard"', '<figcaption>Original chart']) assert.ok(result.includes(token), token);
});

test('sanitizer removes executable markup, events, inline styles and arbitrary layout classes', () => {
  const result = sanitizeArticleHtml('<script>alert(1)</script><style>body{display:none}</style><p style="color:red" onclick="attack()" class="text-white">Keep</p><img src="javascript:attack()" onerror="attack()"><img src="data:image/svg+xml,evil"><a href="javascript:attack()">Bad</a><svg onload="attack()"></svg><form><input autofocus onfocus="attack()"></form>');
  assert.match(result, /<p>Keep<\/p>/);
  assert.doesNotMatch(result, /script|alert\(1\)|style=|onclick|onerror|javascript:|data:|<svg|<form|<input|class=/i);
});

test('safe links open new tabs with isolation while original mail contact stays usable', () => {
  const result = sanitizeArticleHtml('<a href="https://github.com/henrymarinho90/ecommerceproject" rel="opener" target="_self">Repository</a><a href="mailto:henrymarinho90@gmail.com">Email</a>');
  assert.match(result, /href="https:\/\/github.com\/henrymarinho90\/ecommerceproject"[^>]*target="_blank"[^>]*rel="noopener noreferrer"/);
  assert.match(result, /href="mailto:henrymarinho90@gmail.com"/);
  assert.doesNotMatch(result, /rel="opener"/);
});

test('only the verified HTTPS BI host and public routes may be framed', () => {
  const result = sanitizeArticleHtml(`<iframe src="${bi}" width="100%" height="600" style="border:0" onload="attack()"></iframe>`);
  assert.match(result, /<iframe /);
  assert.match(result, /title="Interactive dashboard"/);
  assert.match(result, /loading="lazy"/);
  assert.match(result, /referrerpolicy="no-referrer"/);
  assert.doesNotMatch(result, /onload|style=/);
  for (const src of ['https://evil.test/embed', 'https://bi.romahomestore.com.evil.test/public/question/x', 'https://bi.romahomestore.com/admin', bi.replace('https:', 'http:')]) {
    const fallback = sanitizeArticleHtml(`<iframe src="${src}"></iframe>`);
    assert.doesNotMatch(fallback, /<iframe/);
    assert.ok(fallback.includes(`href="${src}"`), fallback);
    assert.match(fallback, /rel="noopener noreferrer"/);
  }
});

test('removed unsafe frames never create executable fallback links or upgrade HTTP', () => {
  const result = sanitizeArticleHtml('<iframe src="javascript:attack()"></iframe><iframe src="data:text/html,bad"></iframe><iframe src="http://example.com/report"></iframe>');
  assert.doesNotMatch(result, /javascript:|data:|<iframe|https:\/\/example.com/);
  assert.match(result, /href="http:\/\/example.com\/report"/);
  assert.equal(sanitizeArticleHtml(null), '');
});

const root = new URL('../', import.meta.url);
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
async function pathsFor(file, projects) {
  const source = await readFile(new URL(file, root), 'utf8');
  const script = source.split('---')[1].replace(/^import .*;\s*$/gm, '').replace(/export /g, '');
  // Only execute the route generator; rendering belongs to Astro's build tests.
  const generator = script.slice(script.indexOf('async function getStaticPaths'), script.indexOf('const { project }'));
  return new AsyncFunction('getPublishedProjects', `${generator}\nreturn getStaticPaths();`)(async () => projects);
}

test('all localized article aliases preserve all CMS slugs in ES and EN', async () => {
  const projects = [{ slug: 'original-slug', title: 'Original', content: '<p>Original body</p>' }, { slug: 'another-original', title: 'Another' }];
  for (const file of ['src/pages/[locale]/blog/[slug].astro']) {
    const paths = await pathsFor(file, projects);
    assert.equal(paths.length, 4);
    for (const locale of ['es', 'en']) for (const project of projects) assert.deepEqual(paths.find((path) => path.params.locale === locale && path.params.slug === project.slug), { params: { locale, slug: project.slug }, props: { project } });
  }
});

test('all archives consume existing CMS projects rather than sample Markdown', async () => {
  for (const file of ['src/pages/[locale]/blog/index.astro']) {
    const source = await readFile(new URL(file, root), 'utf8');
    assert.match(source, /await getPublishedProjects\(\)/);
    assert.match(source, /<Archive/);
    assert.doesNotMatch(source, /getCollection|src\/data\/blog|PostRow/);
  }
});

test('shared article declares the per-locale canonical and genuine author with untranslated-body notice', async () => {
  const source = await readFile(new URL('src/components/roma/Article.astro', root), 'utf8');
  assert.match(source, /`\/\$\{locale\}\/blog\/\$\{project\.slug\}\/`/);
  assert.match(source, /canonicalPath=\{canonicalPath\}/);
  assert.match(source, /const site = await getWebsiteContent\(locale\)/);
  assert.match(source, /const \{[^}]*\bcommon\b[^}]*\bpeople\b[^}]*\} = site/);
  assert.match(source, /<p>\{common\.article_by_label\}\s*\{people\.henry\.name\}/);
  assert.match(source, /common\.article_original_note && <p class="article-note">\{common\.article_original_note\}<\/p>/);
  for (const locale of ['es', 'en']) {
    const site = resolveWebsiteContent({}, locale);
    assert.equal(site.people.henry.name, 'Henry Mariño', `${locale} approved article author`);
    assert.equal(site.common.article_by_label, locale === 'es' ? 'Por' : 'By');
    assert.equal(site.common.article_original_note, locale === 'es'
      ? 'Contenido original en inglés. La interfaz está en español; el artículo conserva su idioma y texto originales.'
      : '');
  }
  assert.match(source, /class="prose-content" lang="en"/);
  assert.match(source, /set:html=\{body\}/);
  assert.match(source, /sanitizeArticleHtml\(project\.content\)/);
  assert.doesNotMatch(source, /Tatiana/);
  assert.doesNotMatch(source, /people\.tatiana/);
});
