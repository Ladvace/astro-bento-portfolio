/**
 * Idempotent Directus Flows for Lead → Twenty CRM sync. Same rules and transport as
 * directus-schema.mjs: diff against the live state, create what is missing, update only the
 * Flows/operations this script owns (matched by Flow name + operation key), never delete.
 *
 *   node scripts/directus-flows.mjs                          # dry-run against DIRECTUS_URL (GET only)
 *   node scripts/directus-flows.mjs --fixture FILE           # dry-run against a local JSON state
 *   node scripts/directus-flows.mjs --fixture FILE --apply   # simulate in memory, then re-plan (must be 0)
 *   node scripts/directus-flows.mjs --apply --backup-done    # REAL write (after `directus schema snapshot`)
 *   add --activate to set the six Flows to active (default: new Flows are created inactive)
 *   --notify-legal UUID[,UUID] / --notify-data UUID[,UUID]   # Directus users notified per area
 *                                                             # (or DIRECTUS_NOTIFY_LEGAL_USER / _DATA_USER)
 *
 * Design (see docs/crm-integration.md): native operations only, no custom extension.
 *   "Lead → Twenty"            event items.create on leads → trigger core
 *   "Lead · Aviso interno"     event items.create on leads → in-app notification. Its own Flow, so the
 *                              notice goes out even when the CRM sync fails or hangs.
 *   "Reintentar sync CRM"      manual on leads → read selected rows with crm_status != synced → trigger core
 *   "CRM · Pendientes atascados" schedule every 15 min → leads pending > 15 min become error (retryable)
 *   "CRM · Sincronizar lead"   linear chain: item-read, condition, exec (pure mapping), request (Twenty),
 *                              item-update. Every failing step rejects into its own trigger → error flow.
 *   "CRM · Registrar error"    exec (sanitise) → item-update crm_status=error, crm_error (step+HTTP+code)
 * During a real --apply, active Flows whose operations change are paused first and re-activated in a
 * finally block, so a half-rewired chain never runs on live leads.
 * Branching (person exists or not) is resolved inside exec, which returns the HTTP method/path for
 * the next request op (GET existing record vs POST new one), so the chain never needs to merge
 * branches (Directus enforces unique resolve/reject targets per operation).
 * The Twenty API key is read at runtime through {{$env.TWENTY_API_KEY}}; it is never written here.
 */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createClient, applyPlan, formatPlan } from './directus-schema.mjs';
import { createMemoryDirectus } from './directus-memory.mjs';
import { cmsBase } from './content.mjs';
import { crmConfigFromEnv, execCode } from './crm-mapping.mjs';

const usage = 'Uso: directus-flows.mjs [--fixture FILE] [--json] [--activate] [--notify-legal UUID] [--notify-data UUID] [--apply [--backup-done]]';

export const flowNames = Object.freeze({
  event: 'Lead → Twenty',
  notify: 'Lead · Aviso interno',
  retry: 'Reintentar sync CRM',
  stale: 'CRM · Pendientes atascados',
  core: 'CRM · Sincronizar lead',
  error: 'CRM · Registrar error',
});
export const STALE_PENDING_MINUTES = 15;
export const STALE_CRON = '*/15 * * * *';
export const STALE_ERROR = 'stale_pending: PENDING_TIMEOUT';
const MARKER = '[roma-crm]';

