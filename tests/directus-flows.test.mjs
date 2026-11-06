import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { planFlows, readFlowState, runFlowsCli, desiredFlows, flowNames, stableId, applyFlowPlan, STALE_ERROR, STALE_CRON } from '../scripts/directus-flows.mjs';
import { createClient, applyPlan } from '../scripts/directus-schema.mjs';
import { createMemoryDirectus } from '../scripts/directus-memory.mjs';
import { crmConfigFromEnv, VERIFY_NOTE_LINE } from '../scripts/crm-mapping.mjs';
import { createFlowRunner, createMockTwenty } from './helpers/flow-runner.mjs';

const fixturePath = new URL('./fixtures/directus-state.json', import.meta.url);
const fixture = async () => JSON.parse(await readFile(fixturePath, 'utf8'));
const LEGAL_USER = '11111111-1111-4111-8111-111111111111';
const DATA_USER = '55555555-5555-4555-8555-555555555555';
const config = crmConfigFromEnv({}, { notifyLegal: LEGAL_USER, notifyData: DATA_USER });
const silent = () => {};

async function installed(state, cfg = config, options = {}) {
  const memory = createMemoryDirectus(state);
  const client = createClient({ baseUrl: 'http://localhost:8055', fetcher: memory.fetcher });
  const first = planFlows(await readFlowState(client), cfg, options);
  await applyPlan(client, first.ops, silent);
  return { memory, client, first, second: planFlows(await readFlowState(client), cfg, options) };
}

test('fixture dry-run plans the six flows, inactive by default, without touching the build flow', async () => {
  const { ops, warnings } = planFlows(await fixture(), config);
  const flows = ops.filter(op => op.kind === 'flow').map(op => op.body);
  assert.deepEqual(flows.map(f => f.name), Object.values(flowNames));
  assert.ok(flows.every(f => f.status === 'inactive'));
  assert.deepEqual(flows.find(f => f.name === 'Lead → Twenty').options, { type: 'action', scope: ['items.create'], collections: ['leads'] });
  assert.deepEqual(flows.find(f => f.name === 'Lead · Aviso interno').options, { type: 'action', scope: ['items.create'], collections: ['leads'] });
  assert.equal(flows.find(f => f.name === flowNames.stale).trigger, 'schedule');
  assert.deepEqual(flows.find(f => f.name === flowNames.stale).options, { cron: STALE_CRON });
  assert.equal(STALE_CRON, '*/15 * * * *');
  assert.equal(flows.find(f => f.name === 'Reintentar sync CRM').trigger, 'manual');
  assert.ok(ops.every(op => ['POST', 'PATCH'].includes(op.method)));
  assert.ok(!ops.some(op => op.path.includes('f0000000-0000-4000-8000-000000000001')), 'Trigger Coolify Build untouched');
  assert.ok(warnings.some(w => /colección leads/.test(w)));
  // The API key is only referenced through $env, never as a literal.
  const serialized = JSON.stringify(ops);
  assert.ok(serialized.includes('Bearer {{$env.TWENTY_API_KEY}}'));
  assert.ok(!/Bearer [A-Za-z0-9]{10,}/.test(serialized));
  // Mail operation exists but nothing points at it.
  const mail = ops.find(op => op.kind === 'operation' && op.body.type === 'mail').body;
  assert.ok(!ops.some(op => op.body?.resolve === mail.id || op.body?.reject === mail.id));
});

test('applying converges (second run 0 changes), respects unique resolve/reject and never deletes', async () => {
  const { memory, second } = await installed(await fixture(), config, { activate: true });
  assert.deepEqual(second.ops, []);
  assert.equal(memory.requests.filter(r => !['GET', 'POST', 'PATCH'].includes(r.method)).length, 0);
  for (const pointer of ['resolve', 'reject']) {
    const targets = memory.state.operations.map(o => o[pointer]).filter(Boolean);
    assert.equal(new Set(targets).size, targets.length, `${pointer} unique`);
  }
  assert.ok(memory.state.flows.filter(f => Object.values(flowNames).includes(f.name)).every(f => f.status === 'active' && f.operation));
  assert.equal(memory.state.flows.length, 7);
});

