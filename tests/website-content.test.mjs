import assert from 'node:assert/strict';
import test from 'node:test';
import * as model from '../src/lib/website-model.mjs';

const published = (id, fields = {}) => ({ id, status: 'published', ...fields });

test('navigationHref preserves the original approved routes in both locales', () => {
  assert.equal(typeof model.navigationHref, 'function');
  for (const locale of ['es', 'en']) {
    const navigation = model.resolveWebsiteContent({}, locale).common.navigation;
    assert.deepEqual(navigation.map(item => model.navigationHref(item, locale)), [
      `/${locale}/`, `/${locale}/#servicios`, `/${locale}/#nosotros`, `/${locale}/blog/`, `/${locale}/#contacto`,
    ]);
    for (const item of navigation) {
      const { url, ...withoutUrl } = item;
      assert.equal(model.navigationHref(withoutUrl, locale), model.navigationHref(item, locale));
    }
  }
});

test('navigationHref uses only safe URL overrides and otherwise keeps the approved target route', () => {
  for (const locale of ['es', 'en']) {
    for (const url of ['https://example.com/a?x=1&y=2', '/roma/contacto', '#contacto', 'mailto:persona@example.com?subject=Consulta%20ROMA', 'tel:+573001234567']) {
      assert.equal(model.navigationHref({ target: 'contact', url }, locale), url);
    }
    for (const url of ['', null, 42, {}, 'javascript:alert(1)', '//evil.test/x', '/\\\\evil.test', '/%2fevil.test', 'https://example.com/%0aevil', 'https://example.com/a b', 'http://example.com', 'x'.repeat(2049)]) {
      assert.equal(model.navigationHref({ target: 'contact', url }, locale), `/${locale}/#contacto`);
    }
  }
});

test('navigationHref cannot generate routes from unapproved targets or locales', () => {
  for (const locale of ['es', 'en']) {
    for (const item of [null, undefined, {}, { target: 'missing' }, { target: '__proto__' }, { target: 'constructor' }, { target: '../admin' }, { target: null }, { target: ['blog'] }]) {
      assert.equal(model.navigationHref(item, locale), `/${locale}/`);
    }
  }
  for (const locale of ['fr', '../admin', '__proto__', '', undefined, null]) {
    assert.throws(() => model.navigationHref({ target: 'home' }, locale), RangeError);
    assert.throws(() => model.navigationHref({ target: 'home', url: 'https://example.com/' }, locale), RangeError);
  }
});

test('editorial workflow accepts draft/published status and record labels without changing identity', () => {
  for (const status of ['draft', 'published']) {
    const patch = { status, record_label: 'Español · Inicio revisado', hero_title: 'Título revisado' };
    assert.deepEqual(model.validateContentPatch('home', 'es', patch), patch);
  }
  for (const status of ['archived', '', null, 1]) assert.throws(() => model.validateContentPatch('home', 'es', { status }), TypeError);
  for (const record_label of [null, {}, 'x'.repeat(20001)]) assert.throws(() => model.validateContentPatch('home', 'es', { record_label }), TypeError);
  const patch = model.validateContentPatch('home', 'es', { status: 'draft', record_label: 'Borrador', hero_title: 'No visible' });
  assert.equal(model.resolveWebsiteContent({ website_home: [{ id: 'es', ...patch }] }, 'es').home.hero_title, 'Rigor jurídico.');
});

test('published record labels are validated without changing record identity', () => {
  const patch = model.validateContentPatch('people', 'es-henry', { status: 'published', record_label: 'Henry · Perfil revisado', name: 'Henry editado' });
  const records = { website_people: [{ ...patch, id: 'es-henry', locale: 'es', key: 'tatiana' }] };
  const person = model.resolveWebsiteContent(records, 'es').people.henry;
  assert.equal(person.record_label, patch.record_label);
  assert.equal(person.name, patch.name);
  assert.equal(person.id, 'es-henry');
  assert.equal(person.locale, 'es');
  assert.equal(person.key, 'henry');
  assert.equal(person.status, 'published');
  const baseline = model.websiteDefaults.website_people.find(row => row.id === 'es-henry');
  for (const record_label of [undefined, null, 1, {}, '', '  ', 'x'.repeat(20001)]) {
    const site = model.resolveWebsiteContent({ website_people: [published('es-henry', { record_label, name: 'Nombre válido' })] }, 'es');
    assert.equal(site.people.henry.record_label, baseline.record_label);
    assert.equal(site.people.henry.name, 'Nombre válido');
  }
  const draft = model.resolveWebsiteContent({ website_people: [{ id: 'es-henry', status: 'draft', record_label: 'No publicar' }] }, 'es');
  assert.equal(draft.people.henry.record_label, baseline.record_label);
});