/** Deterministic UUID (v5 layout over SHA-1) so a fresh install gets stable, reviewable ids. */
export function stableId(name) {
  const hex = createHash('sha1').update(`roma-crm-flows:${name}`).digest('hex').slice(0, 32).split('');
  hex[12] = '5';
  hex[16] = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  const h = hex.join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

const LEAD_FIELDS = ['id', 'date_created', 'name', 'area', 'message', 'contact_whatsapp', 'contact_email', 'locale', 'consent', 'page', 'utm_source', 'utm_medium', 'utm_campaign', 'ga_client_id', 'crm_status', 'twenty_person_id', 'twenty_opportunity_id', 'twenty_note_id'];
const JSON_HEADERS = [
  { header: 'Authorization', value: 'Bearer {{$env.TWENTY_API_KEY}}' },
  { header: 'Content-Type', value: 'application/json' },
  { header: 'Accept', value: 'application/json' },
];

// ---------------------------------------------------------------------------------------------
// Desired state (pure)
// ---------------------------------------------------------------------------------------------
/**
 * @param config  crm-mapping config (field names, notify users…)
 * @param flowIds map flow key → id to use (existing id when the Flow already exists by name)
 * @returns [{ key, flow, start, operations: [{ key, name, type, options, resolve, reject, position_x, position_y }] }]
 */
export function desiredFlows(config, flowIds = {}) {
  const ids = Object.fromEntries(Object.keys(flowNames).map(key => [key, flowIds[key] ?? stableId(`flow:${key}`)]));
  const leadKey = '{{$trigger.id}}';
  const at = (col, row) => ({ position_x: 19 + col * 18, position_y: 1 + row * 18 });
  const errorTrigger = (step, col) => ({
    key: `err_${step}`, name: `Error · ${step}`, type: 'trigger', ...at(col, 1),
    options: { flow: ids.error, payload: { id: leadKey, step, error: '{{$last}}' }, iterationMode: 'serial' },
    resolve: null, reject: null,
  });
  const exec = (key, name, expression, col, next) => ({ key, name, type: 'exec', ...at(col, 0), options: { code: execCode(expression, config) }, resolve: next, reject: `err_${key}` });
  const request = (key, name, method, path, body, col, next) => ({
    key, name, type: 'request', ...at(col, 0),
    options: { method, url: `{{$env.TWENTY_BASE_URL}}${path}`, headers: JSON_HEADERS, body },
    resolve: next, reject: `err_${key}`,
  });
  const update = (key, name, payload, col, next) => ({
    key, name, type: 'item-update', ...at(col, 0),
    options: { collection: 'leads', key: [leadKey], payload, permissions: '$full', emitEvents: false },
    resolve: next, reject: `err_${key}`,
  });

  // Core chain, in execution order. `resolve` is the next key; rejects go to err_<key>.
  const chain = [
    { key: 'read_lead', name: 'Leer lead', type: 'item-read', ...at(0, 0), options: { collection: 'leads', key: [leadKey], query: { fields: LEAD_FIELDS }, permissions: '$full', emitEvents: false }, resolve: 'guard', reject: null },
    { key: 'guard', name: '¿Pendiente de sync?', type: 'condition', ...at(1, 0), options: { filter: { read_lead: { crm_status: { _neq: 'synced' } } } }, resolve: 'build', reject: null },
    exec('build', 'Mapear lead → Twenty', 'buildLeadSync(data.read_lead, CONFIG)', 2, 'find_person'),
    request('find_person', 'Buscar persona (email/teléfono)', 'GET', '{{build.person_search_path}}', null, 3, 'person_step'),
    exec('person_step', 'Reusar o crear persona', 'personStep(data.build, data.find_person)', 4, 'ensure_person'),
    request('ensure_person', 'Persona en Twenty (nunca se sobrescribe)', '{{person_step.method}}', '{{person_step.path}}', '{{person_step.body}}', 5, 'opp_step'),
    exec('opp_step', 'Preparar oportunidad ([Verificar] si la persona ya existía)', 'opportunityStep(data.build, data.ensure_person, data.person_step)', 6, 'save_person'),
    update('save_person', 'Guardar id persona', { twenty_person_id: '{{opp_step.person_id}}' }, 7, 'ensure_opp'),
    request('ensure_opp', 'Oportunidad en Twenty', '{{opp_step.method}}', '{{opp_step.path}}', '{{opp_step.body}}', 8, 'opp'),
    exec('opp', 'Id oportunidad', "recordId(data.ensure_opp, 'OPPORTUNITY')", 9, 'save_opp'),
    update('save_opp', 'Guardar id oportunidad', { twenty_opportunity_id: '{{opp.id}}' }, 10, 'note_step'),
    exec('note_step', 'Reusar o crear nota', 'noteStep(data.build, data.opp_step)', 11, 'ensure_note'),
    request('ensure_note', 'Nota en Twenty', '{{note_step.method}}', '{{note_step.path}}', '{{note_step.body}}', 12, 'note'),
    exec('note', 'Id nota', 'noteSaved(data.ensure_note)', 13, 'save_note'),
    update('save_note', 'Guardar id nota', { twenty_note_id: '{{note.id}}' }, 14, 'find_targets'),
    request('find_targets', 'Buscar vínculos de la nota', 'GET', '{{note.targets_path}}', null, 15, 'targets'),
    exec('targets', 'Preparar vínculos de nota', 'noteTargetsStep(data.note.id, data.find_targets, data.opp_step.person_id, data.opp.id)', 16, 'target_opp'),
    request('target_opp', 'Nota → oportunidad', '{{targets.opportunity_method}}', '{{targets.opportunity_path}}', '{{targets.opportunity_body}}', 17, 'target_person'),
    request('target_person', 'Nota → persona', '{{targets.person_method}}', '{{targets.person_path}}', '{{targets.person_body}}', 18, 'mark_synced'),
    update('mark_synced', 'Marcar synced', { crm_status: 'synced', crm_error: null, twenty_person_id: '{{opp_step.person_id}}', twenty_opportunity_id: '{{opp.id}}', twenty_note_id: '{{note.id}}' }, 19, null),
  ];
  const coreOps = [...chain, ...chain.filter(op => op.reject).map(op => errorTrigger(op.key, chain.indexOf(op)))];

  const errorOps = [
    { key: 'sanitize', name: 'Resumir error (sin datos personales)', type: 'exec', ...at(0, 0), options: { code: execCode('sanitizeCrmError(data.$trigger.error, data.$trigger.step)', config) }, resolve: 'mark_error', reject: null },
    { key: 'mark_error', name: 'Marcar error', type: 'item-update', ...at(1, 0), options: { collection: 'leads', key: [leadKey], payload: { crm_status: 'error', crm_error: '{{sanitize.message}}' }, permissions: '$full', emitEvents: false }, resolve: null, reject: null },
  ];

  const eventOps = [
    { key: 'sync', name: 'Sincronizar con Twenty', type: 'trigger', ...at(0, 0), options: { flow: ids.core, payload: { id: '{{$trigger.key}}' }, iterationMode: 'serial' }, resolve: null, reject: null },
  ];

  // Independent of the CRM: its own event Flow, so a failing or hanging Twenty never delays it.
  const notifyConfigured = config.notify.legal.length + config.notify.data.length > 0;
  const notifyOps = [
    ...(notifyConfigured ? [
      { key: 'recipients', name: 'Responsable del área', type: 'exec', ...at(0, 0), options: { code: execCode('pickRecipients(data.$trigger.payload && data.$trigger.payload.area, CONFIG)', config) }, resolve: 'notify', reject: null },
      { key: 'notify', name: 'Aviso interno', type: 'notification', ...at(1, 0), options: {
        recipient: '{{recipients.users}}', permissions: '$full', collection: 'leads', item: '{{$trigger.key}}',
        subject: 'Nuevo lead web · {{recipients.area_label}}',
        message: 'Llegó un lead nuevo del formulario web (área {{recipients.area_label}}). Ábralo en **Leads** para contactarlo; el campo «Estado en Twenty CRM» indica si ya está en el CRM (si dice Error, use «Reintentar sync CRM»).',
      }, resolve: null, reject: null },
    ] : [
      { key: 'no_recipients', name: 'SIN destinatarios de aviso', type: 'log', ...at(0, 0), options: {
        message: 'Lead nuevo {{$trigger.key}} SIN aviso interno: no hay usuarios configurados (DIRECTUS_NOTIFY_LEGAL_USER / DIRECTUS_NOTIFY_DATA_USER). Ejecute scripts/directus-flows.mjs con --notify-legal/--notify-data.',
      }, resolve: null, reject: null },
    ]),
    // Present but deliberately unconnected (no SMTP today). Connect it from `notify` when SMTP exists.
    { key: 'mail_disabled', name: 'Correo (desconectado: sin SMTP)', type: 'mail', ...at(1, 1), options: {
      to: ['{{$env.LEADS_NOTIFY_EMAIL}}'], type: 'markdown',
      subject: 'Nuevo lead web',
      body: 'Llegó un lead nuevo del formulario web. Ábralo en Directus → Leads ({{$trigger.key}}).',
    }, resolve: null, reject: null },
  ];

  const retryOps = [
    { key: 'pick', name: 'Leads seleccionados no sincronizados', type: 'item-read', ...at(0, 0), options: {
      collection: 'leads', permissions: '$trigger', emitEvents: false,
      query: { fields: ['id'], limit: 100, filter: { _and: [{ id: { _in: '{{$trigger.body.keys}}' } }, { crm_status: { _neq: 'synced' } }] } },
    }, resolve: 'run', reject: null },
    { key: 'run', name: 'Reintentar uno a uno', type: 'trigger', ...at(1, 0), options: { flow: ids.core, payload: '{{pick}}', iterationMode: 'serial' }, resolve: null, reject: null },
  ];

  // A hung request leaves the lead in `pending` forever: after 15 min it becomes a retryable error.
  const staleOps = [
    { key: 'mark_stale', name: `Pendientes > ${STALE_PENDING_MINUTES} min → error`, type: 'item-update', ...at(0, 0), options: {
      collection: 'leads', permissions: '$full', emitEvents: false,
      query: { filter: { _and: [{ crm_status: { _eq: 'pending' } }, { date_created: { _lt: `$NOW(-${STALE_PENDING_MINUTES} minutes)` } }] }, limit: -1 },
      payload: { crm_status: 'error', crm_error: STALE_ERROR },
    }, resolve: null, reject: null },
  ];

  const description = text => `${MARKER} ${text} Gestionado por scripts/directus-flows.mjs: los cambios manuales se sobrescriben.`;
  return [
    { key: 'event', start: 'sync', operations: eventOps, flow: {
      id: ids.event, name: flowNames.event, icon: 'hub', color: '#2F6F5E', accountability: '$activity', trigger: 'event',
      description: description('Cada lead nuevo crea Persona + Oportunidad + Nota en Twenty. El aviso interno va en su propio Flow.'),
      options: { type: 'action', scope: ['items.create'], collections: ['leads'] },
    } },
    { key: 'notify', start: notifyConfigured ? 'recipients' : 'no_recipients', operations: notifyOps, flow: {
      id: ids.notify, name: flowNames.notify, icon: 'notifications_active', color: '#2F6F5E', accountability: '$activity', trigger: 'event',
      description: description('Aviso interno al responsable del área por cada lead nuevo, independiente de Twenty.'),
      options: { type: 'action', scope: ['items.create'], collections: ['leads'] },
    } },
    { key: 'retry', start: 'pick', operations: retryOps, flow: {
      id: ids.retry, name: flowNames.retry, icon: 'sync_problem', color: '#B7791F', accountability: '$activity', trigger: 'manual',
      description: description('Reintenta la sincronización de los leads seleccionados que no estén sincronizados (error o pendiente).'),
      options: { collections: ['leads'], location: 'both', requireConfirmation: true, confirmationDescription: 'Reintentar la sincronización con Twenty (leads con estado CRM distinto de Sincronizado; espere 15 min tras recibir un lead pendiente)', async: false },
    } },
    { key: 'stale', start: 'mark_stale', operations: staleOps, flow: {
      id: ids.stale, name: flowNames.stale, icon: 'schedule', color: '#B7791F', accountability: '$activity', trigger: 'schedule',
      description: description(`Cada 15 min marca como error los leads en pending con más de ${STALE_PENDING_MINUTES} min, para poder reintentarlos.`),
      options: { cron: STALE_CRON },
    } },
    { key: 'core', start: 'read_lead', operations: coreOps, flow: {
      id: ids.core, name: flowNames.core, icon: 'account_tree', color: '#2F6F5E', accountability: '$activity', trigger: 'operation',
      description: description('Núcleo: busca/crea Persona, crea Oportunidad y Nota, guarda ids. Llamado por los otros Flows.'),
      options: { return: '$last' },
    } },
    { key: 'error', start: 'sanitize', operations: errorOps, flow: {
      id: ids.error, name: flowNames.error, icon: 'error', color: '#C53030', accountability: '$activity', trigger: 'operation',
      description: description('Guarda crm_status=error y un crm_error con paso + HTTP + código (sin texto libre).'),
      options: { return: '$last' },
    } },
  ];
}

// ---------------------------------------------------------------------------------------------
// Diff (pure)
// ---------------------------------------------------------------------------------------------
const canonical = value => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value ?? null;
};
const same = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
const FLOW_FIELDS = ['icon', 'color', 'description', 'accountability', 'trigger', 'options'];
const OP_FIELDS = ['name', 'type', 'options'];

