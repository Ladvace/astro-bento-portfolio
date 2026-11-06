/**
 * Loads content/copy-v1.json into Directus (website_* collections) safely.
 *
 *   node scripts/load-copy.mjs                          # dry-run against DIRECTUS_URL (GETs only), field-by-field diff
 *   node scripts/load-copy.mjs --fixture FILE           # dry-run against a local JSON state ({collections, items})
 *   node scripts/load-copy.mjs --apply --backup-done    # REAL write (after a database backup)
 *   node scripts/load-copy.mjs --write-defaults         # also rewrite src/content/website-defaults.json with the same state
 *   add --json for a machine-readable report, --full to print every field diff
 *
 * Rules: copy keys are mapped to the real model; keys without a model field are ignored and listed;
 * unknown data ([PENDIENTE ...]) is rewritten neutrally; nothing is deleted; fixed rows keep their IDs;
 * repeatable rows (faq/steps) are matched by (locale, sort) and created when missing.
 * Secrets only from env (DIRECTUS_ADMIN_TOKEN); never printed.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { websiteCollections, validateContentPatch } from '../src/lib/website-model.mjs';
import { createClient } from './directus-schema.mjs';
import { createMemoryDirectus } from './directus-memory.mjs';
import { cmsBase } from './content.mjs';

const usage = 'Uso: load-copy.mjs [--fixture FILE] [--json] [--full] [--write-defaults] [--apply --backup-done]';
const copyPath = new URL('../content/copy-v1.json', import.meta.url);
const defaultsPath = new URL('../src/content/website-defaults.json', import.meta.url);

export const KNOWN = {
  legalWhatsapp: '+573160845842', dataWhatsapp: '+573138221975',
  contactEmail: 'henryiadatamarino@gmail.com', legalEmail: 'tatianaservicioslegales@gmail.com',
};
export const PENDING_MARK = '[Pendiente de completar]';
const MESSAGE_MAX = 1500; // src/lib/lead.mjs

// ---------------------------------------------------------------------------------------------
// Mapping copy key -> model field (per collection). Keys not listed (or listed as null) are ignored.
// ---------------------------------------------------------------------------------------------
const homeDirect = ['seo_title', 'seo_description', 'hero_title', 'hero_accent', 'hero_description', 'hero_territory', 'services_label', 'services_title',
  'team_label', 'team_title', 'team_description', 'publications_label', 'publications_title', 'archive_label', 'entry_label', 'entry_link_label',
  'contact_label', 'contact_title', 'contact_description', 'data_contact_label', 'legal_contact_label', 'contact_note', 'steps_title', 'faq_title'];
export const homeMap = {
  ...Object.fromEntries(homeDirect.map(k => [k, k])),
  hero_legal_label: 'hero_legal_cta', hero_data_label: 'hero_data_cta',
};
// website_common copy keys that live in the model's website_home record (form, thanks, consent, cookies).
export const commonToHomeMap = {
  form_title: 'form_title', form_name_label: 'form_name_label', form_area_label: 'form_area_label',
  form_area_legal: 'form_area_legal_option', form_area_data: 'form_area_data_option', form_message_label: 'form_message_label',
  form_phone_label: 'form_whatsapp_label', form_email_label: 'form_email_label', form_submit_label: 'form_submit_label',
  form_error_generic: 'form_error_message', form_message_help: 'form_message_hint', form_error_name: 'form_error_name',
  thanks_title: 'thanks_title', thanks_description_default: 'thanks_description', thanks_back_label: 'thanks_back_label',
  form_consent_label: 'consent_label', form_consent_link_label: 'consent_privacy_link_label',
  cookie_text: 'consent_banner_text', cookie_accept_label: 'consent_banner_accept_label', cookie_reject_label: 'consent_banner_reject_label',
  cookie_settings_label: 'consent_preferences_label',
};
export const commonMap = Object.fromEntries(['footer_tagline', 'footer_scope_label', 'footer_legal_scope', 'footer_data_scope', 'footer_disclaimer',
  'blog_title', 'blog_description', 'archive_note', 'article_contact_label', 'practice_process_note', 'practice_contact_label', 'privacy_title']
  .map(k => [k, k]));
commonMap.privacy_body = 'privacy_policy';
const practicesMap = Object.fromEntries(['card_label', 'card_title', 'card_description', 'card_items', 'card_link_label', 'territory', 'page_territory',
  'page_title', 'page_description', 'disclaimer', 'page_items', 'projects_link_label', 'problems', 'audience', 'whatsapp_message'].map(k => [k, k]));
const peopleMap = Object.fromEntries(['name', 'label', 'role', 'bio', 'credential', 'linkedin_label', 'linkedin_url'].map(k => [k, k]));
const globalsMap = { brand_name: 'brand_name', full_name: 'full_name', whatsapp_legal_number: 'legal_whatsapp', whatsapp_data_number: 'data_whatsapp', contact_email: 'contact_email' };

// ---------------------------------------------------------------------------------------------
// Resolution of unknown data
// ---------------------------------------------------------------------------------------------
const pendingRe = /\[PENDIENTE|PENDIENTE:/i;
const hasPending = value => typeof value === 'string' && pendingRe.test(value);
const sentenceRewrites = [
  // [regex over the whole string, replacement]
  [/\[PENDIENTE: indicar si la primera conversación[^\]]*\]\. En cualquier caso, antes de/, 'En la primera conversación entendemos tu caso. Antes de'],
  [/\[PENDIENTE: state whether the first conversation[^\]]*\]\. Either way, before/, 'In the first conversation we understand your case. Before'],
  [/ en \[PENDIENTE: tiempo de respuesta[^\]]*\]\./, ' lo antes posible.'],
  [/ within \[PENDIENTE: response time[^\]]*\]\./, ' as soon as possible.'],
  [/ en \[PENDIENTE: ciudad o ciudades\]\./, ' se coordina según el caso.'],
  [/ in \[PENDIENTE: city or cities\]\./, ' can be arranged depending on the case.'],
  [/ \[PENDIENTE: (?:años de ejercicio|años de experiencia|years in practice|years of experience)\]/, ''],
];
function rewriteText(value) {
  let out = value;
  for (const [re, to] of sentenceRewrites) out = out.replace(re, to);
  return out;
}
const resolveText = (key, value, rewritten, where) => {
  if (typeof value !== 'string' || !hasPending(value)) return value;
  if (key === 'credential' || key === 'linkedin_url') { rewritten.push({ where, from: value, to: '' }); return ''; }
  const out = rewriteText(value);
  rewritten.push({ where, from: value, to: out });
  return out;
};

// Privacy policy: keep copy-v1 text, fill real data, extend processors / cookies / procedure.
const policyText = {
  es: {
    updated: 'Última actualización: 6 de noviembre de 2026', effective: '6 de noviembre de 2026',
    s1: `## 1. Responsable del tratamiento

Los responsables del tratamiento son dos personas naturales, cada una respecto de los datos de su área:

- Henry Mariño (marketing digital, datos e IA): ${KNOWN.contactEmail}
- Tatiana Rodríguez (asesoría jurídica): ${KNOWN.legalEmail}

Cédula o NIT: ${PENDING_MARK}. Domicilio y dirección: ${PENDING_MARK}, Colombia. Teléfono: ${PENDING_MARK}.`,
    s5: `## 5. Encargados y transferencias

Para operar el sitio usamos proveedores que tratan datos por cuenta nuestra:

- **Directus** (gestión de contenidos y registro de solicitudes) y **Twenty** (CRM): autoalojados por nosotros en un servidor privado virtual (VPS) de OVH.
- **Google Analytics 4** (analítica): solo se activa si aceptas las cookies de medición. Implica una transferencia de datos a Estados Unidos, que ocurre únicamente con tu consentimiento.
- **WhatsApp (Meta)**: si nos escribes por WhatsApp, la conversación también se rige por los términos y la política de privacidad de WhatsApp y Meta.

Exigimos condiciones de seguridad y confidencialidad acordes con la ley colombiana.`,
    s7a: 'Escribe a henryiadatamarino@gmail.com (marketing, datos e IA) o a tatianaservicioslegales@gmail.com (asuntos jurídicos)',
    s9: `## 9. Cookies y analítica

El sitio funciona sin cookies de medición. Solo si aceptas en el banner activamos Google Analytics 4, que usa cookies o almacenamiento local para medir el uso del sitio de forma agregada. Puedes revocar tu decisión en cualquier momento desde «Preferencias de cookies», en el pie de página.`,
    s10a: 'el 6 de noviembre de 2026',
    law: [/en los términos de la Ley 1581 de 2012/, 'en los términos de los artículos 14 y 15 de la Ley 1581 de 2012'],
  },
  en: {
    updated: 'Last updated: November 6, 2026', effective: 'November 6, 2026',
    s1: `## 1. Data controller

The data controllers are two natural persons, each for the data of their own practice:

- Henry Mariño (digital marketing, data and AI): ${KNOWN.contactEmail}
- Tatiana Rodríguez (legal advice): ${KNOWN.legalEmail}

ID number or NIT: ${PENDING_MARK}. Address: ${PENDING_MARK}, Colombia. Phone: ${PENDING_MARK}.`,
    s5: `## 5. Processors and transfers

To run the site we use providers that process data on our behalf:

- **Directus** (content management and request log) and **Twenty** (CRM): self-hosted by us on an OVH virtual private server (VPS).
- **Google Analytics 4** (analytics): only enabled if you accept measurement cookies. It involves a transfer of data to the United States, which happens only with your consent.
- **WhatsApp (Meta)**: if you message us on WhatsApp, the conversation is also governed by the WhatsApp and Meta terms and privacy policy.

We require security and confidentiality conditions consistent with Colombian law.`,
    s7a: 'Email henryiadatamarino@gmail.com (marketing, data and AI) or tatianaservicioslegales@gmail.com (legal matters)',
    s9: `## 9. Cookies and analytics

The site works without measurement cookies. Only if you accept in the banner do we enable Google Analytics 4, which uses cookies or local storage to measure site usage in aggregate. You can revoke your choice at any time from "Cookie preferences" in the footer.`,
    s10a: 'November 6, 2026',
    law: [/extendable under Law 1581 of 2012/, 'extendable under articles 14 and 15 of Law 1581 of 2012'],
  },
};

export function buildPrivacyPolicy(body, locale) {
  const t = policyText[locale];
  const sections = body.split(/\n\n(?=## \d+\. )/);
  if (sections.length !== 10) throw new Error(`privacy_body (${locale}): se esperaban 10 secciones, hay ${sections.length}`);
  const s1Rest = sections[0].split('\n\n').slice(2).join('\n\n'); // paragraphs after the pending controller paragraph
  sections[0] = `${t.s1}${s1Rest ? `\n\n${s1Rest}` : ''}`;
  sections[4] = t.s5;
  sections[6] = sections[6].replace(/(?:Escribe a|Email) \[PENDIENTE: (?:correo|email)\]/, t.s7a).replace(...t.law);
  sections[8] = t.s9;
  sections[9] = sections[9].replace(/(?:desde|from) \[PENDIENTE: (?:fecha|date)\]/, m => `${m.split(' ')[0]} ${t.s10a}`);
  return `_${t.updated}_\n\n${sections.join('\n\n')}`;
}

// ---------------------------------------------------------------------------------------------
// Desired state (pure)
// ---------------------------------------------------------------------------------------------
/** @returns {{ targets: object[], ignored: string[], rewritten: object[] }} */
export function buildDesired(copy) {
  const targets = [];
  const ignored = [];
  const rewritten = [];
  const used = new Set();
  const take = (path, key, value, map, fields, where) => {
    const field = map[key];
    used.add(`${path}/${key}`);
    if (!field) { ignored.push(`${path}/${key}`); return; }
    fields[field] = resolveText(field, value, rewritten, where ?? `${path}/${key}`);
  };
  const fixed = (collection, id, fields) => targets.push({ collection, id, kind: 'fixed', fields });

  // globals (singleton): shared data + (language-neutral) brand names; per-locale keys have no singleton counterpart.
  {
    const fields = {};
    const shared = copy.website_globals.shared;
    for (const [key, value] of Object.entries(shared)) {
      const path = 'website_globals/shared';
      if (key === 'whatsapp_legal_number') { used.add(`${path}/${key}`); fields.legal_whatsapp = KNOWN.legalWhatsapp; rewritten.push({ where: `${path}/${key}`, from: value, to: KNOWN.legalWhatsapp }); }
      else if (key === 'whatsapp_data_number') { used.add(`${path}/${key}`); fields.data_whatsapp = KNOWN.dataWhatsapp; rewritten.push({ where: `${path}/${key}`, from: value, to: KNOWN.dataWhatsapp }); }
      else if (key === 'contact_email') { used.add(`${path}/${key}`); fields.contact_email = KNOWN.contactEmail; rewritten.push({ where: `${path}/${key}`, from: value, to: KNOWN.contactEmail }); }
      else take(path, key, value, globalsMap, fields);
    }
    for (const locale of ['es', 'en']) for (const key of Object.keys(copy.website_globals[locale])) { used.add(`website_globals/${locale}/${key}`); ignored.push(`website_globals/${locale}/${key}`); }
    fixed('website_globals', 'global', fields);
  }

  for (const locale of ['es', 'en']) {
    // home = home copy + form/thanks/consent keys that the model keeps in website_home
    const home = {};
    for (const [key, value] of Object.entries(copy.website_home[locale])) take(`website_home/${locale}`, key, value, homeMap, home);
    const commonCopy = copy.website_common[locale];
    const common = {};
    for (const [key, value] of Object.entries(commonCopy)) {
      const path = `website_common/${locale}`;
      if (key === 'privacy_body') { used.add(`${path}/${key}`); common.privacy_policy = buildPrivacyPolicy(value, locale); continue; }
      if (key === 'privacy_updated_label') { used.add(`${path}/${key}`); continue; } // merged into privacy_policy header
      if (Object.hasOwn(commonToHomeMap, key)) {
        used.add(`${path}/${key}`);
        let v = value;
        if (key === 'form_message_help') v = v.replaceAll('{max}', String(MESSAGE_MAX));
        home[commonToHomeMap[key]] = resolveText(commonToHomeMap[key], v, rewritten, `${path}/${key}`);
        continue;
      }
      take(path, key, value, commonMap, common);
    }
    fixed('website_home', locale, home);
    fixed('website_common', locale, common);

    for (const key of ['legal', 'data']) {
      const fields = {};
      for (const [k, v] of Object.entries(copy.website_practices[locale][key])) take(`website_practices/${locale}/${key}`, k, v, practicesMap, fields);
      for (const f of ['problems']) if (Array.isArray(fields[f])) fields[f] = fields[f].map(label => ({ label }));
      fixed('website_practices', `${locale}-${key}`, fields);
    }
    for (const key of ['tatiana', 'henry']) {
      const fields = {};
      for (const [k, v] of Object.entries(copy.website_people[locale][key])) take(`website_people/${locale}/${key}`, k, v, peopleMap, fields);
      fixed('website_people', `${locale}-${key}`, fields);
    }
    for (const [i, row] of copy.website_faq[locale].entries()) {
      const path = `website_faq/${locale}/${i}`;
      const fields = { question: row.question, answer: resolveText('answer', row.answer, rewritten, `${path}/answer`), area: row.area === 'all' ? 'general' : row.area };
      used.add(`${path}`);
      targets.push({ collection: 'website_faq', kind: 'row', locale, sort: row.sort, fields });
    }
    for (const [i, row] of copy.website_steps[locale].entries()) {
      used.add(`website_steps/${locale}/${i}`);
      targets.push({ collection: 'website_steps', kind: 'row', locale, sort: row.sort, fields: { title: row.title, description: resolveText('description', row.description, rewritten, `website_steps/${locale}/${i}/description`) } });
    }
  }
  // Keys in copy that were never visited (cases[] etc. are visited via take; this guards new sections).
  ignored.sort();
  return { targets, ignored: [...new Set(ignored)], rewritten };
}

