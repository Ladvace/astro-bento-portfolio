import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { planFlows, readFlowState, runFlowsCli, desiredFlows, flowNames, stableId } from '../scripts/directus-flows.mjs';
import { createClient, applyPlan } from '../scripts/directus-schema.mjs';
import { createMemoryDirectus } from '../scripts/directus-memory.mjs';
import { crmConfigFromEnv } from '../scripts/crm-mapping.mjs';
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

test('fixture dry-run plans the four flows, inactive by default, without touching the build flow', async () => {
  const { ops, warnings } = planFlows(await fixture(), config);
  const flows = ops.filter(op => op.kind === 'flow').map(op => op.body);
  assert.deepEqual(flows.map(f => f.name), Object.values(flowNames));
  assert.ok(flows.every(f => f.status === 'inactive'));
  assert.deepEqual(flows.find(f => f.name === 'Lead → Twenty').options, { type: 'action', scope: ['items.create'], collections: ['leads'] });
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
  assert.equal(memory.state.flows.length, 5);
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

test('notification ops are omitted when no Directus users are configured', () => {
  const flows = desiredFlows(crmConfigFromEnv({}));
  const event = flows.find(f => f.key === 'event');
  assert.deepEqual(event.operations.map(o => o.key), ['sync', 'mail_disabled']);
  assert.equal(stableId('x'), stableId('x'));
  assert.match(stableId('x'), /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

// ---------------------------------------------------------------------------------------------
// End-to-end wiring against a mock Twenty (approximate Directus semantics, see helpers/flow-runner)
// ---------------------------------------------------------------------------------------------
const leadRow = (extra = {}) => ({
  id: '22222222-2222-4222-8222-222222222222', date_created: '2026-11-06T15:00:00.000Z', name: 'Ana Pérez Gómez', area: 'legal',
  message: 'Hola', contact_whatsapp: '+57 300 123 4567', contact_email: 'ana@example.com', locale: 'es', consent: true,
  page: '/es/', utm_source: null, utm_medium: null, utm_campaign: null, crm_status: 'pending', twenty_person_id: null, twenty_opportunity_id: null, ...extra,
});

async function harness(rows = [leadRow()]) {
  const { memory } = await installed(await fixture(), config, { activate: true });
  const twenty = createMockTwenty();
  const items = { leads: rows };
  const runner = createFlowRunner({
    flows: memory.state.flows, operations: memory.state.operations, items, fetcher: twenty.fetcher,
    env: { TWENTY_BASE_URL: 'http://twenty-server:3000', TWENTY_API_KEY: 'test-twenty-key' },
  });
  const flowId = name => memory.state.flows.find(f => f.name === name).id;
  const created = lead => runner.runFlow(flowId(flowNames.event), { event: 'leads.items.create', collection: 'leads', key: lead.id, payload: { area: lead.area, name: lead.name } });
  const retry = keys => runner.runFlow(flowId(flowNames.retry), { body: { collection: 'leads', keys } });
  return { twenty, items, runner, created, retry };
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
  assert.deepEqual({ ...opp, id: undefined }, { id: undefined, name: 'Web · Legal · Ana Pérez Gómez', stage: 'NEW', area: 'LEGAL', source: 'WEB', locale: 'es', pointOfContactId: lead.twenty_person_id });
  assert.equal(twenty.db.notes.length, 1);
  assert.deepEqual(twenty.db.noteTargets.map(t => Object.keys(t).sort()), [['id', 'noteId', 'opportunityId'], ['id', 'noteId', 'personId']]);
  assert.ok(twenty.requests.every(r => r.auth === 'Bearer test-twenty-key'));
  assert.deepEqual(runner.notifications.map(n => n.recipient), [[LEGAL_USER]]);
  assert.equal(runner.notifications[0].subject, 'Nuevo lead web · Legal');
});

test('existing person (same email) is reused, not duplicated; data leads notify the data user', async () => {
  const { twenty, items, runner, created } = await harness([leadRow({ area: 'data' })]);
  twenty.db.people.push({ id: '99999999-9999-4999-8999-999999999999', name: { firstName: 'Ana', lastName: 'P' }, emails: { primaryEmail: 'ana@example.com' } });
  await created(items.leads[0]);
  assert.equal(items.leads[0].crm_status, 'synced');
  assert.equal(twenty.db.people.length, 1);
  assert.equal(twenty.db.opportunities[0].pointOfContactId, '99999999-9999-4999-8999-999999999999');
  assert.equal(twenty.db.opportunities[0].area, 'DATA');
  assert.deepEqual(runner.notifications.map(n => n.recipient), [[DATA_USER]]);
});

test('Twenty 500 on opportunity: lead kept with error (no PII), person id saved; retry completes without duplicates', async () => {
  const { twenty, items, runner, created, retry } = await harness();
  twenty.fail('POST', '/rest/opportunities', { body: { statusCode: 500, messages: ['insert failed for ana@example.com'] } });
  await created(items.leads[0]);
  const [lead] = items.leads;
  assert.equal(lead.crm_status, 'error');
  assert.equal(lead.crm_error, 'ensure_opp: HTTP 500 — insert failed for [correo]');
  assert.equal(lead.twenty_person_id, twenty.db.people[0].id);
  assert.equal(runner.notifications.length, 1, 'notification still sent when CRM fails');

  await retry([lead.id]);
  assert.equal(lead.crm_status, 'synced');
  assert.equal(lead.crm_error, null);
  assert.equal(twenty.db.people.length, 1);
  assert.equal(twenty.db.opportunities.length, 1);
  assert.equal(twenty.db.notes.length, 1);
});

test('network failure / timeout on search marks error; retry after a later failure reuses the saved opportunity', async () => {
  const { twenty, items, created, retry } = await harness();
  twenty.fail('GET', '/rest/people', { network: true });
  await created(items.leads[0]);
  assert.equal(items.leads[0].crm_status, 'error');
  assert.equal(items.leads[0].crm_error, 'find_person: error — fetch failed');
  assert.equal(twenty.db.people.length, 0);

  twenty.fail('POST', '/rest/noteTargets', { status: 503 });
  await retry([items.leads[0].id]);
  assert.equal(items.leads[0].crm_status, 'error');
  assert.match(items.leads[0].crm_error, /^target_opp: HTTP 503/);
  assert.ok(items.leads[0].twenty_opportunity_id);

  await retry([items.leads[0].id]);
  assert.equal(items.leads[0].crm_status, 'synced');
  assert.equal(twenty.db.people.length, 1);
  assert.equal(twenty.db.opportunities.length, 1, 'opportunity reused through twenty_opportunity_id');
  assert.equal(twenty.db.notes.length, 2, 'known limitation: a note whose targets failed is recreated');
});

test('retry only touches selected leads in crm_status=error; synced leads are skipped by the guard', async () => {
  const rows = [
    leadRow({ id: 'a0000000-0000-4000-8000-000000000001', crm_status: 'synced' }),
    leadRow({ id: 'a0000000-0000-4000-8000-000000000002', crm_status: 'pending' }),
    leadRow({ id: 'a0000000-0000-4000-8000-000000000003', crm_status: 'error', contact_email: 'b@example.com' }),
  ];
  const { twenty, items, runner, retry } = await harness(rows);
  await retry(rows.map(r => r.id));
  assert.deepEqual(items.leads.map(r => r.crm_status), ['synced', 'pending', 'synced']);
  assert.equal(twenty.db.people.length, 1);
  // Directly triggering the core flow for an already-synced lead is a no-op.
  const posts = twenty.requests.filter(r => r.method === 'POST').length;
  assert.equal(posts, 5, 'person + opportunity + note + 2 targets for the single error lead');
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
  assert.match(items.leads[0].crm_error, /^find_person: error — /);
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
