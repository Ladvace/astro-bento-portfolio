import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { websiteCollections } from '../src/lib/website-model.mjs';
import { createCollectionSchema, leadsSchema, leadWriterFields, leadWriterPermissions, editorLegalPermissions, publicFields, accessModel, websiteFolder, publicFilesPermission, publicFileFields } from '../scripts/website-schema.mjs';
import { planChanges, runSchemaCli, createClient, readState, applyPlan } from '../scripts/directus-schema.mjs';
import { createMemoryDirectus } from '../scripts/directus-memory.mjs';

const fixturePath = new URL('./fixtures/directus-state.json', import.meta.url);
const fixture = async () => JSON.parse(await readFile(fixturePath, 'utf8'));
const memoryClient = state => { const memory = createMemoryDirectus(state); return { memory, client: createClient({ baseUrl: 'http://localhost:8055', fetcher: memory.fetcher }) }; };
const silent = () => {};

test('repeatable collections get UUID keys, editable locale/status, drag sort and no stable-ID metadata', () => {
  for (const definition of websiteCollections.filter(item => item.repeatable)) {
    const schema = createCollectionSchema(definition);
    const field = key => schema.fields.find(item => item.field === key);
    assert.equal(field('id').type, 'uuid');
    assert.deepEqual(field('id').meta.special, ['uuid']);
    assert.equal(field('id').schema.is_primary_key, true);
    assert.deepEqual(field('locale').meta.options.choices.map(c => c.value), ['es', 'en']);
    assert.equal(field('status').schema.default_value, 'draft');
    assert.equal(field('sort').type, 'integer');
    assert.equal(schema.meta.sort_field, 'sort');
    assert.equal(field('record_label'), undefined);
    assert.equal(field('key'), undefined);
    assert.deepEqual(publicFields(definition).slice(0, 4), ['id', 'status', 'locale', 'sort']);
  }
  const faqArea = createCollectionSchema(websiteCollections.find(item => item.alias === 'faq')).fields.find(f => f.field === 'area');
  assert.deepEqual(faqArea.meta.options.choices.map(c => c.value), ['legal', 'data', 'general']);
});

test('leads schema holds every required field with safe defaults', () => {
  const byKey = Object.fromEntries(leadsSchema.fields.map(field => [field.field, field]));
  for (const key of ['id', 'name', 'area', 'message', 'contact_whatsapp', 'contact_email', 'locale', 'consent', 'consent_text', 'page', 'utm_source', 'utm_medium', 'utm_campaign', 'ga_client_id', 'status', 'crm_status', 'twenty_person_id', 'twenty_opportunity_id', 'twenty_note_id', 'crm_error', 'date_created']) assert.ok(byKey[key], key);
  assert.equal(byKey.twenty_note_id.meta.readonly, true);
  assert.equal(byKey.twenty_note_id.type, 'string');
  assert.equal(byKey.status.schema.default_value, 'nuevo');
  assert.deepEqual(byKey.status.meta.options.choices.map(c => c.value), ['nuevo', 'contactado', 'descartado']);
  assert.equal(byKey.crm_status.schema.default_value, 'pending');
  assert.deepEqual(byKey.crm_status.meta.options.choices.map(c => c.value), ['pending', 'synced', 'error']);
  assert.equal(byKey.consent.type, 'boolean');
  assert.deepEqual(byKey.date_created.meta.special, ['date-created']);
  assert.deepEqual(byKey.area.meta.options.choices.map(c => c.value), ['legal', 'data']);
});

test('lead writer may only create leads with explicit, non-workflow fields', () => {
  const permissions = leadWriterPermissions('writer');
  assert.equal(permissions.length, 1);
  const [permission] = permissions;
  assert.equal(permission.action, 'create');
  assert.equal(permission.collection, 'leads');
  assert.deepEqual(permission.fields, leadWriterFields);
  assert.ok(!permission.fields.includes('*'));
  for (const forbidden of ['id', 'status', 'crm_status', 'crm_error', 'twenty_person_id', 'twenty_opportunity_id', 'twenty_note_id', 'date_created']) assert.ok(!permission.fields.includes(forbidden), forbidden);
  assert.deepEqual(permission.validation, { _and: [{ consent: { _eq: true } }, { area: { _in: ['legal', 'data'] } }] });
  assert.equal(accessModel.leadWriter.policy.app_access, false);
  assert.equal(accessModel.leadWriter.policy.admin_access, false);
});

