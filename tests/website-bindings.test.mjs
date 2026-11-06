import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';
import { resolveWebsiteContent } from '../src/lib/website-model.mjs';
import { areaContact, contactEmailHref } from '../src/lib/landing.mjs';
import { safeExternalUrl, sanitizeArticleHtml } from '../src/lib/rich-text.mjs';

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const root = new URL('../', import.meta.url);

// Execute real Astro frontmatter, replacing only its import boundaries.
async function frontmatter(file, result, props, bindings = {}) {
  const source = await readFile(new URL(file, root), 'utf8');
  const script = source.split('---')[1]
    .replace(/^import .*;\s*$/gm, '')
    .replace(/export /g, '')
    .replace(/import\.meta\.env/g, '{}');
  const code = ts.transpileModule(script, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText;
  return new AsyncFunction('Astro', ...Object.keys(bindings), `${code}\nreturn ${result};`)(
    { props, site: new URL('https://portfolio.romahomestore.com'), url: new URL('https://portfolio.romahomestore.com/es/') },
    ...Object.values(bindings),
  );
}

test('Home resolves its hero title from approved website content', async () => {
  const content = resolveWebsiteContent({}, 'es');
  content.home.hero_title = 'Titular de prueba';
  const title = await frontmatter('src/components/roma/Home.astro', 'home.hero_title', {
    locale: 'es', projects: [],
  }, {
    getWebsiteContent: async (locale) => {
      assert.equal(locale, 'es');
      return content;
    },
    areaContact, contactEmailHref,
  });
  assert.equal(title, 'Titular de prueba');
});

test('archive resolves each localized heading and description without translating projects', async () => {
  for (const locale of ['es', 'en']) {
    const content = resolveWebsiteContent({}, locale);
    Object.assign(content.common, {
      blog_title: 'Título editorial', blog_description: 'Descripción editorial',
      projects_title: 'Título de proyectos', projects_description: 'Descripción de proyectos',
    });
    const projects = [{ slug: 'original', title: 'Original English title', description: 'Original English description' }];
    for (const kind of ['blog', 'project']) {
      const result = await frontmatter('src/components/roma/Archive.astro', '({title,description,site,projects})', {
        locale, kind, projects,
      }, { getWebsiteContent: async () => content, areaContact, contactEmailHref });
      assert.equal(result.title, kind === 'blog' ? content.common.blog_title : content.common.projects_title);
      assert.equal(result.description, kind === 'blog' ? content.common.blog_description : content.common.projects_description);
      assert.equal(result.site, content);
      assert.equal(result.projects, projects);
    }
  }
});

test('service pages resolve native editorial item arrays for both practices and locales', async () => {
  for (const locale of ['es', 'en']) {
    const content = resolveWebsiteContent({}, locale);
    for (const practice of ['legal', 'data']) {
      Object.assign(content.practices[practice], {
        page_title: `Título ${practice}`, page_description: `Descripción ${practice}`,
        page_items: [{ label: 'Primer servicio' }, { label: 'Nuevo servicio' }],
      });
      const result = await frontmatter('src/pages/[locale]/servicios/[practice].astro', '({title,intro,items,area,site})', {
        locale, practice,
      }, { getWebsiteContent: async () => content, areaContact, contactEmailHref });
      assert.equal(result.title, content.practices[practice].page_title);
      assert.equal(result.intro, content.practices[practice].page_description);
      assert.equal(result.items, content.practices[practice].page_items);
      assert.equal(result.area, content.practices[practice]);
      assert.equal(result.site, content);
    }
  }
});

test('article keeps the original full body, sanitizer and canonical URL while resolving website content', async () => {
  const content = resolveWebsiteContent({}, 'es');
  content.people.henry.name = 'Autor editorial';
  const project = {
    slug: 'original', title: 'Original English title',
    content: '<p>Original opening.</p><p>Original final paragraph.</p><script>alert(1)</script>',
    repo_link: 'javascript:alert(1)', url: 'https://example.com/project',
  };
  const result = await frontmatter('src/components/roma/Article.astro', '({body,repo,demo,canonicalPath,site,project,people})', {
    locale: 'es', project,
  }, { getWebsiteContent: async () => content, safeExternalUrl, sanitizeArticleHtml });
  assert.equal(result.site, content);
  assert.equal(result.people.henry.name, 'Autor editorial');
  assert.equal(result.project, project);
  assert.match(result.body, /Original opening/);
  assert.match(result.body, /Original final paragraph/);
  assert.doesNotMatch(result.body, /script|alert/);
  assert.ok(!result.repo);
  assert.equal(result.demo, 'https://example.com/project');
  assert.equal(result.canonicalPath, 'https://portfolio.romahomestore.com/project/original/');
});

test('layout reuses supplied content and binds identity, social image and JSON-LD without altering canonical logic', async () => {
  const content = resolveWebsiteContent({}, 'es');
  content.globals.brand_name = 'Marca editorial';
  content.globals.social_image = '/editorial-social.png';
  content.people.henry.name = 'Autor editorial';
  content.people.tatiana.name = 'Abogada editorial';
  const navigationCalls = [];
  const boundaries = {
    getWebsiteContent: async () => { throw new Error('Content should be reused'); },
    navigationHref: (item, locale) => {
      navigationCalls.push([item, locale]);
      return `/${locale}/${item.target}/`;
    },
  };
  for (const article of [false, true]) {
    const result = await frontmatter('src/layouts/RomaLayout.astro', '({site,schema,canonical,ogImage,nav})', {
      locale: 'es', title: 'Título', description: 'Descripción', content, article,
      canonicalPath: '/project/original/', pubDate: '2026-01-01',
    }, boundaries);
    assert.equal(result.site, content);
    assert.equal(result.canonical, 'https://portfolio.romahomestore.com/project/original/');
    assert.equal(result.ogImage, 'https://portfolio.romahomestore.com/editorial-social.png');
    assert.equal(result.schema['@context'], 'https://schema.org');
    if (article) {
      assert.equal(result.schema.author.name, 'Autor editorial');
      assert.equal(result.schema.publisher.name, 'Marca editorial');
      assert.equal(result.schema.datePublished, '2026-01-01');
    } else {
      assert.equal(result.schema.name, 'Marca editorial');
      assert.deepEqual(result.schema.member.map(person => person.name), ['Abogada editorial', 'Autor editorial']);
    }
    assert.deepEqual(result.nav.map(item => item.label), content.common.navigation.map(item => item.label));
  }
  assert.deepEqual(navigationCalls.map(([item, locale]) => [item.target, locale]),
    [...content.common.navigation, ...content.common.navigation].map(item => [item.target, 'es']));
  let calls = 0;
  const loaded = await frontmatter('src/layouts/RomaLayout.astro', 'site', {
    locale: 'es', title: 'Título', description: 'Descripción',
  }, { ...boundaries, getWebsiteContent: async (locale) => {
    assert.equal(locale, 'es');
    calls++;
    return content;
  } });
  assert.equal(loaded, content);
  assert.equal(calls, 1);
});