/**
 * Applies a plan; Flows paused by the plan are re-activated in `finally`, even when a step fails
 * midway (only those that were active before: the plan only pauses active Flows).
 */
export async function applyFlowPlan(client, ops, log = () => {}) {
  const resume = ops.filter(item => item.kind === 'flow-resume');
  try {
    await applyPlan(client, ops.filter(item => item.kind !== 'flow-resume'), log);
  } finally {
    for (const item of resume) {
      await client.request(item.method, item.path, item.body);
      log(`  ✓ ${item.summary}`);
    }
  }
}

/** Children first, so every resolve/reject target exists before the operation pointing at it. */
function leavesFirst(operations, start) {
  const byKey = new Map(operations.map(op => [op.key, op]));
  const order = [];
  const seen = new Set();
  const visit = key => {
    if (!key || seen.has(key)) return;
    seen.add(key);
    const op = byKey.get(key);
    if (!op) throw new Error(`Operación desconocida: ${key}`);
    visit(op.resolve);
    visit(op.reject);
    order.push(op);
  };
  visit(start);
  for (const op of operations) visit(op.key); // unconnected operations (mail_disabled)
  return order;
}

export function planFlows(current, config, { activate = false } = {}) {
  const ops = [];
  const warnings = [];
  const op = (kind, summary, method, path, body) => ops.push({ kind, summary, method, path, body });
  const flows = current.flows ?? [];
  const operations = current.operations ?? [];

  if (!(current.collections ?? []).some(c => c.collection === 'leads')) warnings.push('No existe la colección leads: ejecute primero scripts/directus-schema.mjs --apply');
  if (!config.notify.legal.length && !config.notify.data.length) warnings.push(`CRÍTICO ‼ SIN AVISO INTERNO: no hay usuarios a notificar (DIRECTUS_NOTIFY_LEGAL_USER / DIRECTUS_NOTIFY_DATA_USER o --notify-legal / --notify-data). El Flow "${flowNames.notify}" solo dejará un log y NADIE se enterará de los leads nuevos. Configúrelos antes de --activate`);
  else for (const area of ['legal', 'data']) if (!config.notify[area].length) warnings.push(`Sin usuario a notificar para ${area}: se avisará al otro área`);

  const existingByKey = {};
  for (const key of Object.keys(flowNames)) {
    const matches = flows.filter(f => f.name === flowNames[key]);
    if (matches.length > 1) warnings.push(`Hay ${matches.length} Flows llamados "${flowNames[key]}": se usa el primero; revise duplicados a mano`);
    existingByKey[key] = matches[0];
  }
  const desired = desiredFlows(config, Object.fromEntries(Object.entries(existingByKey).filter(([, f]) => f).map(([k, f]) => [k, f.id])));

  const unlink = [];
  const creates = [];
  const updates = [];
  const flowPatches = [];
  const pauses = [];
  const resumes = [];
  for (const { key, flow, start, operations: wanted } of desired) {
    const existing = existingByKey[key];
    const pending = unlink.length + creates.length + updates.length + flowPatches.length;
    const status = activate ? 'active' : existing?.status ?? 'inactive';
    if (!existing) op('flow', `crear Flow "${flow.name}" (${flow.trigger}, ${status})`, 'POST', 'flows', { ...flow, status });
    else {
      const patch = Object.fromEntries(FLOW_FIELDS.filter(field => !same(existing[field], flow[field])).map(field => [field, flow[field]]));
      if (activate && existing.status !== 'active') patch.status = 'active';
      if (Object.keys(patch).length) flowPatches.push([`actualizar Flow "${flow.name}": ${Object.keys(patch).join(', ')}`, `flows/${existing.id}`, patch]);
      if (!activate && existing.status !== 'active') warnings.push(`El Flow "${flow.name}" está ${existing.status}: actívelo con --activate cuando Twenty esté listo`);
      if (!String(existing.description ?? '').includes(MARKER)) warnings.push(`El Flow "${flow.name}" existía sin la marca ${MARKER}: se toma como gestionado por este script`);
    }
    const current = operations.filter(o => o.flow === flow.id);
    const idOf = Object.fromEntries(wanted.map(w => [w.key, current.find(o => o.key === w.key)?.id ?? stableId(`op:${key}:${w.key}`)]));
    for (const extra of current.filter(o => !wanted.some(w => w.key === o.key))) warnings.push(`Flow "${flow.name}": operación ajena "${extra.key}" no se toca (el script nunca borra)`);
    for (const want of leavesFirst(wanted, start)) {
      const body = {
        id: idOf[want.key], flow: flow.id, key: want.key, name: want.name, type: want.type, options: want.options,
        position_x: want.position_x, position_y: want.position_y,
        resolve: want.resolve ? idOf[want.resolve] : null, reject: want.reject ? idOf[want.reject] : null,
      };
      const have = current.find(o => o.key === want.key);
      if (!have) { creates.push([`crear operación ${flow.name} › ${want.key} (${want.type})`, 'operations', body]); continue; }
      const pointersChange = (have.resolve ?? null) !== body.resolve || (have.reject ?? null) !== body.reject;
      if (pointersChange && (have.resolve || have.reject)) unlink.push([`desenlazar ${flow.name} › ${want.key}`, `operations/${have.id}`, { resolve: null, reject: null }]);
      const patch = Object.fromEntries(OP_FIELDS.filter(field => !same(have[field], body[field])).map(field => [field, body[field]]));
      if (pointersChange) Object.assign(patch, { resolve: body.resolve, reject: body.reject });
      if (Object.keys(patch).length) updates.push([`actualizar ${flow.name} › ${want.key}: ${Object.keys(patch).join(', ')}`, `operations/${have.id}`, patch]);
    }
    if ((existing?.operation ?? null) !== idOf[start]) flowPatches.push([`enlazar inicio de "${flow.name}" → ${start}`, `flows/${flow.id}`, { operation: idOf[start] }]);
    // An active Flow being rewired is paused first and re-activated last (runFlowsCli: try/finally).
    const touched = unlink.length + creates.length + updates.length + flowPatches.length > pending;
    if (existing?.status === 'active' && touched) {
      pauses.push([`pausar Flow activo "${flow.name}" mientras se modifica`, `flows/${existing.id}`, { status: 'inactive' }]);
      resumes.push([`reactivar Flow "${flow.name}"`, `flows/${existing.id}`, { status: 'active' }]);
    }
  }
  for (const [summary, path, body] of pauses) op('flow-pause', summary, 'PATCH', path, body);
  // Order keeps Directus' unique resolve/reject constraint satisfied at every step.
  for (const [summary, path, body] of unlink) op('operation-unlink', summary, 'PATCH', path, body);
  for (const [summary, path, body] of creates) op('operation', summary, 'POST', path, body);
  for (const [summary, path, body] of updates) op('operation-update', summary, 'PATCH', path, body);
  for (const [summary, path, body] of flowPatches) op('flow-update', summary, 'PATCH', path, body);
  for (const [summary, path, body] of resumes) op('flow-resume', summary, 'PATCH', path, body);
  if (pauses.length) warnings.push(`Durante --apply se pausan ${pauses.length} Flow(s) activos: los leads que lleguen en esa ventana quedan en pending y el Flow "${flowNames.stale}" los pasará a error para reintentar`);
  return { ops, warnings };
}