test('legal editor is scoped to legal rows and cannot touch CRM fields or delete leads', () => {
  const permissions = editorLegalPermissions('legal');
  const find = (collection, action) => permissions.find(p => p.collection === collection && p.action === action);
  assert.deepEqual(find('leads', 'read').permissions, { area: { _eq: 'legal' } });
  assert.deepEqual(find('leads', 'update').permissions, { area: { _eq: 'legal' } });
  assert.deepEqual(find('leads', 'update').fields, ['status']);
  assert.equal(find('leads', 'create'), undefined);
  assert.equal(find('leads', 'delete'), undefined);
  assert.deepEqual(find('website_practices', 'update').permissions, { key: { _eq: 'legal' } });
  assert.deepEqual(find('website_people', 'update').permissions, { key: { _eq: 'tatiana' } });
  for (const action of ['create', 'update']) assert.deepEqual(find('website_faq', action).validation, { area: { _eq: 'legal' } });
  assert.deepEqual(find('website_faq', 'delete').permissions, { area: { _eq: 'legal' } });
  for (const collection of ['website_globals', 'website_common', 'website_home', 'website_practices', 'website_people', 'website_steps']) {
    assert.equal(find(collection, 'create'), undefined, collection);
    assert.equal(find(collection, 'delete'), undefined, collection);
  }
  assert.deepEqual(find('website_globals', 'update').fields, ['legal_whatsapp']);
  assert.equal(accessModel.editorLegal.policy.admin_access, false);
});

test('B6: the legal editor can only create/edit DRAFT legal testimonials (an admin publishes)', () => {
  const permissions = editorLegalPermissions('legal', 'folder-1');
  const find = (collection, action) => permissions.find(p => p.collection === collection && p.action === action);
  const legalDraft = { _and: [{ area: { _eq: 'legal' } }, { status: { _eq: 'draft' } }] };
  assert.deepEqual(find('website_testimonials', 'create').validation, legalDraft);
  assert.deepEqual(find('website_testimonials', 'update').permissions, legalDraft, 'published rows are not editable');
  assert.deepEqual(find('website_testimonials', 'update').validation, legalDraft, 'cannot switch to published');
  assert.deepEqual(find('website_testimonials', 'delete').permissions, { area: { _eq: 'legal' } }, 'can still withdraw one');
  assert.deepEqual(find('website_faq', 'update').validation, { area: { _eq: 'legal' } }, 'FAQ unchanged');
});

test('B4/M7: files are readable only in the "website" folder (public) or folder + own uploads (editor)', () => {
  const editor = editorLegalPermissions('legal', 'folder-1').filter(p => p.collection === 'directus_files');
  assert.deepEqual(editor.find(p => p.action === 'read').permissions, { _or: [{ folder: { _eq: 'folder-1' } }, { uploaded_by: { _eq: '$CURRENT_USER' } }] });
  assert.deepEqual(editor.find(p => p.action === 'update').permissions, { uploaded_by: { _eq: '$CURRENT_USER' } });
  assert.equal(editor.find(p => p.action === 'delete'), undefined);
  const pub = publicFilesPermission('pub', 'folder-1');
  assert.deepEqual(pub, { collection: 'directus_files', policy: 'pub', action: 'read', permissions: { folder: { _eq: 'folder-1' } }, fields: ['id', 'type', 'filename_download', 'width', 'height', 'title'], validation: null, presets: null });
  assert.deepEqual(publicFileFields, pub.fields);
  assert.equal(websiteFolder.name, 'website');
});

test('new landing keys exist in ES/EN defaults, are optional and publicly readable', () => {
  const home = websiteCollections.find(c => c.alias === 'home');
  const keys = ['form_message_hint', 'form_error_name', 'form_error_message_length', 'form_error_contact', 'consent_preferences_label'];
  for (const key of keys) {
    const descriptor = home.fields.find(f => f.key === key);
    assert.ok(descriptor, key);
    assert.equal(descriptor.required, false, key);
    assert.ok(publicFields(home).includes(key), `${key} public`);
    for (const row of home.records) assert.ok(typeof row[key] === 'string' && row[key].trim(), `${row.locale}.${key}`);
  }
  const es = home.records.find(r => r.locale === 'es');
  const en = home.records.find(r => r.locale === 'en');
  assert.equal(es.form_message_hint, 'No incluyas datos sensibles (salud, antecedentes, documentos). Te pediremos lo necesario después.');
  assert.equal(es.consent_preferences_label, 'Preferencias de cookies');
  assert.equal(en.consent_preferences_label, 'Cookie preferences');
});

