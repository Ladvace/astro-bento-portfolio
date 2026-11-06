import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {
  splitName, parsePhone, normalizeEmail, buildLeadSync, personStep, opportunityStep, noteTargetsStep, recordFromResponse,
  sanitizeCrmError, pickRecipients, execCode, crmConfigFromEnv, defaultCrmConfig,
} from '../scripts/crm-mapping.mjs';

const config = crmConfigFromEnv({}, { notifyLegal: '11111111-1111-4111-8111-111111111111' });
const lead = (extra = {}) => ({
  id: '22222222-2222-4222-8222-222222222222', date_created: '2026-11-06T15:00:00.000Z', name: '  María  de los Ángeles Rodríguez Gómez ',
  area: 'legal', message: 'Necesito asesoría *urgente*\n<script>alert(1)</script>', contact_whatsapp: '+57 300 123 4567', contact_email: ' Maria@Example.COM ',
  locale: 'es', consent: true, page: '/es/#contacto', utm_source: 'google', utm_medium: 'cpc', utm_campaign: '', crm_status: 'pending',
  twenty_person_id: null, twenty_opportunity_id: null, ...extra,
});

test('splitName handles 1–4+ parts and Spanish particles', () => {
  assert.deepEqual(splitName('Henry'), { firstName: 'Henry', lastName: '' });
  assert.deepEqual(splitName('Henry Mariño'), { firstName: 'Henry', lastName: 'Mariño' });
  assert.deepEqual(splitName('Tatiana Rodríguez Pérez'), { firstName: 'Tatiana', lastName: 'Rodríguez Pérez' });
  assert.deepEqual(splitName('Juan Carlos Pérez Gómez'), { firstName: 'Juan Carlos', lastName: 'Pérez Gómez' });
  assert.deepEqual(splitName('  María  de los Ángeles Rodríguez Gómez '), { firstName: 'María de los Ángeles', lastName: 'Rodríguez Gómez' });
  assert.deepEqual(splitName('Ana del Valle'), { firstName: 'Ana', lastName: 'del Valle' });
  assert.deepEqual(splitName(''), { firstName: '', lastName: '' });
});

test('parsePhone recognises international, national CO and unknown numbers without inventing data', () => {
  const co = defaultCrmConfig.defaultPhoneCountry;
  assert.deepEqual(parsePhone('+57 300 123 4567', co), { number: '3001234567', countryCode: 'CO', callingCode: '+57' });
  assert.deepEqual(parsePhone('3001234567', co), { number: '3001234567', countryCode: 'CO', callingCode: '+57' });
  assert.deepEqual(parsePhone('573001234567', co), { number: '3001234567', countryCode: 'CO', callingCode: '+57' });
  assert.deepEqual(parsePhone('0034 612 345 678', co), { number: '612345678', countryCode: 'ES', callingCode: '+34' });
  assert.deepEqual(parsePhone('+593 99 123 4567', co), { number: '991234567', countryCode: 'EC', callingCode: '+593' });
  assert.deepEqual(parsePhone('+1 (305) 555-0100', co), { number: '3055550100', countryCode: 'US', callingCode: '+1' });
  assert.deepEqual(parsePhone('+888 1234 5678', co), { number: '88812345678', countryCode: '', callingCode: '' });
  assert.equal(parsePhone('12345', co), null);
  assert.equal(parsePhone('', co), null);
  assert.equal(normalizeEmail(' Ana@Ex.CO '), 'ana@ex.co');
  assert.equal(normalizeEmail('no-es-correo'), '');
});

