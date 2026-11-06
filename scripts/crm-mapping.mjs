/**
 * Lead → Twenty mapping, as pure functions.
 *
 * Every function in TOOLKIT is self-contained ECMAScript (no imports, no closures over module
 * scope, no Node/Web APIs such as URL, URLSearchParams, fetch or Buffer): its source is embedded
 * verbatim in the Directus "Run Script" (exec) operations, which run inside isolated-vm without
 * network or modules. The same functions are imported by the tests, so what is tested is exactly
 * what runs in the Flow.
 *
 * Network calls are NOT made here: the Flow's "request" operations do them, using the paths and
 * bodies these functions return. Bodies are returned as JSON strings so that the request operation
 * sends them verbatim regardless of how Directus serialises option values.
 */

export function cleanText(value, max) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').replace(/\r\n?/g, '\n').trim().slice(0, max);
}

/** Backslash-escapes Markdown/HTML punctuation so lead text renders literally in Twenty. */
export function mdEscape(value) {
  return String(value).replace(/([\\`*_[\]<>#|~])/g, '\\$1');
}

export function normalizeEmail(value) {
  const email = cleanText(value, 254).toLowerCase();
  return /^[^\s@"<>(),;:\\[\]]+@[^\s@"<>(),;:\\[\]]+\.[^\s@"<>(),;:\\[\]]+$/.test(email) ? email : '';
}

/**
 * Parses a free-form WhatsApp number. International numbers (+CC or 00CC) are matched against a
 * short table of calling codes (longest prefix wins); national 10-digit numbers get the default
 * country. Unknown prefixes keep all digits with no country, so nothing is invented.
 */
export function parsePhone(value, defaultCountry) {
  const text = cleanText(value, 40);
  const international = /^\s*(\+|00)/.test(text);
  let digits = text.replace(/\D/g, '');
  if (international && text.trim().startsWith('00')) digits = digits.slice(2);
  if (digits.length < 7 || digits.length > 15) return null;
  const codes = {
    1: 'US', 7: 'RU', 31: 'NL', 33: 'FR', 34: 'ES', 39: 'IT', 41: 'CH', 44: 'GB', 49: 'DE', 51: 'PE', 52: 'MX', 54: 'AR', 55: 'BR', 56: 'CL', 57: 'CO', 58: 'VE',
    351: 'PT', 502: 'GT', 503: 'SV', 504: 'HN', 505: 'NI', 506: 'CR', 507: 'PA', 591: 'BO', 593: 'EC', 595: 'PY', 598: 'UY',
  };
  const fallback = defaultCountry && defaultCountry.countryCode ? defaultCountry : null;
  if (international) {
    for (const size of [3, 2, 1]) {
      const prefix = digits.slice(0, size);
      if (codes[prefix] && digits.length - size >= 6) return { number: digits.slice(size), countryCode: codes[prefix], callingCode: '+' + prefix };
    }
    return { number: digits, countryCode: '', callingCode: '' };
  }
  if (fallback) {
    const calling = String(fallback.callingCode || '').replace(/\D/g, '');
    if (calling && digits.startsWith(calling) && digits.length === calling.length + 10) return { number: digits.slice(calling.length), countryCode: fallback.countryCode, callingCode: '+' + calling };
    if (digits.length === 10) return { number: digits, countryCode: fallback.countryCode, callingCode: '+' + calling };
  }
  return { number: digits, countryCode: '', callingCode: '' };
}

/**
 * Splits a Spanish-style full name. Particles (de, del, la, ...) stick to the following word.
 * 1 part → first only; 2 → first + last; 3 → first + two surnames; 4+ → the last two parts are
 * the surnames. Three-part names are ambiguous ("Ana María Pérez"): the CRM record stays
 * editable and the full name is always kept in the opportunity name.
 */
export function splitName(fullName) {
  const tokens = cleanText(fullName, 120).split(/\s+/).filter(Boolean);
  if (!tokens.length) return { firstName: '', lastName: '' };
  const particles = ['de', 'del', 'la', 'las', 'los', 'da', 'das', 'do', 'dos', 'van', 'von', 'di'];
  const groups = [];
  let pending = [];
  for (const token of tokens) {
    pending.push(token);
    if (!particles.includes(token.toLowerCase())) { groups.push(pending.join(' ')); pending = []; }
  }
  if (pending.length) {
    if (groups.length) groups[groups.length - 1] += ' ' + pending.join(' ');
    else groups.push(pending.join(' '));
  }
  if (groups.length === 1) return { firstName: groups[0], lastName: '' };
  if (groups.length === 2) return { firstName: groups[0], lastName: groups[1] };
  if (groups.length === 3) return { firstName: groups[0], lastName: groups[1] + ' ' + groups[2] };
  return { firstName: groups.slice(0, -2).join(' '), lastName: groups.slice(-2).join(' ') };
}

export function isRecordId(value) {
  return typeof value === 'string' && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value);
}

/** Twenty filter value: double-quoted; quotes/backslashes/parentheses/commas are never needed in emails or digits. */
export function twentyQuote(value) {
  return '"' + String(value).replace(/["\\(),]/g, '') + '"';
}

/**
 * Builds everything the Flow needs from a lead row (read with item-read). Throws on leads that
 * cannot be mapped; the Flow turns that into crm_status=error.
 */
export function buildLeadSync(lead, config) {
  if (!lead || typeof lead !== 'object') throw new Error('lead no encontrado');
  const area = lead.area === 'legal' || lead.area === 'data' ? lead.area : '';
  if (!area) throw new Error('área del lead inválida');
  const fullName = cleanText(lead.name, 120).replace(/\s+/g, ' ');
  if (!fullName) throw new Error('lead sin nombre');
  const areaLabel = config.areaLabels[area];
  const locale = lead.locale === 'en' ? 'en' : 'es';
  const email = normalizeEmail(lead.contact_email);
  const phone = parsePhone(lead.contact_whatsapp, config.defaultPhoneCountry);

  // Person lookup: email first, then phone digits. Without identifiers the filter matches nothing.
  const clauses = [];
  if (email) clauses.push('emails.primaryEmail[eq]:' + twentyQuote(email));
  if (phone) clauses.push('phones.primaryPhoneNumber[eq]:' + twentyQuote(phone.number));
  const filter = clauses.length === 0 ? 'id[eq]:' + twentyQuote('00000000-0000-0000-0000-000000000000')
    : clauses.length === 1 ? clauses[0] : 'or(' + clauses.join(',') + ')';

  const person = { name: splitName(fullName) };
  if (email) person.emails = { primaryEmail: email };
  if (phone) {
    person.phones = { primaryPhoneNumber: phone.number };
    if (phone.countryCode) person.phones.primaryPhoneCountryCode = phone.countryCode;
    if (phone.callingCode && config.sendCallingCode) person.phones.primaryPhoneCallingCode = phone.callingCode;
  }

  const opportunity = { name: ('Web · ' + areaLabel + ' · ' + fullName).slice(0, 200) };
  if (config.stage) opportunity.stage = config.stage;
  const fields = config.opportunityFields;
  if (fields.area) opportunity[fields.area] = config.areaValues[area];
  if (fields.source) opportunity[fields.source] = config.sourceValue;
  if (fields.locale) opportunity[fields.locale] = locale;

  const line = (label, value) => (value ? '- **' + label + ':** ' + mdEscape(value) : '');
  const message = cleanText(lead.message, 5000);
  const utm = ['utm_source', 'utm_medium', 'utm_campaign']
    .map(key => (cleanText(lead[key], 255) ? key.slice(4) + '=' + cleanText(lead[key], 255) : ''))
    .filter(Boolean).join(' · ');
  const id = isRecordId(lead.id) ? lead.id : '';
  const markdown = [
    '**Lead web · ' + areaLabel + '** (' + locale.toUpperCase() + ')',
    '',
    message ? message.split('\n').map(text => '> ' + mdEscape(text)).join('\n') : '_Sin mensaje._',
    '',
    [
      line('Página', cleanText(lead.page, 2048)),
      line('UTM', utm),
      line('GA4 client_id', /^[A-Za-z0-9.]{1,64}$/.test(String(lead.ga_client_id ?? '')) ? lead.ga_client_id : ''),
      line('Idioma', locale),
      line('Consentimiento', lead.consent === true ? 'sí (Ley 1581/2012)' : 'no registrado'),
      line('Recibido', cleanText(lead.date_created, 40)),
      id && config.directusAdminUrl ? '- **Directus:** ' + config.directusAdminUrl + '/admin/content/leads/' + id : '',
    ].filter(Boolean).join('\n'),
  ].join('\n');
  const note = { title: ('Lead web · ' + areaLabel + ' · ' + fullName).slice(0, 200), bodyV2: { markdown } };

  return {
    area,
    area_label: areaLabel,
    has_identifiers: clauses.length > 0,
    person_search_path: '/rest/people?limit=1&filter=' + encodeURIComponent(filter),
    person_body: JSON.stringify(person),
    opportunity: opportunity,
    note_body: JSON.stringify(note),
    existing_person_id: isRecordId(lead.twenty_person_id) ? lead.twenty_person_id : '',
    existing_opportunity_id: isRecordId(lead.twenty_opportunity_id) ? lead.twenty_opportunity_id : '',
  };
}

/** Request-operation result ({status, data}) or raw Twenty body → first record with an id. */
export function recordFromResponse(result) {
  let body = result;
  if (body && typeof body === 'object' && 'status' in body && 'data' in body) body = body.data;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { return null; } }
  const inner = body && typeof body === 'object' && body.data !== undefined ? body.data : body;
  if (!inner || typeof inner !== 'object') return null;
  if (typeof inner.id === 'string') return inner;
  for (const value of Object.values(inner)) {
    if (Array.isArray(value)) return value.length && value[0] && typeof value[0].id === 'string' ? value[0] : null;
    if (value && typeof value === 'object' && typeof value.id === 'string') return value;
  }
  return null;
}

function requestFor(objectPath, existingId, body) {
  return existingId
    ? { method: 'GET', path: '/rest/' + objectPath + '/' + existingId, body: null, reused: true }
    : { method: 'POST', path: '/rest/' + objectPath, body: body, reused: false };
}

/** Reuse the person found by email/phone (or already linked to the lead); otherwise create it. */
export function personStep(sync, searchResult) {
  const found = recordFromResponse(searchResult);
  const id = found && isRecordId(found.id) ? found.id : sync.existing_person_id;
  return requestFor('people', id, sync.person_body);
}

/** Needs the person id; reuses an opportunity already linked to the lead (retries), else creates one. */
export function opportunityStep(sync, personResult) {
  const person = recordFromResponse(personResult);
  if (!person || !isRecordId(person.id)) throw new Error('Twenty no devolvió el id de la persona');
  const body = Object.assign({}, sync.opportunity, { pointOfContactId: person.id });
  return Object.assign({ person_id: person.id }, requestFor('opportunities', sync.existing_opportunity_id, JSON.stringify(body)));
}

export function recordId(result, label) {
  const record = recordFromResponse(result);
  if (!record || !isRecordId(record.id)) throw new Error('Twenty no devolvió el id de ' + label);
  return { id: record.id };
}

export function noteTargetsStep(noteResult, personId, opportunityId) {
  const note = recordId(noteResult, 'la nota');
  return {
    note_id: note.id,
    opportunity_body: JSON.stringify({ noteId: note.id, opportunityId: opportunityId }),
    person_body: JSON.stringify({ noteId: note.id, personId: personId }),
  };
}

/**
 * Turns whatever a failed operation left in $last (request error object, JSON string, Error-like
 * {message}, plain string) into a short, PII-free message: step + HTTP status + redacted detail.
 */
export function sanitizeCrmError(error, step) {
  let value = error;
  let status = null;
  let detail = '';
  if (typeof value === 'string') {
    try { value = JSON.parse(value); } catch (e) { detail = value; value = null; }
  }
  if (value && typeof value === 'object') {
    const response = value.response && typeof value.response === 'object' ? value.response : value;
    if (typeof response.status === 'number') status = response.status;
    else if (typeof response.statusCode === 'number') status = response.statusCode;
    let data = response.data;
    if (typeof data === 'string') { try { data = JSON.parse(data); } catch (e) { /* keep text */ } }
    let message = '';
    if (data && typeof data === 'object') {
      if (Array.isArray(data.messages) && data.messages.length) message = data.messages[0];
      else if (Array.isArray(data.errors) && data.errors.length) message = data.errors[0] && data.errors[0].message;
      else message = data.message || data.error || '';
    } else if (typeof data === 'string') message = data;
    detail = String(message || value.message || value.code || response.statusText || '');
  }
  detail = detail
    .replace(/Bearer\s+[^\s"']+/gi, 'Bearer [oculto]')
    .replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, '[token]')
    .replace(/[^\s@"'<>]+@[^\s@"'<>]+/g, '[correo]')
    .replace(/"[^"]{1,300}"|'[^']{1,300}'/g, '"…"')
    .replace(/\+?\d[\d\s().-]{5,}\d/g, '[número]')
    .replace(/\s+/g, ' ')
    .trim();
  const safeStep = String(step || 'crm').replace(/[^a-z_]/g, '').slice(0, 40) || 'crm';
  const text = safeStep + ': ' + (status ? 'HTTP ' + status : 'error') + (detail ? ' — ' + detail : '');
  return { message: text.length > 500 ? text.slice(0, 499) + '…' : text };
}

/** Directus users to notify for a lead area. Falls back to the other area's users if one is empty. */
export function pickRecipients(area, config) {
  const key = area === 'legal' || area === 'data' ? area : 'data';
  const own = config.notify[key] || [];
  const other = config.notify[key === 'legal' ? 'data' : 'legal'] || [];
  return { area_label: config.areaLabels[key], users: own.length ? own : other };
}

export const TOOLKIT = [
  cleanText, mdEscape, normalizeEmail, parsePhone, splitName, isRecordId, twentyQuote, buildLeadSync,
  recordFromResponse, requestFor, personStep, opportunityStep, recordId, noteTargetsStep, sanitizeCrmError, pickRecipients,
];

/** Source of a Directus "Run Script" operation that evaluates `expression` with the toolkit and CONFIG in scope. */
export function execCode(expression, config) {
  return [
    '// Generado por scripts/directus-flows.mjs (scripts/crm-mapping.mjs). No editar aquí: se sobrescribe.',
    `const CONFIG = ${JSON.stringify(config)};`,
    ...TOOLKIT.map(fn => fn.toString()),
    'module.exports = async function (data) {',
    `  return ${expression};`,
    '};',
    '',
  ].join('\n');
}

// ---------------------------------------------------------------------------------------------
// Configuration (Twenty workspace schema is not verified: every custom name is overridable)
// ---------------------------------------------------------------------------------------------
export const defaultCrmConfig = Object.freeze({
  stage: 'NEW',
  areaLabels: { legal: 'Legal', data: 'Datos-IA' },
  opportunityFields: { area: 'area', source: 'source', locale: 'locale' },
  areaValues: { legal: 'LEGAL', data: 'DATA' },
  sourceValue: 'WEB',
  defaultPhoneCountry: { countryCode: 'CO', callingCode: '+57' },
  sendCallingCode: true,
  directusAdminUrl: 'https://cms.romahomestore.com',
  notify: { legal: [], data: [] },
});

const fieldName = (value, label) => {
  if (value === undefined) return undefined;
  const text = String(value).trim();
  if (text === '' || text === '-' || text.toLowerCase() === 'none') return '';
  if (!/^[a-zA-Z][a-zA-Z0-9]{0,62}$/.test(text)) throw new TypeError(`${label}: nombre de campo inválido`);
  return text;
};
const enumValue = (value, label) => {
  if (value === undefined) return undefined;
  const text = String(value).trim();
  if (!/^[A-Z][A-Z0-9_]{0,62}$/.test(text)) throw new TypeError(`${label}: valor SELECT inválido (MAYÚSCULAS_Y_GUIONES_BAJOS)`);
  return text;
};
const userList = (value, label) => {
  if (value === undefined || String(value).trim() === '') return [];
  const ids = String(value).split(',').map(item => item.trim()).filter(Boolean);
  for (const id of ids) if (!isRecordId(id)) throw new TypeError(`${label}: se esperaba UUID de usuario Directus`);
  return ids;
};
const pick = (value, fallback) => (value === undefined ? fallback : value);

/** Config from env (+ CLI overrides). Throws TypeError on malformed values; never reads secrets. */
export function crmConfigFromEnv(env = {}, overrides = {}) {
  const base = structuredClone(defaultCrmConfig);
  const stage = env.TWENTY_OPPORTUNITY_STAGE === undefined ? undefined : String(env.TWENTY_OPPORTUNITY_STAGE).trim() === '' ? '' : enumValue(env.TWENTY_OPPORTUNITY_STAGE, 'TWENTY_OPPORTUNITY_STAGE');
  return {
    ...base,
    stage: pick(stage, base.stage),
    opportunityFields: {
      area: pick(fieldName(env.TWENTY_FIELD_AREA, 'TWENTY_FIELD_AREA'), base.opportunityFields.area),
      source: pick(fieldName(env.TWENTY_FIELD_SOURCE, 'TWENTY_FIELD_SOURCE'), base.opportunityFields.source),
      locale: pick(fieldName(env.TWENTY_FIELD_LOCALE, 'TWENTY_FIELD_LOCALE'), base.opportunityFields.locale),
    },
    areaValues: {
      legal: pick(enumValue(env.TWENTY_AREA_VALUE_LEGAL, 'TWENTY_AREA_VALUE_LEGAL'), base.areaValues.legal),
      data: pick(enumValue(env.TWENTY_AREA_VALUE_DATA, 'TWENTY_AREA_VALUE_DATA'), base.areaValues.data),
    },
    sourceValue: pick(enumValue(env.TWENTY_SOURCE_VALUE, 'TWENTY_SOURCE_VALUE'), base.sourceValue),
    sendCallingCode: env.TWENTY_SEND_CALLING_CODE === undefined ? base.sendCallingCode : !['0', 'false', 'no'].includes(String(env.TWENTY_SEND_CALLING_CODE).trim().toLowerCase()),
    directusAdminUrl: overrides.directusAdminUrl ?? base.directusAdminUrl,
    notify: {
      legal: userList(overrides.notifyLegal ?? env.DIRECTUS_NOTIFY_LEGAL_USER, 'DIRECTUS_NOTIFY_LEGAL_USER'),
      data: userList(overrides.notifyData ?? env.DIRECTUS_NOTIFY_DATA_USER, 'DIRECTUS_NOTIFY_DATA_USER'),
    },
  };
}
