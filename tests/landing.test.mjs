import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { areaContact, consentParts, contactEmailHref, hasWhatsapp, initials } from '../src/lib/landing.mjs';
import { renderMarkdown } from '../src/lib/rich-text.mjs';
import { resolveWebsiteContent, whatsappHref } from '../src/lib/website-model.mjs';

test('areaContact links to the area WhatsApp with its prefilled message', () => {
 const site = resolveWebsiteContent({ website_globals: [{ id: 'global', status: 'published', legal_whatsapp: '+573001234567' }] }, 'es');
 const legal = areaContact(site, 'legal');
 assert.equal(legal.href, whatsappHref('+573001234567', site.practices.legal.whatsapp_message));
 assert.equal(legal.track, 'whatsapp_click');
 assert.equal(hasWhatsapp(site), true);
});

test('without WhatsApp numbers the CTA falls back to the contact anchor and Home renders nothing broken', () => {
 const site = resolveWebsiteContent({}, 'es');
 assert.equal(site.globals.legal_whatsapp, '');
 assert.deepEqual(areaContact(site, 'legal'), { href: '#contacto', whatsapp: false, track: 'cta_click' });
 assert.equal(areaContact(site, 'data', '/es/#contacto').href, '/es/#contacto');
 assert.equal(hasWhatsapp(site), false);
 // Optional blocks are template-guarded: empty testimonials/steps/faq/projects hide their section.
 const read = (name) => readFileSync(new URL(`../src/components/roma/${name}.astro`, import.meta.url), 'utf8');
 assert.match(read('Testimonials'), /testimonials\.length > 0/);
 assert.match(read('Faq'), /faq\.length > 0/);
 assert.match(read('Steps'), /steps\.length > 0/);
 assert.match(read('WhatsAppFab'), /hasWhatsapp\(site\) &&/);
});

test('contact email, initials and consent sentence helpers', () => {
 assert.equal(contactEmailHref({ globals: { contact_email: 'a@b.co' } }), 'mailto:a@b.co');
 assert.equal(contactEmailHref({ globals: { contact_email: '' } }), '');
 assert.equal(initials('Tatiana Rodríguez'), 'TR');
 assert.deepEqual(consentParts('Acepto la política de privacidad.', 'Política de privacidad'), { before: 'Acepto la ', link: 'política de privacidad', after: '.' });
 assert.deepEqual(consentParts('Acepto {privacy_link}.', 'Privacidad'), { before: 'Acepto ', link: 'Privacidad', after: '.' });
 assert.equal(consentParts('Acepto.', 'Privacidad').link, 'Privacidad');
});

test('renderMarkdown renders headings, lists and links and never lets markup through', () => {
 const html = renderMarkdown('## Título\n\nTexto **fuerte** y [enlace](https://example.com).\n\n- uno\n- dos\n\n<script>alert(1)</script> <img src=x onerror=alert(1)>');
 assert.match(html, /<h2>Título<\/h2>/);
 assert.match(html, /<strong>fuerte<\/strong>/);
 assert.match(html, /<ul><li>uno<\/li><li>dos<\/li><\/ul>/);
 assert.match(html, /href="https:\/\/example.com"/);
 assert.doesNotMatch(html, /<script|<img/);
 assert.doesNotMatch(renderMarkdown('[x](javascript:alert(1))'), /javascript:/);
 assert.equal(renderMarkdown(''), '');
});

test('thanks and privacy pages exist, are localized and the thanks page is noindex', () => {
 const root = new URL('../', import.meta.url);
 const thanks = readFileSync(new URL('src/pages/[locale]/gracias.astro', root), 'utf8');
 const privacy = readFileSync(new URL('src/pages/[locale]/privacidad.astro', root), 'utf8');
 assert.match(thanks, /noindex/);
 assert.match(thanks, /home\.thanks_title/);
 assert.match(privacy, /renderMarkdown\(common\.privacy_policy\)/);
});
