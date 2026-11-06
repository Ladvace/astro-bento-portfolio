import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { resolveWebsiteContent } from '../src/lib/website-model.mjs';
const root = new URL('../', import.meta.url);
const read = (file) => readFileSync(new URL(file, root), 'utf8');
test('home composes the conversion sections and drops rail, signature, experience and pending notes', () => {
 const source = read('src/components/roma/Home.astro');
 for (const component of ['Hero', 'Services', 'Steps', 'Team', 'Cases', 'Testimonials', 'Faq', 'ContactForm']) {
  assert.ok(existsSync(new URL(`src/components/roma/${component}.astro`, root)), `${component} exists`);
  assert.match(source, new RegExp(`<${component} `));
 }
 assert.doesNotMatch(source, /section-rail|hero-signature|signature_|experience|original_note|contact_note|rail_/);
});
test('team shows a Directus photo when present, initials otherwise, and both LinkedIn links', () => {
 const team = read('src/components/roma/Team.astro');
 assert.match(team, /personPhoto\(person\)/);
 assert.match(team, /initials\(person\.name\)/);
 assert.match(team, /person\.linkedin_url/);
 assert.match(team, /data-professional=\{key\}/);
 for (const locale of ['es', 'en']) {
  const { people } = resolveWebsiteContent({}, locale);
  assert.equal(people.tatiana.name, 'Tatiana Rodriguez');
  assert.equal(people.henry.name, 'Henry Mariño');
 }
});
test('service cards keep area ownership, scope and a WhatsApp CTA tracked per location', () => {
 const source = read('src/components/roma/Services.astro');
 assert.match(source, /area: 'legal', person: people\.tatiana/);
 assert.match(source, /area: 'data', person: people\.henry/);
 assert.match(source, /practice\.territory/);
 assert.match(source, /\/servicios\/\$\{area\}\//);
 assert.match(source, /data-location="services"/);
});
test('every CTA carries tracking attributes and the lead form posts to /api/lead with a honeypot', () => {
 for (const file of ['Hero', 'Services', 'WhatsAppFab']) assert.match(read(`src/components/roma/${file}.astro`), /data-track=/);
 const form = read('src/components/roma/ContactForm.astro');
 assert.match(form, /method="post" action="\/api\/lead"/);
 assert.match(form, /data-track-form/);
 for (const name of ['name', 'area', 'message', 'contact_whatsapp', 'contact_email', 'consent', 'website', 'locale', 'page', 'started_at', 'utm_source', 'utm_medium', 'utm_campaign', 'posthog_distinct_id']) assert.match(form, new RegExp(`name="${name}"`), name);
 assert.match(form, /maxlength="1500"/);
 assert.match(form, /name="website" tabindex="-1" autocomplete="off"/);
 assert.match(read('src/components/roma/ConsentBanner.astro'), /roma_consent[\s\S]*roma:consent/);
});
test('shared shell exposes language alternatives, canonical, skip link and noindex preview switch', () => {
 const path = new URL('src/layouts/RomaLayout.astro', root);
 assert.equal(existsSync(path), true, 'ROMA shell must exist');
 const source = readFileSync(path, 'utf8');
 for (const token of ['hreflang','canonical','main-content','PUBLIC_NOINDEX','data-locale','roma_locale','Escape']) assert.ok(source.includes(token), token);
 assert.doesNotMatch(source, /datePublished:\s*new Date|Gianmarco|Henry Marinho/);
});
