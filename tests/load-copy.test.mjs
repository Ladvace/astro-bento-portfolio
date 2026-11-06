import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { websiteCollections } from '../src/lib/website-model.mjs';
import { buildDesired, findPending, planCopy, prepare, runLoadCopy, applyToDefaults, buildPrivacyPolicy, PENDING_MARK, KNOWN } from '../scripts/load-copy.mjs';
import { createMemoryDirectus } from '../scripts/directus-memory.mjs';
import { createClient } from '../scripts/directus-schema.mjs';

const copy = JSON.parse(await readFile(new URL('../content/copy-v1.json', import.meta.url), 'utf8'));
const defaults = JSON.parse(await readFile(new URL('../src/content/website-defaults.json', import.meta.url), 'utf8'));
const target = (desired, collection, id) => desired.targets.find(t => t.collection === collection && t.id === id).fields;

// A deliberately stale CMS: old strings, NULL landing fields, and only 4 FAQ rows per... (fewer rows than copy).
function staleState() {
  const items = {};
  for (const definition of websiteCollections.filter(d => d.alias !== 'testimonials')) items[definition.collection] = structuredClone(defaults[definition.collection]);
  items.website_people[0].name = 'Tatiana Rodriguez';
  items.website_globals[0].legal_whatsapp = null;
  items.website_faq = items.website_faq.filter(r => r.sort <= 4);
  items.website_faq[0].question = 'Pregunta vieja';
  return {
    collections: websiteCollections.filter(d => d.alias !== 'testimonials').map(d => ({ collection: d.collection, meta: { singleton: d.singleton } })),
    items,
  };
}
const client = state => { const memory = createMemoryDirectus(state); return { memory, client: createClient({ baseUrl: 'http://localhost:8055', fetcher: memory.fetcher }) }; };

test('maps copy keys onto the real model fields', async () => {
  const desired = await prepare(copy);
  const home = target(desired, 'website_home', 'es');
  assert.equal(home.hero_legal_cta, copy.website_home.es.hero_legal_label);
  assert.equal(home.consent_label, copy.website_common.es.form_consent_label);
  assert.equal(home.consent_banner_text, copy.website_common.es.cookie_text);
  assert.equal(home.form_whatsapp_label, copy.website_common.es.form_phone_label);
  assert.equal(home.thanks_description, 'Te contactaremos por el medio que elegiste lo antes posible.');
  assert.match(home.form_message_hint, /Máximo 1500 caracteres/);
  assert.equal(target(desired, 'website_globals', 'global').legal_whatsapp, KNOWN.legalWhatsapp);
  assert.equal(target(desired, 'website_globals', 'global').data_whatsapp, KNOWN.dataWhatsapp);
  assert.deepEqual(target(desired, 'website_practices', 'es-data').problems[0], { label: copy.website_practices.es.data.problems[0] });
  assert.equal(target(desired, 'website_people', 'en-tatiana').name, 'Tatiana Rodríguez');
  const faq = desired.targets.filter(t => t.collection === 'website_faq');
  assert.equal(faq.length, 12);
  assert.ok(faq.every(t => ['legal', 'data', 'general'].includes(t.fields.area)));
  for (const key of ['hero_eyebrow', 'cases', 'privacy_email', 'form_error_email']) assert.ok(desired.ignored.some(i => i.endsWith(`/${key}`)), key);
  for (const t of desired.targets) for (const key of Object.keys(t.fields)) {
    assert.ok(websiteCollections.find(d => d.collection === t.collection).fields.some(f => f.key === key) || ['question', 'answer', 'area', 'title', 'description'].includes(key), `${t.collection}.${key}`);
  }
});