test('optional notes, links and empty lists may be blank without weakening required titles', () => {
  for (const [alias, id, patch] of [
    ['common', 'en', { archive_note: '', article_original_note: '' }],
    ['home', 'es', { contact_note: '', original_note: '' }],
    ['practices', 'es-legal', { disclaimer: '', projects_link_label: '' }],
    ['people', 'es-tatiana', { linkedin_url: '', experience_label: '', jobs: [], tools: [] }],
    ['globals', 'global', { data_contact_url: '', legal_contact_url: '' }],
    ['common', 'es', { navigation: [{ target: 'home', label: 'Inicio', url: '' }] }],
  ]) assert.deepEqual(model.validateContentPatch(alias, id, patch), patch);
  const site = model.resolveWebsiteContent({ website_common: [published('es', { archive_note: '' })], website_people: [published('es-henry', { linkedin_url: '', tools: [] })] }, 'es');
  assert.equal(site.common.archive_note, '');
  assert.equal(site.people.henry.linkedin_url, '');
  assert.deepEqual(site.people.henry.tools, []);
  for (const definition of model.websiteCollections) {
    for (const row of definition.records) {
      const patch = Object.fromEntries(definition.fields.map(field => [field.key, row[field.key]]));
      assert.deepEqual(model.validateContentPatch(definition.alias, row.id, patch), patch);
    }
  }
  for (const [alias, id, key] of [['globals', 'global', 'brand_name'], ['people', 'es-henry', 'name'], ['practices', 'es-legal', 'page_title'], ['practices', 'es-legal', 'card_title']]) {
    assert.throws(() => model.validateContentPatch(alias, id, { [key]: '' }), TypeError);
  }
});

test('unsafe links and image URLs are rejected and never enter resolved content', () => {
  const unsafe = ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:image/svg+xml,test', '//evil.test/x', '/\\evil.test', 'https:\\evil.test', ' javaScript:alert(1)', 'https://example.com/a b', 'java\nscript:alert(1)', 'https://example.com/\u0000x', 'https://example.com/\u200bx', '/%2fevil.test', '/%5cevil.test', 'https://example.com/%0aevil', 'http://example.com', 'https://', 'x'.repeat(2049)];
  for (const url of unsafe) {
    assert.throws(() => model.validateContentPatch('globals', 'global', { data_contact_url: url }), TypeError, url);
    assert.throws(() => model.validateContentPatch('people', 'es-henry', { linkedin_url: url }), TypeError, url);
    assert.throws(() => model.validateContentPatch('common', 'es', { navigation: [{ target: 'home', label: 'Inicio', url }] }), TypeError, url);
    for (const key of ['header_logo', 'footer_logo', 'symbol_image', 'social_image']) {
      assert.throws(() => model.validateContentPatch('globals', 'global', { [key]: url }), TypeError, url);
      const site = model.resolveWebsiteContent({ website_globals: [published('global', { [key]: url })] }, 'es');
      assert.equal(site.globals[key], model.websiteDefaults.website_globals[0][key]);
    }
    const site = model.resolveWebsiteContent({ website_people: [published('es-henry', { linkedin_url: url })] }, 'es');
    assert.equal(site.people.henry.linkedin_url, 'https://linkedin.com/in/henrymarinho90/');
  }
  for (const url of ['https://example.com/a?x=1&y=2', '/roma/contacto', '#contacto', 'mailto:persona@example.com?subject=Consulta%20ROMA', 'tel:+573001234567']) {
    assert.deepEqual(model.validateContentPatch('globals', 'global', { legal_contact_url: url }), { legal_contact_url: url });
  }
  for (const url of ['https://example.com/logo.svg', '/roma/assets/logo.svg']) {
    assert.deepEqual(model.validateContentPatch('globals', 'global', { header_logo: url }), { header_logo: url });
  }
  for (const url of ['mailto:persona@example.com', 'tel:+57', '#logo']) assert.throws(() => model.validateContentPatch('globals', 'global', { header_logo: url }), TypeError);
});