test('buildLeadSync maps person, opportunity (configurable custom fields) and markdown note', () => {
  const sync = buildLeadSync(lead(), config);
  assert.equal(sync.area_label, 'Legal');
  assert.equal(decodeURIComponent(sync.person_search_path), '/rest/people?limit=1&filter=or(emails.primaryEmail[eq]:"maria@example.com",phones.primaryPhoneNumber[eq]:"3001234567")');
  assert.deepEqual(JSON.parse(sync.person_body), {
    name: { firstName: 'María de los Ángeles', lastName: 'Rodríguez Gómez' },
    emails: { primaryEmail: 'maria@example.com' },
    phones: { primaryPhoneNumber: '3001234567', primaryPhoneCountryCode: 'CO', primaryPhoneCallingCode: '+57' },
  });
  assert.deepEqual(sync.opportunity, { name: 'Web · Legal · María de los Ángeles Rodríguez Gómez', stage: 'NEW', area: 'LEGAL', source: 'WEB', locale: 'es' });
  const note = JSON.parse(sync.note_body);
  assert.equal(note.title, 'Lead web · Legal · María de los Ángeles Rodríguez Gómez');
  const md = note.bodyV2.markdown;
  assert.match(md, /^\*\*Lead web · Legal\*\* \(ES\)/);
  assert.match(md, /> Necesito asesoría \\\*urgente\\\*\n> \\<script\\>alert\(1\)\\<\/script\\>/);
  assert.match(md, /- \*\*Página:\*\* \/es\/\\#contacto/);
  assert.match(md, /- \*\*UTM:\*\* source=google · medium=cpc\n/);
  assert.match(md, /- \*\*Consentimiento:\*\* sí \(Ley 1581\/2012\)/);
  assert.match(md, /- \*\*Directus:\*\* https:\/\/cms\.romahomestore\.com\/admin\/content\/leads\/22222222-/);
  assert.ok(!md.includes('maria@example.com') && !md.includes('3001234567'), 'contact data lives on the person, not in the note');

  const data = buildLeadSync(lead({ area: 'data', locale: 'en', contact_email: '', contact_whatsapp: '' }), crmConfigFromEnv({ TWENTY_FIELD_AREA: 'practiceArea', TWENTY_FIELD_LOCALE: '-', TWENTY_AREA_VALUE_DATA: 'DATA_AI', TWENTY_OPPORTUNITY_STAGE: 'LEAD' }));
  assert.deepEqual(data.opportunity, { name: 'Web · Datos-IA · María de los Ángeles Rodríguez Gómez', stage: 'LEAD', practiceArea: 'DATA_AI', source: 'WEB' });
  assert.equal(data.has_identifiers, false);
  assert.match(decodeURIComponent(data.person_search_path), /filter=id\[eq\]:"00000000-0000-0000-0000-000000000000"$/);
  assert.deepEqual(Object.keys(JSON.parse(data.person_body)), ['name']);

  assert.throws(() => buildLeadSync(lead({ area: 'otro' }), config), /área/);
  assert.throws(() => buildLeadSync(lead({ name: '   ' }), config), /nombre/);
  assert.throws(() => buildLeadSync(null, config), /no encontrado/);
  assert.throws(() => crmConfigFromEnv({ TWENTY_FIELD_AREA: 'area;drop' }), /TWENTY_FIELD_AREA/);
  assert.throws(() => crmConfigFromEnv({ DIRECTUS_NOTIFY_DATA_USER: 'henry' }), /UUID/);
});

test('person/opportunity steps reuse existing records (idempotent retries) and validate ids', () => {
  const personId = '33333333-3333-4333-8333-333333333333';
  const sync = buildLeadSync(lead(), config);
  const empty = { status: 200, data: { data: { people: [] }, totalCount: 0 } };
  assert.deepEqual(personStep(sync, empty), { method: 'POST', path: '/rest/people', body: sync.person_body, reused: false });
  assert.deepEqual(personStep(sync, { status: 200, data: { data: { people: [{ id: personId }] } } }), { method: 'GET', path: `/rest/people/${personId}`, body: null, reused: true });
  const linked = buildLeadSync(lead({ twenty_person_id: personId, twenty_opportunity_id: '44444444-4444-4444-8444-444444444444' }), config);
  assert.equal(personStep(linked, empty).path, `/rest/people/${personId}`);
  assert.equal(personStep(buildLeadSync(lead({ twenty_person_id: '../../workspaces' }), config), empty).method, 'POST');

  const created = { status: 201, data: { data: { createPerson: { id: personId } } } };
  const opp = opportunityStep(sync, created);
  assert.equal(opp.method, 'POST');
  assert.equal(JSON.parse(opp.body).pointOfContactId, personId);
  assert.equal(opportunityStep(linked, { status: 200, data: { data: { person: { id: personId } } } }).path, '/rest/opportunities/44444444-4444-4444-8444-444444444444');
  assert.throws(() => opportunityStep(sync, { status: 200, data: { data: {} } }), /id de la persona/);
  assert.equal(recordFromResponse('{"data":{"createNote":{"id":"' + personId + '"}}}').id, personId);

  const targets = noteTargetsStep({ status: 201, data: { data: { createNote: { id: personId } } } }, 'p', 'o');
  assert.deepEqual(JSON.parse(targets.opportunity_body), { noteId: personId, opportunityId: 'o' });
  assert.deepEqual(JSON.parse(targets.person_body), { noteId: personId, personId: 'p' });
});

test('sanitizeCrmError keeps step + status, strips PII/secrets and caps at 500 chars', () => {
  const twenty400 = { status: 400, statusText: 'Bad Request', data: { statusCode: 400, error: 'BadRequestException', messages: ['Duplicate value "maria@example.com" for emails.primaryEmail, phone +57 300 123 4567'] } };
  const { message } = sanitizeCrmError(twenty400, 'ensure_person');
  assert.match(message, /^ensure_person: HTTP 400 — Duplicate value "…" for emails\.primaryEmail, phone \[número\]$/);
  assert.ok(!/maria|4567/.test(message));
  assert.equal(sanitizeCrmError(JSON.stringify({ status: 500, data: { message: 'boom' } }), 'find_person').message, 'find_person: HTTP 500 — boom');
  assert.equal(sanitizeCrmError({ name: 'TypeError', message: 'fetch failed' }, 'find_person').message, 'find_person: error — fetch failed');
  assert.equal(sanitizeCrmError({ message: 'Invalid header Bearer abc.def.ghi from x@y.co' }, 'find_person').message, 'find_person: error — Invalid header Bearer [oculto] from [correo]');
  assert.equal(sanitizeCrmError(undefined, 'bad step!').message, 'badstep: error');
  const long = sanitizeCrmError({ status: 502, data: 'x'.repeat(2000) }, 'create_note').message;
  assert.equal(long.length, 500);
  assert.ok(long.endsWith('…'));
});

test('pickRecipients routes by area and falls back to the other area', () => {
  assert.deepEqual(pickRecipients('legal', config), { area_label: 'Legal', users: ['11111111-1111-4111-8111-111111111111'] });
  assert.deepEqual(pickRecipients('data', config), { area_label: 'Datos-IA', users: ['11111111-1111-4111-8111-111111111111'] });
});

test('exec code is self-contained: runs in a bare V8 context (no fetch/URL/require) with identical output', async () => {
  const code = execCode('buildLeadSync(data.read_lead, CONFIG)', config);
  const context = vm.createContext({ module: { exports: {} } });
  assert.equal(vm.runInContext('typeof fetch + typeof require + typeof URL + typeof URLSearchParams', context), 'undefinedundefinedundefinedundefined');
  vm.runInContext(code, context);
  const result = await context.module.exports({ read_lead: lead() });
  assert.deepEqual(JSON.parse(JSON.stringify(result)), buildLeadSync(lead(), config));
  assert.ok(!code.includes("TWENTY_API_KEY") && !code.includes("$env"));
});