test('dry-run against the pre-migration fixture plans additive changes only', async () => {
  const { ops, warnings } = planChanges(await fixture());
  assert.deepEqual(warnings, ['La política editor-legal se crea sin exigir 2FA: active "Require 2FA" (enforce_tfa) a mano cuando Tatiana tenga su app de autenticación (docs/cms-editing.md)']);
  const folder = ops.find(op => op.kind === 'folder');
  assert.deepEqual(folder.body, { id: websiteFolder.id, name: 'website', parent: null });
  assert.ok(ops.indexOf(folder) < ops.findIndex(op => op.kind === 'permission'));
  assert.ok(ops.length > 0);
  assert.ok(ops.every(op => ['POST', 'PATCH'].includes(op.method)));
  const collections = ops.filter(op => op.kind === 'collection').map(op => op.body.collection);
  assert.deepEqual(collections, ['website_faq', 'website_steps', 'website_testimonials', 'leads']);
  assert.ok(ops.some(op => op.kind === 'field' && op.body.field === 'legal_whatsapp'));
  assert.ok(!ops.some(op => op.path.includes('experience') || op.body?.collection === 'experience' || op.body?.collection === 'projects'));
  // Public reads are created for the new collections, never for leads.
  const publicCreates = ops.filter(op => op.kind === 'permission' && op.body.policy === 'abf8a154-5b1c-4a46-ac9c-7300570f4f17');
  assert.deepEqual(publicCreates.map(op => op.body.collection), ['website_faq', 'website_steps', 'website_testimonials', 'directus_files']);
  assert.ok(publicCreates.filter(op => op.body.collection !== 'directus_files').every(op => op.body.action === 'read' && op.body.permissions.status._eq === 'published'));
  assert.deepEqual(publicCreates.at(-1).body.permissions, { folder: { _eq: websiteFolder.id } });
  // Existing public reads are widened by union so the build can read the new fields.
  const widened = ops.filter(op => op.kind === 'permission-fields');
  assert.equal(widened.length, 5);
  const flow = ops.find(op => op.kind === 'flow');
  assert.deepEqual(flow.body.options.collections.slice(-3), ['website_faq', 'website_steps', 'website_testimonials']);
  assert.ok(!flow.body.options.collections.includes('leads'));
  assert.deepEqual(flow.body.options.scope, ['items.create', 'items.update', 'items.delete']);
  assert.equal(ops.at(-1).kind, 'flow');
});

test('applying the plan in memory converges: the second run plans 0 changes and nothing is deleted', async () => {
  for (const seed of [false, true]) {
    const { memory, client } = memoryClient(await fixture());
    const first = planChanges(await readState(client, { seed }), { seed });
    await applyPlan(client, first.ops, silent);
    const second = planChanges(await readState(client, { seed }), { seed });
    assert.deepEqual(second.ops, [], `seed=${seed}`);
    assert.equal(memory.requests.filter(r => !['GET', 'POST', 'PATCH'].includes(r.method)).length, 0);
    assert.ok(memory.state.collections.some(c => c.collection === 'experience'));
    assert.ok(!memory.state.permissions.some(p => p.collection === 'leads' && p.policy === 'abf8a154-5b1c-4a46-ac9c-7300570f4f17'));
    if (seed) assert.equal(memory.state.items.website_faq.length, 8);
  }
});