export async function readFlowState(client) {
  const get = path => client.request('GET', path);
  const [collections, flows, operations] = await Promise.all([
    get('collections?limit=-1&fields=collection'),
    get('flows?limit=-1&fields=id,name,status,trigger,options,operation,accountability,description,icon,color'),
    get('operations?limit=-1&fields=id,flow,key,name,type,options,resolve,reject,position_x,position_y'),
  ]);
  return { collections, flows, operations };
}

// ---------------------------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------------------------
export async function runFlowsCli(args, { env = process.env, fetcher = globalThis.fetch, stdout = line => console.log(line) } = {}) {
  const valueFlags = ['--fixture', '--notify-legal', '--notify-data'];
  const known = new Set(['--apply', '--json', '--backup-done', '--activate', ...valueFlags]);
  const values = {};
  const flags = new Set();
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!known.has(arg)) throw new TypeError(usage);
    if (valueFlags.includes(arg)) {
      const value = args[++i];
      if (!value || value.startsWith('--')) throw new TypeError(usage);
      values[arg] = value;
    } else flags.add(arg);
  }
  const apply = flags.has('--apply');
  const fixture = values['--fixture'];
  const json = flags.has('--json');

  let client;
  let memory;
  let directusAdminUrl;
  if (fixture) {
    memory = createMemoryDirectus(JSON.parse(await readFile(fixture, 'utf8')));
    client = createClient({ baseUrl: 'http://localhost:8055', fetcher: memory.fetcher });
  } else {
    const token = typeof env.DIRECTUS_ADMIN_TOKEN === 'string' ? env.DIRECTUS_ADMIN_TOKEN.trim() : '';
    if (!token) throw new TypeError('Se requiere DIRECTUS_ADMIN_TOKEN en el entorno (nunca en argumentos)');
    if (apply && !flags.has('--backup-done')) throw new TypeError('--apply real exige --backup-done tras `directus schema snapshot` y dump de la base');
    directusAdminUrl = cmsBase(env.DIRECTUS_URL ?? '', 'DIRECTUS_URL');
    client = createClient({ baseUrl: directusAdminUrl, token, fetcher });
  }
  const config = crmConfigFromEnv(env, { notifyLegal: values['--notify-legal'], notifyData: values['--notify-data'], directusAdminUrl });
  const options = { activate: flags.has('--activate') };

  const before = planFlows(await readFlowState(client), config, options);
  const report = { mode: apply ? (fixture ? 'simulate' : 'apply') : 'dry-run', ops: before.ops.map(({ kind, summary, method, path }) => ({ kind, summary, method, path })), warnings: before.warnings };
  if (!json) stdout(formatPlan(before, `Plan Flows CRM (${report.mode}${fixture ? `, fixture ${fixture}` : ''})`));
  if (apply) {
    await applyFlowPlan(client, before.ops, json ? () => {} : stdout);
    const after = planFlows(await readFlowState(client), config, options);
    report.secondRun = after.ops.length;
    if (!json) stdout(formatPlan(after, 'Segunda corrida'));
    if (memory) report.deleteRequests = memory.requests.filter(r => r.method === 'DELETE').length;
  }
  if (json) stdout(JSON.stringify(report, null, 2));
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runFlowsCli(process.argv.slice(2)).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
