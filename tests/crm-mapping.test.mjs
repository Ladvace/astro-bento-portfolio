import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {
  splitName, parsePhone, normalizeEmail, buildLeadSync, personStep, opportunityStep, noteStep, noteSaved, noteTargetsStep, recordFromResponse,
  sanitizeCrmError, pickRecipients, execCode, crmConfigFromEnv, defaultCrmConfig, personPreexisting, VERIFY_NOTE_LINE,
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
  assert.equal(sync.note_title, 'Lead web · Legal · María de los Ángeles Rodríguez Gómez');
  assert.equal(sync.received_at, '2026-11-06T15:00:00.000Z');
  const md = sync.note_markdown;
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

  assert.throws(() => buildLeadSync(lead({ area: 'otro' }), config), /^Error: LEAD_INVALID_AREA$/);
  assert.throws(() => buildLeadSync(lead({ name: '   ' }), config), /^Error: LEAD_NO_NAME$/);
  assert.throws(() => buildLeadSync(null, config), /^Error: LEAD_NOT_FOUND$/);
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

  const created = { status: 201, data: { data: { createPerson: { id: personId, createdAt: '2026-11-06T15:00:05.000Z' } } } };
  const opp = opportunityStep(sync, created, { reused: false });
  assert.equal(opp.method, 'POST');
  assert.equal(opp.verify, false);
  assert.equal(JSON.parse(opp.body).pointOfContactId, personId);
  assert.equal(JSON.parse(opp.body).name, 'Web · Legal · María de los Ángeles Rodríguez Gómez');
  assert.equal(opportunityStep(linked, { status: 200, data: { data: { person: { id: personId } } } }).path, '/rest/opportunities/44444444-4444-4444-8444-444444444444');
  assert.throws(() => opportunityStep(sync, { status: 200, data: { data: {} } }), /^Error: TWENTY_NO_PERSON_ID$/);
  assert.equal(recordFromResponse('{"data":{"createNote":{"id":"' + personId + '"}}}').id, personId);
});

test('M5: a pre-existing person flags the opportunity and the note; our own person on retry does not', () => {
  const personId = '33333333-3333-4333-8333-333333333333';
  const sync = buildLeadSync(lead(), config);
  const found = createdAt => ({ status: 200, data: { data: { person: { id: personId, createdAt } } } });
  const old = opportunityStep(sync, found('2024-01-01T00:00:00.000Z'), { reused: true });
  assert.equal(old.verify, true);
  assert.equal(JSON.parse(old.body).name, '[Verificar] Web · Legal · María de los Ángeles Rodríguez Gómez');
  const note = JSON.parse(noteStep(sync, old).body);
  assert.equal(note.bodyV2.markdown.split('\n')[0], '**' + VERIFY_NOTE_LINE + '.**');
  assert.equal(VERIFY_NOTE_LINE, 'Contacto coincidió con persona existente: verificar identidad antes de compartir información');
  // Matched by search a person created after the lead but not linked to it (another lead's): still flagged.
  assert.equal(opportunityStep(sync, found('2026-11-06T16:00:00.000Z'), { reused: true }).verify, true);
  // Retry: the person this lead created (linked via twenty_person_id, newer than the lead) is not flagged.
  const retried = buildLeadSync(lead({ twenty_person_id: personId }), config);
  assert.equal(opportunityStep(retried, found('2026-11-06T15:00:05.000Z'), { reused: true }).verify, false);
  // Retry of a lead that matched a pre-existing person keeps the flag.
  assert.equal(opportunityStep(retried, found('2024-01-01T00:00:00.000Z'), { reused: true }).verify, true);
  assert.equal(personPreexisting({ id: personId }, '2026-11-06T15:00:00.000Z'), true, 'unknown createdAt is conservative');
  assert.equal(noteStep(sync, { verify: false }).method, 'POST');
  assert.ok(!JSON.parse(noteStep(sync, { verify: false }).body).bodyV2.markdown.includes('Verificar'));
});

