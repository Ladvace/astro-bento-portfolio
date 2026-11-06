import assert from 'node:assert/strict';
import test from 'node:test';

test('snapshot mode renders approved content without any network access', async () => {
  const { createWebsiteLoader } = await import('../src/lib/website-loader.mjs');
  const load = createWebsiteLoader({ source: 'snapshot', fetcher: () => { throw new Error('Network must not run'); } });
  assert.equal((await load('es')).home.hero_title, 'Tu asunto legal, en orden.');
  assert.equal((await load('en')).home.hero_title, 'Your legal matter, in order.');
});

test('CMS mode projects published editorial fields without sending credentials', async () => {
  const { createWebsiteLoader } = await import('../src/lib/website-loader.mjs');
  const requests = [];
  const load = createWebsiteLoader({
    source: 'cms', baseUrl: 'https://cms.example.test',
    collections: [{ collection: 'website_home', fields: [{ key: 'hero_title' }] }],
    fetcher: async (url, options) => { requests.push({ url: String(url), options }); return Response.json({ data: [] }); },
  });
  await load('es');
  assert.equal(requests.length, 1);
  const url = new URL(requests[0].url);
  assert.equal(url.pathname, '/items/website_home');
  assert.deepEqual(JSON.parse(url.searchParams.get('filter')), { status: { _eq: 'published' } });
  assert.equal(url.searchParams.get('limit'), '-1');
  assert.equal(url.searchParams.get('fields'), 'id,status,hero_title');
  assert.deepEqual(requests[0].options.headers, { Accept: 'application/json' });
  assert.ok(requests[0].options.signal instanceof AbortSignal);
});

test('a build shares one in-flight CMS read across pages and languages', async () => {
  const { createWebsiteLoader } = await import('../src/lib/website-loader.mjs');
  let requests = 0;
  const load = createWebsiteLoader({ source: 'cms', collections: [{ collection: 'website_home', fields: [] }], fetcher: async () => {
    requests += 1; await new Promise(resolve => setTimeout(resolve, 5)); return Response.json({ data: [] });
  } });
  await Promise.all([load('es'), load('en'), load('es')]);
  assert.equal(requests, 1);
});

test('configured CMS failures never produce a successful baseline-only build', async () => {
  const { createWebsiteLoader } = await import('../src/lib/website-loader.mjs');
  const load = createWebsiteLoader({ source: 'cms', collections: [{ collection: 'website_home', fields: [] }], fetcher: async () => Response.json({ errors: [{ message: 'unavailable' }] }, { status: 503 }) });
  await assert.rejects(load('es'), /website_home.*HTTP 503/);
});

test('transient network failures receive bounded retries', async () => {
  const { createWebsiteLoader } = await import('../src/lib/website-loader.mjs');
  let calls = 0;
  const load = createWebsiteLoader({ source: 'cms', retryDelayMs: 0, collections: [{ collection: 'website_home', fields: [] }], fetcher: async () => {
    calls += 1;
    if (calls < 3) throw new Error('Temporary network timeout');
    return Response.json({ data: [] });
  } });
  assert.equal((await load('es')).home.hero_title, 'Tu asunto legal, en orden.');
  assert.equal(calls, 3);
});

test('Directus singleton objects are normalized before editorial resolution', async () => {
  const { createWebsiteLoader } = await import('../src/lib/website-loader.mjs');
  const load = createWebsiteLoader({ source: 'cms', collections: [{ collection: 'website_globals', singleton: true, fields: [] }], fetcher: async () => Response.json({ data: { id: 'global', status: 'published', brand_name: 'Marca desde CMS' } }) });
  assert.equal((await load('es')).globals.brand_name, 'Marca desde CMS');
});

test('singleton requests omit list-only pagination and filters', async () => {
  const { createWebsiteLoader } = await import('../src/lib/website-loader.mjs');
  const load = createWebsiteLoader({ source: 'cms', collections: [{ collection: 'website_globals', singleton: true, fields: [{ key: 'brand_name' }] }], fetcher: async url => {
    assert.equal(url.searchParams.has('limit'), false);
    assert.equal(url.searchParams.has('filter'), false);
    assert.equal(url.searchParams.get('fields'), 'id,status,brand_name');
    return Response.json({ data: { id: 'global', status: 'published', brand_name: 'ROMA' } });
  } });
  assert.equal((await load('es')).globals.brand_name, 'ROMA');
});

test('malformed CMS response containers cannot publish a baseline-only build', async () => {
  const { createWebsiteLoader } = await import('../src/lib/website-loader.mjs');
  for (const [singleton, data] of [[false, undefined], [false, {}], [false, [null]], [true, []], [true, 'invalid']]) {
    const collection = singleton ? 'website_globals' : 'website_home';
    const load = createWebsiteLoader({ source: 'cms', collections: [{ collection, singleton, fields: [] }], fetcher: async () => Response.json({ data }) });
    await assert.rejects(load('es'), new RegExp(`Invalid CMS ${collection} response`));
  }
});
