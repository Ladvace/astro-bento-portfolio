import assert from 'node:assert/strict';
import test from 'node:test';
import * as model from '../src/lib/website-model.mjs';
import { createWebsiteLoader } from '../src/lib/website-loader.mjs';

const faqRow = (id, fields = {}) => ({ id, status: 'published', locale: 'es', sort: 1, area: 'legal', question: '¿Pregunta?', answer: 'Respuesta.', ...fields });

test('snapshot provides FAQ and steps per locale and never invents testimonials', () => {
  for (const locale of ['es', 'en']) {
    const site = model.resolveWebsiteContent({}, locale);
    assert.equal(site.faq.length, 6);
    assert.equal(site.steps.length, 3);
    assert.deepEqual(site.testimonials, []);
    assert.ok(site.faq.every(row => row.locale === locale && ['legal', 'data', 'general'].includes(row.area)));
    assert.deepEqual(site.steps.map(row => row.sort), [1, 2, 3]);
    assert.ok(!JSON.stringify(site).includes('PENDIENTE'));
  }
});

test('published CMS rows replace the snapshot for that locale, ordered by sort; drafts and invalid rows are ignored', () => {
  const records = { website_faq: [
    faqRow('b', { sort: 2, question: 'Segunda' }), faqRow('a', { sort: 1, question: 'Primera' }),
    faqRow('draft', { status: 'draft' }), faqRow('bad-area', { area: 'tax' }), faqRow('blank', { question: '  ' }),
    faqRow('english', { locale: 'en', question: 'English only' }),
  ] };
  const es = model.resolveWebsiteContent(records, 'es');
  assert.deepEqual(es.faq.map(row => row.question), ['Primera', 'Segunda']);
  assert.deepEqual(Object.keys(es.faq[0]).sort(), ['answer', 'area', 'id', 'locale', 'question', 'sort']);
  const en = model.resolveWebsiteContent(records, 'en');
  assert.deepEqual(en.faq.map(row => row.question), ['English only']);
  // A locale with only invalid CMS rows keeps the approved snapshot.
  assert.equal(model.resolveWebsiteContent({ website_faq: [faqRow('x', { area: 'nope' })] }, 'es').faq.length, 6);
});

test('testimonials appear only when published and valid', () => {
  const row = { id: 't1', status: 'published', locale: 'es', sort: 1, area: 'data', quote: 'Muy útil.', author: 'Cliente', role: 'Gerente' };
  assert.equal(model.resolveWebsiteContent({ website_testimonials: [row] }, 'es').testimonials.length, 1);
  assert.equal(model.resolveWebsiteContent({ website_testimonials: [{ ...row, status: 'draft' }] }, 'es').testimonials.length, 0);
  assert.equal(model.resolveWebsiteContent({ website_testimonials: [{ ...row, area: 'general' }] }, 'es').testimonials.length, 0);
});

test('landing fields validate E.164, email, GA4 and file IDs and fall back on invalid CMS values', () => {
  for (const [key, ok, bad] of [
    ['legal_whatsapp', ['+573001234567', ''], ['3001234567', '+57 300 123 4567', '+0573001234567', 'tel:+573001234567']],
    ['contact_email', ['hola@example.com', ''], ['mailto:hola@example.com', 'hola@', 'a b@example.com']],
    ['ga4_id', ['G-BQD50XSC22', ''], ['UA-123-1', 'g-abc', 'G-<script>']],
  ]) {
    for (const value of ok) assert.deepEqual(model.validateContentPatch('globals', 'global', { [key]: value }), { [key]: value });
    for (const value of bad) {
      assert.throws(() => model.validateContentPatch('globals', 'global', { [key]: value }), TypeError, `${key}=${value}`);
      const site = model.resolveWebsiteContent({ website_globals: [{ id: 'global', status: 'published', [key]: value }] }, 'es');
      assert.equal(site.globals[key], model.websiteDefaults.website_globals[0][key]);
    }
  }
  // NULL columns that predate the migration keep the snapshot value.
  assert.equal(model.resolveWebsiteContent({ website_globals: [{ id: 'global', status: 'published', ga4_id: null }] }, 'es').globals.ga4_id, 'G-BQD50XSC22');
  const photo = '0f3c2a1b-1111-4222-8333-444455556666';
  const site = model.resolveWebsiteContent({ website_people: [{ id: 'es-tatiana', status: 'published', photo, credential: 'T.P. 000' }] }, 'es');
  assert.equal(site.people.tatiana.photo, photo);
  assert.equal(site.people.tatiana.credential, 'T.P. 000');
  assert.throws(() => model.validateContentPatch('people', 'es-tatiana', { photo: '../etc/passwd' }), TypeError);
  assert.deepEqual(model.validateContentPatch('practices', 'es-legal', { problems: [{ label: 'Linderos' }] }), { problems: [{ label: 'Linderos' }] });
});

test('helpers build WhatsApp and asset URLs only from valid values', () => {
  assert.equal(model.whatsappHref('+573001234567', 'Hola, tengo una consulta.'), 'https://wa.me/573001234567?text=Hola%2C%20tengo%20una%20consulta.');
  assert.equal(model.whatsappHref('+573001234567'), 'https://wa.me/573001234567');
  for (const bad of ['', '300', null, 'javascript:alert(1)']) assert.equal(model.whatsappHref(bad, 'x'), '');
  assert.equal(model.websiteFileUrl('0f3c2a1b-1111-4222-8333-444455556666'), 'https://cms.romahomestore.com/assets/0f3c2a1b-1111-4222-8333-444455556666');
  for (const bad of ['', null, '../x', 'https://evil.test/a.png']) assert.equal(model.websiteFileUrl(bad), '');
});

test('CMS loader requests locale and sort for repeatable collections and resolves them', async () => {
  const definition = model.websiteCollections.find(item => item.alias === 'faq');
  const requests = [];
  const load = createWebsiteLoader({ source: 'cms', baseUrl: 'https://cms.example.test', collections: [definition], fetcher: async url => {
    requests.push(new URL(String(url)));
    return Response.json({ data: [faqRow('cms-1', { question: 'Desde CMS' })] });
  } });
  assert.deepEqual((await load('es')).faq.map(row => row.question), ['Desde CMS']);
  assert.equal(requests[0].pathname, '/items/website_faq');
  assert.equal(requests[0].searchParams.get('fields'), 'id,status,locale,sort,area,question,answer');
  assert.equal(requests[0].searchParams.get('sort'), 'sort,id');
  assert.deepEqual(JSON.parse(requests[0].searchParams.get('filter')), { status: { _eq: 'published' } });
});