test('drift is repaired in place: changed config updates exec code, manual edits are overwritten, foreign ops reported', async () => {
  const { memory, client } = await installed(await fixture());
  const core = memory.state.flows.find(f => f.name === flowNames.core);
  const build = memory.state.operations.find(o => o.flow === core.id && o.key === 'build');
  build.options.code = '// edited by hand';
  memory.state.operations.push({ id: 'manual-op', flow: core.id, key: 'manual_log', type: 'log', options: {}, resolve: null, reject: null });
  const changed = crmConfigFromEnv({ TWENTY_FIELD_SOURCE: 'leadSource' }, { notifyLegal: LEGAL_USER, notifyData: DATA_USER });
  const plan = planFlows(await readFlowState(client), changed);
  const updated = plan.ops.filter(op => op.kind === 'operation-update').map(op => op.summary);
  assert.ok(updated.some(s => /› build: options/.test(s)));
  assert.ok(!plan.ops.some(op => op.kind === 'operation' || op.kind === 'flow'));
  assert.ok(plan.warnings.some(w => /operación ajena "manual_log"/.test(w)));
  await applyPlan(client, plan.ops, silent);
  assert.deepEqual(planFlows(await readFlowState(client), changed).ops, []);
  assert.match(memory.state.operations.find(o => o.id === build.id).options.code, /"source":"leadSource"/);
});

test('re-wiring an existing chain unlinks first so unique pointers never collide', async () => {
  const { memory, client } = await installed(await fixture());
  // Simulate an older layout: swap the targets of two core operations.
  const core = memory.state.flows.find(f => f.name === flowNames.core);
  const byKey = key => memory.state.operations.find(o => o.flow === core.id && o.key === key);
  const [a, b] = [byKey('opp'), byKey('save_opp')];
  [a.resolve, b.resolve] = [b.resolve, a.resolve];
  const plan = planFlows(await readFlowState(client), config);
  assert.ok(plan.ops.findIndex(op => op.kind === 'operation-unlink') < plan.ops.findIndex(op => op.kind === 'operation-update'));
  await applyPlan(client, plan.ops, silent);
  assert.deepEqual(planFlows(await readFlowState(client), config).ops, []);
});