test('B2: note and its links are reused on retries (twenty_note_id + existing noteTargets)', () => {
  const noteId = '55555555-5555-4555-8555-555555555555';
  const withNote = buildLeadSync(lead({ twenty_note_id: noteId }), config);
  assert.deepEqual(noteStep(withNote, { verify: false }), { method: 'GET', path: `/rest/notes/${noteId}`, body: null, reused: true });
  assert.equal(buildLeadSync(lead({ twenty_note_id: 'x/../../y' }), config).existing_note_id, '');
  const saved = noteSaved({ status: 201, data: { data: { createNote: { id: noteId } } } });
  assert.equal(saved.id, noteId);
  assert.equal(decodeURIComponent(saved.targets_path), `/rest/noteTargets?limit=20&filter=noteId[eq]:"${noteId}"`);
  assert.throws(() => noteSaved({ status: 201, data: {} }), /^Error: TWENTY_NO_NOTE_ID$/);
  const p = '33333333-3333-4333-8333-333333333333';
  const o = '44444444-4444-4444-8444-444444444444';
  const fresh = noteTargetsStep(noteId, { status: 200, data: { data: { noteTargets: [] } } }, p, o);
  assert.equal(fresh.opportunity_method, 'POST');
  assert.deepEqual(JSON.parse(fresh.opportunity_body), { noteId, opportunityId: o });
  assert.deepEqual(JSON.parse(fresh.person_body), { noteId, personId: p });
  const linkId = '66666666-6666-4666-8666-666666666666';
  const half = noteTargetsStep(noteId, { status: 200, data: { data: { noteTargets: [{ id: linkId, noteId, opportunityId: o, personId: null }] } } }, p, o);
  assert.equal(half.opportunity_method, 'GET');
  assert.equal(half.opportunity_path, `/rest/noteTargets/${linkId}`);
  assert.equal(half.person_method, 'POST');
});

test('B1: sanitizeCrmError keeps only step + HTTP status + error code/type, never free text', () => {
  const twenty400 = { status: 400, statusText: 'Bad Request', data: { statusCode: 400, error: 'BadRequestException', messages: ['Duplicate value "maria@example.com" for emails.primaryEmail, phone +57 300 123 4567'] } };
  assert.equal(sanitizeCrmError(twenty400, 'ensure_person').message, 'ensure_person: HTTP 400 BadRequestException');
  assert.equal(sanitizeCrmError(JSON.stringify({ status: 500, data: { message: 'boom for Ana Pérez' } }), 'find_person').message, 'find_person: HTTP 500');
  assert.equal(sanitizeCrmError({ name: 'TypeError', message: 'fetch failed' }, 'find_person').message, 'find_person: error TypeError');
  assert.equal(sanitizeCrmError({ name: 'Error', message: 'connect ECONNREFUSED 10.0.0.5:3000', code: 'ECONNREFUSED' }, 'find_person').message, 'find_person: error ECONNREFUSED');
  assert.equal(sanitizeCrmError({ message: 'Invalid header Bearer abc.def.ghi from x@y.co' }, 'find_person').message, 'find_person: error');
  assert.equal(sanitizeCrmError({ name: 'Error', message: 'TWENTY_NO_NOTE_ID' }, 'note').message, 'note: error TWENTY_NO_NOTE_ID');
  assert.equal(sanitizeCrmError({ status: 403, data: { errors: [{ message: 'You do not have permission to ana@x.co', extensions: { code: 'FORBIDDEN' } }] } }, 'save_opp').message, 'save_opp: HTTP 403 FORBIDDEN');
  assert.equal(sanitizeCrmError({ status: 400, data: { error: 'AnaPerez' } }, 'ensure_opp').message, 'ensure_opp: HTTP 400', 'identifier-like words that are not codes are dropped');
  assert.equal(sanitizeCrmError('plain text with ana@example.com', 'x').message, 'x: error');
  assert.equal(sanitizeCrmError(undefined, 'bad step!').message, 'badstep: error');
  const long = sanitizeCrmError({ status: 502, data: 'x'.repeat(2000) }, 'create_note').message;
  assert.equal(long, 'create_note: HTTP 502');
  for (const sample of [twenty400, { message: 'secret eyJa.b.c' }, { status: 500, data: { messages: ['3001234567'] } }]) {
    assert.match(sanitizeCrmError(sample, 'step').message, /^step: (HTTP \d{3}|error)( [A-Za-z0-9_]+)?$/);
  }
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