test('malformed or oversized lists are rejected atomically and resolve to source lists', () => {
  const cases = [
    ['common', 'es', 'navigation', { target: 'home', label: 'Inicio', url: 'https://example.com/' }, 10],
    ['people', 'es-henry', 'jobs', { company: 'Empresa', role: 'Analista', year: '2026' }, 30],
    ['people', 'es-henry', 'tools', { name: 'SQL' }, 50],
    ['practices', 'es-legal', 'card_items', { label: 'Civil' }, 30],
    ['practices', 'es-legal', 'page_items', { label: 'Civil' }, 30],
  ];
  for (const [alias, id, key, item, max] of cases) {
    assert.deepEqual(model.validateContentPatch(alias, id, { [key]: [item] }), { [key]: [item] });
    const baseline = model.websiteDefaults[`website_${alias}`].find(row => row.id === id)[key];
    for (const value of [null, {}, '[]', [null], ['text'], [{}], [{ ...item, unexpected: 'x' }], [item, {}], Array.from({ length: max + 1 }, () => item)]) {
      assert.throws(() => model.validateContentPatch(alias, id, { [key]: value }), TypeError);
      const site = model.resolveWebsiteContent({ [`website_${alias}`]: [published(id, { [key]: value })] }, 'es');
      const resolved = alias === 'people' ? site.people.henry : alias === 'practices' ? site.practices.legal : site.common;
      assert.deepEqual(resolved[key], baseline);
    }
  }
  assert.throws(() => model.validateContentPatch('common', 'es', { navigation: [{ target: 'arbitrary', label: 'X', url: 'https://example.com' }] }), TypeError);
});

test('tiny scalar patches preserve literal text while rejecting invalid scalar overrides', () => {
  const patch = { hero_title: 'Un título <literal> & sin traducción' };
  assert.deepEqual(model.validateContentPatch('home', 'es', patch), patch);
  assert.deepEqual(model.validateContentPatch('people', 'es-henry', { label: 'Área editorial' }), { label: 'Área editorial' });
  for (const value of [null, 42, {}, [], '', '  ', 'x'.repeat(20001)]) {
    assert.throws(() => model.validateContentPatch('home', 'es', { hero_title: value }), TypeError);
    const site = model.resolveWebsiteContent({ website_home: [published('es', { hero_title: value, hero_accent: 'Válido' })] }, 'es');
    assert.equal(site.home.hero_title, 'Rigor jurídico.');
    assert.equal(site.home.hero_accent, 'Válido');
  }
});

test('patches reject unknown aliases, unknown records, identity changes and unknown fields', () => {
  assert.equal(typeof model.validateContentPatch, 'function');
  for (const [alias, id, patch] of [
    ['missing', 'es', {}], ['website_home', 'es', {}], ['home', 'fr', {}], ['globals', 'es', {}],
    ['people', 'es-unknown', {}], ['home', 'es', { id: 'es' }], ['home', 'es', { locale: 'en' }],
    ['people', 'es-henry', { key: 'tatiana' }], ['home', 'es', { unknown: 'x' }],
    ['home', 'es', JSON.parse('{"__proto__": {"polluted": true}}')],
  ]) assert.throws(() => model.validateContentPatch(alias, id, patch), TypeError);
  for (const patch of [null, [], 'title']) assert.throws(() => model.validateContentPatch('home', 'es', patch), TypeError);
});

