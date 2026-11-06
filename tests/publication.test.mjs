import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';
import { readItems } from '@directus/sdk';
import rss from '@astrojs/rss';
import sanitizeHtml from 'sanitize-html';
// Transpile the actual CMS module so tests also run on the supported Node 20.
const cmsSource = await readFile(new URL('../src/lib/directus.ts', import.meta.url), 'utf8');
const cmsCode = ts.transpileModule(cmsSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText.replace("'@directus/sdk'", JSON.stringify(import.meta.resolve('@directus/sdk')));
const cms = await import(`data:text/javascript;base64,${Buffer.from(cmsCode).toString('base64')}`);

test('RSS publishes CMS projects with canonical project links and sanitized HTML', async () => {
  const source = await readFile(new URL('src/pages/rss.xml.js', root), 'utf8');
  assert.doesNotMatch(source, /getCollection|Gianmarco/);
  const projects = [{ slug: 'case-study', title: 'Case Study', description: 'Analysis', date_created: '2026-01-01T12:00:00Z', content: '<p>Results</p><script>alert(1)</script>' }];
  const getProjects = () => cms.getPublishedProjects(undefined, { request: async (command) => {
    assert.equal(command().params.limit, -1);
    assert.deepEqual(command().params.filter, { status: { _eq: 'published' } });
    return projects;
  } });
  const code = source.replace(/^import .*;\s*$/gm, '').replace(/export /g, '');
  const run = new AsyncFunction('getPublishedProjects', 'rss', 'sanitizeHtml', `${code}\nreturn GET({ site: new URL('https://portfolio.romahomestore.com') });`);
  const xml = await (await run(getProjects, rss, sanitizeHtml)).text();
  assert.match(xml, /Henry Marinho/);
  assert.match(xml, /<title>Case Study<\/title>/);
  assert.match(xml, /https:\/\/portfolio.romahomestore.com\/es\/blog\/case-study\//);
  assert.match(xml, /01 Jan 2026/);
  assert.match(xml, /Results/);
  assert.doesNotMatch(xml, /alert\(1\)|\/project\/|Gianmarco/);
  await assert.rejects(run(async () => { throw new Error('CMS unavailable'); }, rss, sanitizeHtml), /CMS unavailable/);
});

test('homepage propagates CMS errors instead of publishing an empty portfolio', async () => {
  const failure = new Error('CMS unavailable');
  await assert.rejects(frontmatter('src/pages/[locale]/index.astro', 'projects', async () => { throw failure; }), (error) => error === failure);
});

test('static paths include every published project beyond the CMS default page', async () => {
  const projects = Array.from({ length: 105 }, (_, id) => ({ slug: `project-${id}`, title: `Project ${id}` }));
  const paths = await frontmatter('src/pages/[locale]/blog/[slug].astro', 'getStaticPaths()', async (command) => {
    const { params } = command();
    assert.deepEqual(params.filter, { status: { _eq: 'published' } });
    return params.limit === -1 ? projects : projects.slice(0, params.limit ?? 100);
  });
  assert.equal(paths.length, 210);
  assert.deepEqual(paths.at(-1), { params: { locale: 'en', slug: 'project-104' }, props: { project: projects.at(-1) } });
});

test('static path generation rejects failed and malformed CMS responses', async () => {
  const failure = new Error('CMS unavailable');
  await assert.rejects(frontmatter('src/pages/[locale]/blog/[slug].astro', 'getStaticPaths()', async () => { throw failure; }), (error) => error === failure);
  await assert.rejects(frontmatter('src/pages/[locale]/blog/[slug].astro', 'getStaticPaths()', async () => null), /Invalid projects response/);
});

test('project index uses the complete published CMS collection, not template blog posts', async () => {
  const source = await readFile(new URL('src/pages/[locale]/blog/index.astro', root), 'utf8');
  assert.doesNotMatch(source, /getCollection|Gianmarco|PostRow/);
  const projects = [{ slug: 'case-study', title: 'Case Study' }];
  const result = await frontmatter('src/pages/[locale]/blog/index.astro', 'projects', async (command) => {
    assert.equal(command().params.limit, -1);
    assert.deepEqual(command().params.filter, { status: { _eq: 'published' } });
    return projects;
  });
  assert.deepEqual(result, projects);
});

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const root = new URL('../', import.meta.url);

// Execute the actual Astro frontmatter, injecting only the CMS boundary.
// No browser, production credentials, or live CMS required for regressions.
async function frontmatter(file, result, request) {
  const source = await readFile(new URL(file, root), 'utf8');
  const script = source.split('---')[1]
    .replace(/^import .*;\s*$/gm, '')
    .replace(/export /g, '')
    .replace(/import\.meta\.env/g, '{}');
  const client = { request };
  const getPublishedProjects = (limit) => cms.getPublishedProjects(limit, client);
  const code = ts.transpileModule(script, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  return new AsyncFunction('directus', 'readItems', 'getPublishedProjects', 'Astro', `${code}\nreturn ${result};`)(
    client, readItems, getPublishedProjects, { props: { project: {} }, params: { locale: 'es' } },
  );
}

test('homepage requests the three newest published projects with deterministic tie-breaking', async () => {
  const requests = [];
  const projects = [{ slug: 'newest', title: 'Newest' }];
  const result = await frontmatter('src/pages/[locale]/index.astro', 'projects', async (command) => {
    requests.push(command());
    return projects;
  });
  assert.deepEqual(result, projects);
  assert.equal(requests[0].path, '/items/projects');
  assert.deepEqual(requests[0].params.filter, { status: { _eq: 'published' } });
  assert.equal(requests[0].params.limit, 3);
  assert.deepEqual(requests[0].params.sort, ['-date_created', '-id']);
  const home = await readFile(new URL('src/components/roma/Home.astro', root), 'utf8');
  assert.match(home, /archive-grid/);
});