// Deterministic IDs for repeatable rows created by this script (same scheme as the defaults snapshot).
const rowPrefix = { website_faq: 'f4a90000-0000-4000-8000-', website_steps: '57e90000-0000-4000-8000-' };
export const rowId = (collection, locale, sort) => `${rowPrefix[collection]}${String((locale === 'en' ? 100 : 0) + sort).padStart(12, '0')}`;

/** Forbidden leftovers: any PENDIENTE except PENDING_MARK inside privacy_policy. */
export function findPending(targets) {
  const bad = [];
  for (const t of targets) for (const [key, value] of Object.entries(t.fields)) {
    let s = typeof value === 'string' ? value : JSON.stringify(value);
    if (key === 'privacy_policy') s = s.replaceAll(PENDING_MARK, '');
    if (pendingRe.test(s)) bad.push(`${t.collection}/${t.id ?? `${t.locale}#${t.sort}`}.${key}`);
  }
  return bad;
}

export function validateTargets(targets) {
  for (const t of targets) {
    const definition = websiteCollections.find(d => d.collection === t.collection);
    const probeId = definition.records[0].id;
    try { validateContentPatch(definition.alias, t.kind === 'fixed' ? t.id : probeId, t.fields); }
    catch (error) { throw new Error(`${t.collection}/${t.id ?? `${t.locale}#${t.sort}`}: ${error.message} (${Object.keys(t.fields).join(',')})`); }
  }
}

// ---------------------------------------------------------------------------------------------
// Plan (pure): compare with current items
// ---------------------------------------------------------------------------------------------
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const short = (v, n = 60) => { if (v === null) return 'null'; const s = typeof v === 'string' ? v : JSON.stringify(v ?? null); const one = s.replace(/\s+/g, ' '); return JSON.stringify(one.length > n ? `${one.slice(0, n)}…` : one); };

export function planCopy(currentItems, targets) {
  const ops = [];
  const warnings = [];
  const matchedRows = {};
  for (const t of targets) {
    const rows = currentItems[t.collection] ?? [];
    if (t.kind === 'fixed') {
      const existing = rows.find(r => String(r.id) === String(t.id));
      const singleton = t.collection === 'website_globals';
      if (!existing) { warnings.push(`${t.collection}/${t.id}: no existe en el CMS; se omite (cree el registro con directus-schema.mjs --seed)`); continue; }
      const diffs = Object.entries(t.fields).filter(([k, v]) => !same(existing[k], v)).map(([k, v]) => ({ field: k, from: existing[k], to: v }));
      if (diffs.length) ops.push({ collection: t.collection, label: String(t.id), method: 'PATCH', path: singleton ? `items/${t.collection}` : `items/${t.collection}/${encodeURIComponent(t.id)}`, body: Object.fromEntries(diffs.map(d => [d.field, d.to])), diffs });
    } else {
      const existing = rows.find(r => r.locale === t.locale && Number(r.sort) === t.sort);
      if (existing) {
        (matchedRows[t.collection] ??= new Set()).add(String(existing.id));
        const diffs = Object.entries({ status: 'published', ...t.fields }).filter(([k, v]) => !same(existing[k], v)).map(([k, v]) => ({ field: k, from: existing[k], to: v }));
        if (diffs.length) ops.push({ collection: t.collection, label: `${t.locale}#${t.sort}`, method: 'PATCH', path: `items/${t.collection}/${encodeURIComponent(existing.id)}`, body: Object.fromEntries(diffs.map(d => [d.field, d.to])), diffs });
      } else {
        const body = { id: rowId(t.collection, t.locale, t.sort), locale: t.locale, status: 'published', sort: t.sort, ...t.fields };
        ops.push({ collection: t.collection, label: `${t.locale}#${t.sort} (nuevo)`, method: 'POST', path: `items/${t.collection}`, body, diffs: Object.entries(body).map(([field, to]) => ({ field, from: undefined, to })) });
        (matchedRows[t.collection] ??= new Set()).add(body.id);
      }
    }
  }
  for (const collection of Object.keys(rowPrefix)) {
    for (const row of currentItems[collection] ?? []) {
      if (!matchedRows[collection]?.has(String(row.id)) && ['es', 'en'].includes(row.locale)) warnings.push(`${collection}: fila sobrante ${row.locale}#${row.sort} (${row.id}) no está en copy-v1; no se borra`);
    }
  }
  return { ops, warnings };
}

export function formatPlan({ ops, warnings }, { full = false } = {}) {
  const lines = [];
  const byCollection = {};
  for (const op of ops) byCollection[op.collection] = (byCollection[op.collection] ?? 0) + 1;
  lines.push(`Cambios: ${ops.length} registro(s) — ${Object.entries(byCollection).map(([c, n]) => `${c}=${n}`).join(' ') || 'ninguno'}`);
  for (const op of ops) {
    lines.push(`  ${op.method} ${op.collection}/${op.label}: ${op.diffs.length} campo(s)`);
    for (const d of (full ? op.diffs : op.diffs.slice(0, 40))) lines.push(`    ${d.field}: ${d.from === undefined ? '∅' : short(d.from)} → ${short(d.to)}`);
  }
  for (const w of warnings) lines.push(`  ! ${w}`);
  return lines.join('\n');
}

// ---------------------------------------------------------------------------------------------
// Defaults snapshot
// ---------------------------------------------------------------------------------------------
export function applyToDefaults(defaults, targets) {
  const next = structuredClone(defaults);
  for (const t of targets) {
    const rows = next[t.collection];
    if (t.kind === 'fixed') {
      const row = rows.find(r => r.id === t.id);
      if (!row) throw new Error(`defaults sin ${t.collection}/${t.id}`);
      Object.assign(row, t.fields);
    } else {
      const row = rows.find(r => r.locale === t.locale && r.sort === t.sort);
      if (row) Object.assign(row, { status: 'published' }, t.fields);
      else rows.push({ id: rowId(t.collection, t.locale, t.sort), locale: t.locale, status: 'published', sort: t.sort, ...t.fields });
    }
  }
  for (const c of Object.keys(rowPrefix)) next[c].sort((a, b) => (a.locale === b.locale ? a.sort - b.sort : a.locale === 'es' ? -1 : 1));
  return next;
}

// ---------------------------------------------------------------------------------------------
// I/O
// ---------------------------------------------------------------------------------------------
export async function readItems(client) {
  const items = {};
  for (const definition of websiteCollections) {
    if (definition.alias === 'testimonials') continue;
    const data = await client.request('GET', `items/${definition.collection}?limit=-1&fields=*`);
    items[definition.collection] = definition.singleton ? (data ? [data] : []) : (data ?? []);
  }
  return items;
}

export async function prepare(copy) {
  const desired = buildDesired(copy);
  const bad = findPending(desired.targets);
  if (bad.length) throw new Error(`Quedan textos PENDIENTE sin resolver: ${bad.join(', ')}`);
  validateTargets(desired.targets);
  return desired;
}

export async function runLoadCopy(args, { env = process.env, fetcher = globalThis.fetch, stdout = line => console.log(line), memoryState } = {}) {
  const flags = new Set(args.filter(a => a.startsWith('--')));
  const fixtureIndex = args.indexOf('--fixture');
  const fixture = fixtureIndex >= 0 ? args[fixtureIndex + 1] : undefined;
  const known = new Set(['--apply', '--backup-done', '--fixture', '--json', '--full', '--write-defaults']);
  if ([...flags].some(f => !known.has(f)) || (fixtureIndex >= 0 && (!fixture || fixture.startsWith('--')))) throw new TypeError(usage);
  const apply = flags.has('--apply');
  const copy = JSON.parse(await readFile(copyPath, 'utf8'));
  const desired = await prepare(copy);

  let client;
  let memory;
  if (fixture || memoryState) {
    memory = createMemoryDirectus(memoryState ?? JSON.parse(await readFile(fixture, 'utf8')));
    client = createClient({ baseUrl: 'http://localhost:8055', fetcher: memory.fetcher });
  } else {
    const token = typeof env.DIRECTUS_ADMIN_TOKEN === 'string' ? env.DIRECTUS_ADMIN_TOKEN.trim() : '';
    if (!token) throw new TypeError('Se requiere DIRECTUS_ADMIN_TOKEN en el entorno (nunca en argumentos)');
    if (apply && !flags.has('--backup-done')) throw new TypeError('--apply real exige --backup-done tras un respaldo de la base');
    client = createClient({ baseUrl: cmsBase(env.DIRECTUS_URL ?? '', 'DIRECTUS_URL'), token, fetcher });
  }

  const plan = planCopy(await readItems(client), desired.targets);
  const report = {
    mode: apply ? (memory ? 'simulate' : 'apply') : 'dry-run', changes: plan.ops.length,
    byCollection: plan.ops.reduce((a, o) => ({ ...a, [o.collection]: (a[o.collection] ?? 0) + 1 }), {}),
    warnings: plan.warnings, ignored: desired.ignored, rewritten: desired.rewritten.length,
  };
  if (!flags.has('--json')) stdout(`Modo: ${report.mode}\n${formatPlan(plan, { full: flags.has('--full') })}\nClaves de copy ignoradas (sin campo en el modelo): ${desired.ignored.length}`);
  if (apply) {
    for (const op of plan.ops) {
      await client.request(op.method, op.path, op.body);
      if (!flags.has('--json')) stdout(`  ✓ ${op.method} ${op.collection}/${op.label}`);
    }
    report.secondRun = planCopy(await readItems(client), desired.targets).ops.length;
    if (!flags.has('--json')) stdout(`Segunda corrida: ${report.secondRun} cambio(s)`);
    if (memory) report.deleteRequests = memory.requests.filter(r => r.method === 'DELETE').length;
  }
  if (flags.has('--write-defaults')) {
    const current = JSON.parse(await readFile(defaultsPath, 'utf8'));
    await writeFile(defaultsPath, `${JSON.stringify(applyToDefaults(current, desired.targets), null, 2)}\n`);
    report.defaultsWritten = true;
    if (!flags.has('--json')) stdout('website-defaults.json actualizado');
  }
  if (flags.has('--json')) stdout(JSON.stringify(report, null, 2));
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runLoadCopy(process.argv.slice(2)).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