test('collection descriptors expose the five fixed and three repeatable collections with Spanish editorial metadata', () => {
  assert.ok(Array.isArray(model.websiteCollections));
  assert.deepEqual(model.websiteCollections.map(item => item.alias), ['globals', 'common', 'home', 'practices', 'people', 'faq', 'steps', 'testimonials']);
  const metadata = ['id', 'status', 'locale', 'key', 'record_label', 'sort'];
  for (const definition of model.websiteCollections) {
    assert.deepEqual(Object.keys(definition).sort(), ['alias', 'collection', 'fields', 'label', 'records', 'repeatable', 'singleton']);
    assert.equal(definition.collection, `website_${definition.alias}`);
    assert.deepEqual(definition.records, model.websiteDefaults[definition.collection]);
    assert.equal(definition.singleton, definition.alias === 'globals');
    assert.equal(definition.repeatable, ['faq', 'steps', 'testimonials'].includes(definition.alias));
    if (definition.records.length) assert.deepEqual(definition.fields.map(field => field.key).sort(), [...new Set(definition.records.flatMap(Object.keys))].filter(key => !metadata.includes(key)).sort());
    for (const field of definition.fields) {
      assert.ok(['string', 'list'].includes(field.type));
      assert.equal(typeof field.required, 'boolean');
      assert.ok(field.label && field.label !== field.key);
      assert.ok(field.group && !field.group.includes('_'));
      if (field.type === 'string') assert.ok(field.maxLength <= (field.format === 'markdown' ? 50000 : 20000));
      else {
        assert.ok(field.maxItems > 0);
        assert.ok(field.itemFields.every(item => item.type === 'string'));
      }
    }
  }
  assert.ok(model.websiteCollections.find(item => item.alias === 'people').fields.some(field => field.key === 'label'));
  assert.deepEqual(model.websiteCollections[0].records.map(row => row.id), ['global']);
  assert.deepEqual(model.websiteCollections[1].records.map(row => row.id), ['es', 'en']);
});

test('drafts and snapshots without published status never override the baseline', () => {
  for (const status of ['draft', undefined, 'archived']) {
    const records = { website_home: [{ id: 'es', status, hero_title: 'No publicar' }] };
    assert.equal(model.resolveWebsiteContent(records, 'es').home.hero_title, 'Rigor jurídico.');
  }
  const records = { website_home: [{ id: 'es', status: 'draft', hero_title: 'Draft' }, published('es', { hero_title: 'Visible' })] };
  assert.equal(model.resolveWebsiteContent(records, 'es').home.hero_title, 'Visible');
});

test('Spanish and English overrides are isolated by ID and declared locale', () => {
  const records = {
    website_home: [published('en', { locale: 'en', hero_title: 'English edit' }), published('es', { locale: 'en', hero_title: 'Foreign locale' })],
    website_people: [published('es-henry', { locale: 'es', name: 'Henry editado' }), published('xx-henry', { name: 'Unknown' })],
  };
  assert.equal(model.resolveWebsiteContent(records, 'es').home.hero_title, 'Rigor jurídico.');
  assert.equal(model.resolveWebsiteContent(records, 'en').home.hero_title, 'English edit');
  assert.equal(model.resolveWebsiteContent(records, 'es').people.henry.name, 'Henry editado');
  assert.equal(model.resolveWebsiteContent(records, 'en').people.henry.name, 'Henry Mariño');
  assert.throws(() => model.resolveWebsiteContent({}, 'fr'), RangeError);
  assert.throws(() => model.resolveWebsiteContent({}, '__proto__'), RangeError);
});

test('published snapshots override only known fields and preserve missing source values', () => {
  const records = { website_home: [published('es', { hero_title: 'Nuevo titular', unknown: 'ignored' })] };
  const site = model.resolveWebsiteContent(records, 'es');
  assert.equal(site.home.hero_title, 'Nuevo titular');
  assert.equal(site.home.hero_accent, 'Precisión analítica.');
  assert.equal(site.home.contact_title, 'Conversemos sobre tu situación.');
  assert.equal(Object.hasOwn(site.home, 'unknown'), false);
});

test('approved Spanish home content is available independently of templates', async () => {
  const { resolveWebsiteContent } = await import('../src/lib/website-model.mjs');
  const site = resolveWebsiteContent({}, 'es');
  assert.equal(site.home.hero_title, 'Rigor jurídico.');
  assert.equal(site.home.hero_accent, 'Precisión analítica.');
  assert.equal(site.people.henry.name, 'Henry Mariño');
  assert.equal(site.practices.legal.card_title, 'Asesoría jurídica');
});