test('existing policies are reused by name, wildcard fields are untouched and drift is only reported', async () => {
  const state = await fixture();
  state.policies.push({ id: 'existing-writer', name: 'website-lead-writer' });
  const pub = state.permissions.find(p => p.collection === 'website_home');
  pub.fields = ['*'];
  pub.permissions = {};
  state.flows[0].options.collections.push('leads');
  state.permissions.push({ id: 999, policy: state.policies[0].id, collection: 'leads', action: 'read', fields: ['*'], permissions: {} });
  const { ops, warnings } = planChanges(state);
  assert.ok(!ops.some(op => op.kind === 'policy' && op.body.name === 'website-lead-writer'));
  assert.equal(ops.find(op => op.kind === 'permission' && op.body.collection === 'leads' && op.body.action === 'create').body.policy, 'existing-writer');
  assert.ok(!ops.some(op => op.path === `permissions/${pub.id}`));
  assert.ok(warnings.some(w => /read website_home \[public\].*filtro/.test(w)));
  assert.ok(warnings.some(w => /Flow.*incluye leads/.test(w)));
  assert.ok(warnings.some(w => /pública tiene read sobre leads/.test(w)));
  assert.ok(!ops.some(op => op.method === 'DELETE'));
});

test('missing flow is a warning, not a write', async () => {
  const state = await fixture();
  state.flows = [];
  const { ops, warnings } = planChanges(state);
  assert.ok(!ops.some(op => op.kind === 'flow'));
  assert.ok(warnings.some(w => /No existe el Flow/.test(w)));
});

test('CLI: fixture simulation reports a converged second run; real runs need env token and backup flag', async () => {
  const lines = [];
  const report = await runSchemaCli(['--fixture', fixturePath.pathname, '--apply', '--json'], { env: {}, stdout: line => lines.push(line) });
  assert.equal(report.mode, 'simulate');
  assert.ok(report.ops.length > 0);
  assert.equal(report.secondRun, 0);
  assert.equal(report.deleteRequests, 0);
  const noNetwork = () => { throw new Error('network must not run'); };
  await assert.rejects(runSchemaCli([], { env: {}, fetcher: noNetwork, stdout: silent }), /DIRECTUS_ADMIN_TOKEN/);
  await assert.rejects(runSchemaCli(['--apply'], { env: { DIRECTUS_ADMIN_TOKEN: 'x', DIRECTUS_URL: 'https://cms.example.test' }, fetcher: noNetwork, stdout: silent }), /--backup-done/);
  await assert.rejects(runSchemaCli([], { env: { DIRECTUS_ADMIN_TOKEN: 'x', DIRECTUS_URL: 'http://cms.example.test' }, fetcher: noNetwork, stdout: silent }), /DIRECTUS_URL requiere HTTPS/);
  await assert.rejects(runSchemaCli(['--delete'], { env: {}, stdout: silent }), /Uso/);
});

test('CLI dry-run against a live-like API only issues GETs and never prints the token', async () => {
  const memory = createMemoryDirectus(await fixture());
  const seen = [];
  const fetcher = (url, init) => { seen.push({ method: init.method, auth: init.headers.Authorization }); return memory.fetcher(url, init); };
  const lines = [];
  const report = await runSchemaCli(['--seed'], { env: { DIRECTUS_ADMIN_TOKEN: 'secret-token-value', DIRECTUS_URL: 'https://cms.example.test' }, fetcher, stdout: line => lines.push(line) });
  assert.equal(report.mode, 'dry-run');
  assert.ok(seen.every(r => r.method === 'GET' && r.auth === 'Bearer secret-token-value'));
  assert.ok(!lines.join('\n').includes('secret-token-value'));
});

test('an existing "website" folder is reused; an unfiltered public file read is reported as NARROW, never changed', async () => {
  const state = await fixture();
  state.folders = [{ id: 'existing-folder', name: 'website', parent: null }];
  const pub = state.policies.find(p => p.name === '$t:public_label').id;
  state.permissions.push({ id: 500, policy: pub, collection: 'directus_files', action: 'read', fields: ['*'], permissions: null });
  state.policies.push({ id: 'ed', name: 'editor-legal', enforce_tfa: true });
  const { ops, warnings } = planChanges(state);
  assert.ok(!ops.some(op => op.kind === 'folder'));
  assert.ok(!ops.some(op => op.path === 'permissions/500'));
  assert.ok(warnings.some(w => /^NARROW pendiente \(no aplicado\): read directus_files \[public\]/.test(w)));
  assert.ok(!warnings.some(w => /2FA/.test(w)));
  const editorRead = ops.find(op => op.kind === 'permission' && op.body.collection === 'directus_files' && op.body.action === 'read');
  assert.deepEqual(editorRead.body.permissions._or[0], { folder: { _eq: 'existing-folder' } });
});