test('without notify users the notice Flow only logs and the plan warns loudly (CRÍTICO)', () => {
  const unconfigured = crmConfigFromEnv({});
  const flows = desiredFlows(unconfigured);
  assert.deepEqual(flows.find(f => f.key === 'event').operations.map(o => o.key), ['sync']);
  assert.deepEqual(flows.find(f => f.key === 'notify').operations.map(o => o.key), ['no_recipients', 'mail_disabled']);
  assert.deepEqual(flows.find(f => f.key === 'notify').operations.map(o => o.type), ['log', 'mail']);
  const { warnings } = planFlows({ collections: [{ collection: 'leads' }], flows: [], operations: [] }, unconfigured);
  assert.ok(warnings.some(w => /^CRÍTICO ‼ SIN AVISO INTERNO/.test(w) && /NADIE/.test(w)), warnings.join('\n'));
  assert.ok(!planFlows({ collections: [{ collection: 'leads' }], flows: [], operations: [] }, config).warnings.some(w => /CRÍTICO/.test(w)));
  assert.equal(stableId('x'), stableId('x'));
  assert.match(stableId('x'), /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

// ---------------------------------------------------------------------------------------------
// End-to-end wiring against a mock Twenty (approximate Directus semantics, see helpers/flow-runner)
// ---------------------------------------------------------------------------------------------
const leadRow = (extra = {}) => ({
  id: '22222222-2222-4222-8222-222222222222', date_created: '2026-01-01T00:00:00.000Z', name: 'Ana Pérez Gómez', area: 'legal',
  message: 'Hola', contact_whatsapp: '+57 300 123 4567', contact_email: 'ana@example.com', locale: 'es', consent: true,
  page: '/es/', utm_source: null, utm_medium: null, utm_campaign: null, crm_status: 'pending', twenty_person_id: null, twenty_opportunity_id: null, twenty_note_id: null, ...extra,
});

async function harness(rows = [leadRow()], { now } = {}) {
  const { memory } = await installed(await fixture(), config, { activate: true });
  const twenty = createMockTwenty();
  const items = { leads: rows };
  const runner = createFlowRunner({
    flows: memory.state.flows, operations: memory.state.operations, items, fetcher: twenty.fetcher,
    env: { TWENTY_BASE_URL: 'http://twenty-server:3000', TWENTY_API_KEY: 'test-twenty-key' }, ...(now ? { now } : {}),
  });
  const flowId = name => memory.state.flows.find(f => f.name === name).id;
  const event = lead => ({ event: 'leads.items.create', collection: 'leads', key: lead.id, payload: { area: lead.area, name: lead.name } });
  // Directus runs every active items.create Flow on leads independently: sync and notice.
  const emit = lead => runner.emitAction('items.create', 'leads', event(lead));
  const created = lead => Promise.all(emit(lead).map(run => run.done));
  const retry = keys => runner.runFlow(flowId(flowNames.retry), { body: { collection: 'leads', keys } });
  const cron = () => runner.runFlow(flowId(flowNames.stale), { $schedule: true });
  return { twenty, items, runner, created, emit, retry, cron, memory };
}

test('new lead: Person + Opportunity + Note + 2 targets, lead synced with ids, area user notified', async () => {
  const { twenty, items, runner, created } = await harness();
  await created(items.leads[0]);
  const [lead] = items.leads;
  assert.equal(lead.crm_status, 'synced', JSON.stringify(runner.runs));
  assert.equal(lead.crm_error, null);
  assert.equal(twenty.db.people.length, 1);
  assert.deepEqual(twenty.db.people[0].name, { firstName: 'Ana', lastName: 'Pérez Gómez' });
  assert.equal(lead.twenty_person_id, twenty.db.people[0].id);
  const [opp] = twenty.db.opportunities;
  assert.equal(lead.twenty_opportunity_id, opp.id);
  assert.deepEqual({ ...opp, id: undefined, createdAt: undefined }, { id: undefined, createdAt: undefined, name: 'Web · Legal · Ana Pérez Gómez', stage: 'NEW', area: 'LEGAL', source: 'WEB', locale: 'es', pointOfContactId: lead.twenty_person_id });
  assert.ok(!opp.name.startsWith('[Verificar]'), 'a person created for this lead is not flagged');
  assert.equal(twenty.db.notes.length, 1);
  assert.equal(lead.twenty_note_id, twenty.db.notes[0].id);
  assert.ok(!twenty.db.notes[0].bodyV2.markdown.includes(VERIFY_NOTE_LINE));
  assert.deepEqual(twenty.db.noteTargets.map(t => Object.keys(t).filter(k => k !== 'createdAt').sort()), [['id', 'noteId', 'opportunityId'], ['id', 'noteId', 'personId']]);
  assert.ok(twenty.requests.every(r => r.auth === 'Bearer test-twenty-key'));
  assert.deepEqual(runner.notifications.map(n => n.recipient), [[LEGAL_USER]]);
  assert.equal(runner.notifications[0].subject, 'Nuevo lead web · Legal');
});

test('existing person (same email): reused, never overwritten, opportunity and note flagged [Verificar]', async () => {
  const { twenty, items, runner, created } = await harness([leadRow({ area: 'data', name: 'Impostor Total' })]);
  const existing = { id: '99999999-9999-4999-8999-999999999999', createdAt: '2025-05-01T00:00:00.000Z', name: { firstName: 'Ana', lastName: 'P' }, emails: { primaryEmail: 'ana@example.com' } };
  twenty.db.people.push(structuredClone(existing));
  await created(items.leads[0]);
  assert.equal(items.leads[0].crm_status, 'synced');
  assert.equal(twenty.db.people.length, 1);
  assert.deepEqual(twenty.db.people[0], existing, 'the existing person keeps its name/email/phone');
  assert.ok(twenty.requests.every(r => ['GET', 'POST'].includes(r.method)), 'no PATCH/PUT/DELETE ever reaches Twenty');
  assert.ok(!twenty.requests.some(r => r.method === 'POST' && r.path === '/rest/people'));
  const [opp] = twenty.db.opportunities;
  assert.equal(opp.pointOfContactId, existing.id);
  assert.equal(opp.name, '[Verificar] Web · Datos-IA · Impostor Total');
  assert.equal(opp.area, 'DATA');
  assert.match(twenty.db.notes[0].bodyV2.markdown, new RegExp('^\\*\\*' + VERIFY_NOTE_LINE + '\\.\\*\\*\\n'));
  assert.deepEqual(runner.notifications.map(n => n.recipient), [[DATA_USER]]);
});

test('M1: the internal notice goes out even when Twenty hangs forever (independent event Flow)', async () => {
  const { twenty, items, runner, emit } = await harness();
  twenty.fail('GET', '/rest/people', { hang: true, times: Infinity });
  const runs = emit(items.leads[0]);
  assert.deepEqual(runs.map(r => r.name).sort(), [flowNames.notify, flowNames.event].sort());
  await runs.find(r => r.name === flowNames.notify).done; // the sync run never settles
  assert.deepEqual(runner.notifications.map(n => n.recipient), [[LEGAL_USER]]);
  assert.equal(items.leads[0].crm_status, 'pending');
});

test('M2: the 15-min cron turns stuck pending leads into error; retry accepts any non-synced lead', async () => {
  const now = () => new Date('2026-11-06T12:00:00.000Z');
  const rows = [
    leadRow({ id: 'b0000000-0000-4000-8000-000000000001', date_created: '2026-11-06T11:00:00.000Z' }),
    leadRow({ id: 'b0000000-0000-4000-8000-000000000002', date_created: '2026-11-06T11:50:00.000Z', contact_email: 'r@example.com', contact_whatsapp: '' }),
    leadRow({ id: 'b0000000-0000-4000-8000-000000000003', date_created: '2026-11-06T10:00:00.000Z', crm_status: 'synced' }),
  ];
  const { items, cron, retry, twenty } = await harness(rows, { now });
  await cron();
  assert.deepEqual(items.leads.map(r => r.crm_status), ['error', 'pending', 'synced']);
  assert.equal(items.leads[0].crm_error, STALE_ERROR);
  assert.equal(items.leads[2].crm_error, undefined, 'synced rows untouched');
  assert.equal(twenty.requests.length, 0, 'the cron never calls Twenty');
  await retry(rows.map(r => r.id));
  assert.deepEqual(items.leads.map(r => r.crm_status), ['synced', 'synced', 'synced']);
});

test('Twenty 500 on opportunity: lead kept with error (no PII), person id saved; retry completes without duplicates', async () => {
  const { twenty, items, runner, created, retry } = await harness();
  twenty.fail('POST', '/rest/opportunities', { body: { statusCode: 500, error: 'InternalServerErrorException', messages: ['insert failed for ana@example.com "Ana Pérez"'] } });
  await created(items.leads[0]);
  const [lead] = items.leads;
  assert.equal(lead.crm_status, 'error');
  assert.equal(lead.crm_error, 'ensure_opp: HTTP 500 InternalServerErrorException', 'only step + HTTP + error type, never Twenty free text');
  assert.equal(lead.twenty_person_id, twenty.db.people[0].id);
  assert.equal(runner.notifications.length, 1, 'notification still sent when CRM fails');

  await retry([lead.id]);
  assert.equal(lead.crm_status, 'synced');
  assert.equal(lead.crm_error, null);
  assert.equal(twenty.db.people.length, 1);
  assert.equal(twenty.db.opportunities.length, 1);
  assert.equal(twenty.db.notes.length, 1);
});

test('network failure marks error; a retry after a link failure reuses opportunity, note and existing links', async () => {
  const { twenty, items, created, retry } = await harness();
  twenty.fail('GET', '/rest/people', { network: true });
  await created(items.leads[0]);
  assert.equal(items.leads[0].crm_status, 'error');
  assert.equal(items.leads[0].crm_error, 'find_person: error TypeError');
  assert.equal(twenty.db.people.length, 0);

  twenty.fail('POST', '/rest/noteTargets', { status: 503 });
  await retry([items.leads[0].id]);
  assert.equal(items.leads[0].crm_status, 'error');
  assert.equal(items.leads[0].crm_error, 'target_opp: HTTP 503');
  assert.ok(items.leads[0].twenty_opportunity_id);
  assert.equal(items.leads[0].twenty_note_id, twenty.db.notes[0].id, 'note id saved before linking');

  await retry([items.leads[0].id]);
  assert.equal(items.leads[0].crm_status, 'synced');
  assert.equal(twenty.db.people.length, 1);
  assert.equal(twenty.db.opportunities.length, 1, 'opportunity reused through twenty_opportunity_id');
  assert.equal(twenty.db.notes.length, 1, 'note reused through twenty_note_id: no duplicate');
  assert.equal(twenty.db.noteTargets.length, 2);
});

test('B2: a retry after only the person link failed reuses the note and its opportunity link', async () => {
  const { twenty, items, created, retry } = await harness();
  twenty.fail('POST', '/rest/noteTargets', { status: 503, skip: 1 }); // opportunity link passes, person link fails
  await created(items.leads[0]);
  assert.equal(items.leads[0].crm_status, 'error');
  assert.equal(items.leads[0].crm_error, 'target_person: HTTP 503');
  assert.equal(twenty.db.noteTargets.length, 1);
  await retry([items.leads[0].id]);
  assert.equal(items.leads[0].crm_status, 'synced');
  assert.equal(twenty.db.notes.length, 1, 'no duplicate note');
  assert.equal(twenty.db.opportunities.length, 1);
  assert.deepEqual(twenty.db.noteTargets.map(t => (t.opportunityId ? 'opportunity' : 'person')).sort(), ['opportunity', 'person'], 'no duplicate link');
  assert.equal(twenty.requests.filter(r => r.method === 'POST' && r.path === '/rest/notes').length, 1);
});

test('retry only touches selected, non-synced leads; synced leads are skipped by the guard', async () => {
  const rows = [
    leadRow({ id: 'a0000000-0000-4000-8000-000000000001', crm_status: 'synced' }),
    leadRow({ id: 'a0000000-0000-4000-8000-000000000002', crm_status: 'error', contact_email: 'b@example.com', contact_whatsapp: '' }),
    leadRow({ id: 'a0000000-0000-4000-8000-000000000004', crm_status: 'error', contact_email: 'c@example.com', contact_whatsapp: '' }),
  ];
  const { twenty, items, runner, retry } = await harness(rows);
  await retry(rows.slice(0, 2).map(r => r.id));
  assert.deepEqual(items.leads.map(r => r.crm_status), ['synced', 'synced', 'error'], 'unselected lead untouched');
  assert.equal(twenty.db.people.length, 1);
  // Directly triggering the core flow for an already-synced lead is a no-op.
  const posts = twenty.requests.filter(r => r.method === 'POST').length;
  assert.equal(posts, 5, 'person + opportunity + note + 2 targets for the single retried lead');
  const before = twenty.requests.length;
  await runner.runFlow(stableId('flow:core'), { id: rows[0].id });
  assert.equal(twenty.requests.length, before, 'guard stops before any Twenty call');
  assert.deepEqual(runner.runs.at(-1).steps, ['read_lead:ok', 'guard:fail']);
});

test('missing TWENTY env (not in FLOWS_ENV_ALLOW_LIST) fails safely into crm_status=error', async () => {
  const { memory } = await installed(await fixture(), config, { activate: true });
  const items = { leads: [leadRow()] };
  const runner = createFlowRunner({ flows: memory.state.flows, operations: memory.state.operations, items, fetcher: (url) => { new URL(url); throw new Error('unreachable'); }, env: {} });
  await runner.runFlow(memory.state.flows.find(f => f.name === flowNames.event).id, { key: items.leads[0].id, payload: { area: 'legal' } });
  assert.equal(items.leads[0].crm_status, 'error');
  assert.equal(items.leads[0].crm_error, 'find_person: error TypeError');
});

test('CLI: fixture simulation converges; real runs need env token and --backup-done; bad args rejected', async () => {
  const lines = [];
  const report = await runFlowsCli(['--fixture', fixturePath.pathname, '--apply', '--json', '--notify-legal', LEGAL_USER], { env: {}, stdout: line => lines.push(line) });
  assert.equal(report.mode, 'simulate');
  assert.equal(report.secondRun, 0);
  assert.equal(report.deleteRequests, 0);
  const noNetwork = () => { throw new Error('network must not run'); };
  await assert.rejects(runFlowsCli([], { env: {}, fetcher: noNetwork, stdout: silent }), /DIRECTUS_ADMIN_TOKEN/);
  await assert.rejects(runFlowsCli(['--apply'], { env: { DIRECTUS_ADMIN_TOKEN: 'x', DIRECTUS_URL: 'https://cms.example.test' }, fetcher: noNetwork, stdout: silent }), /--backup-done/);
  await assert.rejects(runFlowsCli(['--notify-data'], { env: {}, stdout: silent }), /Uso/);
  await assert.rejects(runFlowsCli(['--fixture', fixturePath.pathname, '--notify-data', 'henry'], { env: {}, stdout: silent }), /UUID/);
});

test('CLI dry-run against a live-like API only issues GETs and never prints the token', async () => {
  const memory = createMemoryDirectus(await fixture());
  const seen = [];
  const fetcher = (url, init) => { seen.push(init.method); return memory.fetcher(url, init); };
  const lines = [];
  const report = await runFlowsCli([], { env: { DIRECTUS_ADMIN_TOKEN: 'secret-token-value', DIRECTUS_URL: 'https://cms.example.test' }, fetcher, stdout: line => lines.push(line) });
  assert.equal(report.mode, 'dry-run');
  assert.ok(seen.every(method => method === 'GET'));
  assert.ok(!lines.join('\n').includes('secret-token-value'));
});

test('B3: active Flows being rewired are paused first and re-activated even when apply fails midway', async () => {
  const { memory, client } = await installed(await fixture(), config, { activate: true });
  const core = memory.state.flows.find(f => f.name === flowNames.core);
  memory.state.operations.find(o => o.flow === core.id && o.key === 'build').options.code = '// drift';
  const byKey = key => memory.state.operations.find(o => o.flow === core.id && o.key === key);
  const [a, b] = [byKey('opp'), byKey('save_opp')];
  [a.resolve, b.resolve] = [b.resolve, a.resolve];
  const plan = planFlows(await readFlowState(client), config);
  const kinds = plan.ops.map(op => op.kind);
  assert.equal(kinds[0], 'flow-pause');
  assert.equal(kinds.at(-1), 'flow-resume');
  assert.ok(kinds.indexOf('flow-pause') < kinds.indexOf('operation-unlink'));
  assert.deepEqual(plan.ops.filter(op => op.kind === 'flow-pause').map(op => op.path), [`flows/${core.id}`], 'only the touched Flow is paused');
  assert.ok(plan.warnings.some(w => /se pausan 1 Flow/.test(w)));

  // Fail on the first operation update: the Flow must still end up active.
  const failing = createClient({ baseUrl: 'http://localhost:8055', fetcher: (url, init) => (init.method === 'PATCH' && /\/operations\//.test(String(url)) && init.body && !init.body.includes('"resolve":null,"reject":null')
    ? Promise.resolve(new Response(JSON.stringify({ errors: [{ message: 'boom' }] }), { status: 500 }))
    : memory.fetcher(url, init)) });
  await assert.rejects(applyFlowPlan(failing, plan.ops, silent), /HTTP 500/);
  assert.equal(memory.state.flows.find(f => f.id === core.id).status, 'active', 're-activated in finally');
  // A clean re-run converges.
  await applyFlowPlan(client, planFlows(await readFlowState(client), config).ops, silent);
  assert.deepEqual(planFlows(await readFlowState(client), config).ops, []);
  assert.ok(memory.state.flows.filter(f => Object.values(flowNames).includes(f.name)).every(f => f.status === 'active'));
});

test('B3: inactive Flows are never paused nor re-activated by a plain apply', async () => {
  const { memory, client } = await installed(await fixture());
  const core = memory.state.flows.find(f => f.name === flowNames.core);
  memory.state.operations.find(o => o.flow === core.id && o.key === 'build').options.code = '// drift';
  const plan = planFlows(await readFlowState(client), config);
  assert.ok(!plan.ops.some(op => ['flow-pause', 'flow-resume'].includes(op.kind)));
  await applyFlowPlan(client, plan.ops, silent);
  assert.equal(memory.state.flows.find(f => f.id === core.id).status, 'inactive');
});