test('resolution leaves no PENDIENTE outside the privacy policy placeholder and invents nothing', async () => {
  const desired = await prepare(copy);
  assert.deepEqual(findPending(desired.targets), []);
  const json = JSON.stringify(desired.targets);
  assert.ok(!/PENDIENTE/.test(json.replaceAll(PENDING_MARK, '')));
  assert.equal(target(desired, 'website_people', 'es-tatiana').credential, '');
  assert.equal(target(desired, 'website_people', 'en-tatiana').linkedin_url, '');
  assert.equal(target(desired, 'website_people', 'es-henry').linkedin_url, 'https://linkedin.com/in/henrymarinho90/');
  assert.ok(!/ \[|años de/.test(target(desired, 'website_people', 'es-tatiana').bio.slice(-12)));
  const faq = desired.targets.filter(t => t.collection === 'website_faq');
  assert.match(faq.find(t => t.locale === 'es' && t.sort === 1).fields.answer, /^En la primera conversación entendemos tu caso\. Antes de iniciar/);
  assert.match(faq.find(t => t.locale === 'es' && t.sort === 3).fields.answer, /lo antes posible\.$/);
  assert.throws(() => { const bad = structuredClone(desired.targets); bad[0].fields.brand_name = '[PENDIENTE: x]'; if (findPending(bad).length) throw new Error('pending'); }, /pending/);
});

test('privacy policy: real data, only the agreed placeholder remains, processors/cookies/deadlines present', async () => {
  for (const locale of ['es', 'en']) {
    const policy = target(await prepare(copy), 'website_common', locale).privacy_policy;
    assert.ok(policy.includes(KNOWN.contactEmail) && policy.includes(KNOWN.legalEmail));
    assert.ok(policy.includes('Henry Mariño') && policy.includes('Tatiana Rodríguez'));
    assert.equal(policy.split(PENDING_MARK).length - 1, 3, 'cédula/NIT, dirección y teléfono');
    assert.ok(!/PENDIENTE/.test(policy.replaceAll(PENDING_MARK, '')));
    for (const word of ['Directus', 'Twenty', 'OVH', 'Google Analytics 4', 'WhatsApp', '10', '15', '14', locale === 'es' ? '6 de noviembre de 2026' : 'November 6, 2026']) assert.ok(policy.includes(word), word);
    assert.ok(policy.length < 50000);
  }
  assert.throws(() => buildPrivacyPolicy('## 1. x', 'es'), /10 secciones/);
});

test('dry-run is read-only; apply on memory converges and a second run has 0 changes', async () => {
  const dry = client(staleState());
  const report = await runLoadCopy(['--fixture', 'x'], { memoryState: staleState(), stdout: () => {} });
  assert.ok(report.changes > 0);
  assert.equal(dry.memory.requests.filter(r => r.method !== 'GET').length, 0);

  const applied = await runLoadCopy(['--fixture', 'x', '--apply'], { memoryState: staleState(), stdout: () => {} });
  assert.equal(applied.secondRun, 0);
  assert.equal(applied.deleteRequests, 0);
});

test('repeatable rows: matched by (locale, sort), missing ones created, extras kept with a warning', async () => {
  const desired = await prepare(copy);
  const state = staleState();
  state.items.website_faq.push({ id: 'extra', locale: 'es', status: 'published', sort: 99, area: 'general', question: 'q', answer: 'a' });
  const plan = planCopy(state.items, desired.targets);
  const created = plan.ops.filter(o => o.method === 'POST' && o.collection === 'website_faq');
  assert.equal(created.length, 4); // es#5, es#6, en#5, en#6
  assert.ok(created.every(o => o.body.status === 'published' && /^f4a90000-0000-4000-8000-/.test(o.body.id)));
  assert.ok(plan.warnings.some(w => w.includes('sobrante') && w.includes('extra')));
  assert.ok(!plan.ops.some(o => o.method === 'DELETE'));
});

test('website-defaults.json already equals the desired state (snapshot == CMS)', async () => {
  const desired = await prepare(copy);
  assert.deepEqual(applyToDefaults(defaults, desired.targets), defaults);
  const plan = planCopy(Object.fromEntries(Object.entries(defaults).filter(([k]) => k !== 'website_testimonials')), desired.targets);
  assert.equal(plan.ops.length, 0);
});
