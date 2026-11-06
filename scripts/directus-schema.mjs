/**
 * Idempotent Directus migration for the ROMA landing: website_* fields and collections, private
 * `leads` inbox, least-privilege policies/roles and the "Trigger Coolify Build" flow scope.
 *
 *   node scripts/directus-schema.mjs                       # dry-run against DIRECTUS_URL (read-only GETs)
 *   node scripts/directus-schema.mjs --fixture FILE        # dry-run against a local JSON state, no network
 *   node scripts/directus-schema.mjs --fixture FILE --apply  # simulate: apply in memory, then re-plan (must be 0)
 *   node scripts/directus-schema.mjs --apply --backup-done # REAL write (only after `directus schema snapshot`)
 *   add --seed to also create missing website items / fill NULL fields from website-defaults.json
 *
 * Rules: diff against the current state, create only what is missing, widen field lists by union,
 * never delete, never narrow, never rewrite existing filters (differences are reported as warnings).
 * Secrets come only from env (DIRECTUS_ADMIN_TOKEN) and are never printed.
 */
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { websiteCollections } from '../src/lib/website-model.mjs';
import {
  websiteSchemas, websiteRelations, leadsSchema, publicReadPermission, accessModel,
  leadWriterPermissions, editorLegalPermissions, buildFlowName, buildFlowCollections, neverBuildCollections,
  websiteFolder, publicFilesPermission,
} from './website-schema.mjs';
import { cmsBase } from './content.mjs';
import { createMemoryDirectus } from './directus-memory.mjs';

const PUBLIC_POLICY_NAME = '$t:public_label';
const usage = 'Uso: directus-schema.mjs [--fixture FILE] [--seed] [--json] [--apply [--backup-done]]';

// ---------------------------------------------------------------------------------------------
// Transport
// ---------------------------------------------------------------------------------------------
export function createClient({ baseUrl, token, fetcher = globalThis.fetch, timeoutMs = 30000 }) {
  async function request(method, path, body) {
    let response;
    try {
      response = await fetcher(new URL(path, `${baseUrl}/`).href, {
        method,
        headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
        redirect: 'error', signal: AbortSignal.timeout(timeoutMs),
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    } catch {
      throw new Error(`Directus: error de red o tiempo agotado en ${method} ${path.split('?')[0]}`);
    }
    if (!response.ok) {
      let detail = '';
      try { detail = String((await response.json())?.errors?.[0]?.message ?? '').slice(0, 200); } catch { /* opaque body */ }
      throw Object.assign(new Error(`Directus: HTTP ${response.status} en ${method} ${path.split('?')[0]}${detail ? ` (${detail})` : ''}`), { status: response.status });
    }
    if (response.status === 204) return null;
    return (await response.json())?.data ?? null;
  }
  return { request };
}

// ---------------------------------------------------------------------------------------------
// Desired state (pure)
// ---------------------------------------------------------------------------------------------
export const desiredCollections = [...websiteSchemas, leadsSchema];

export async function readState(client, { seed = false } = {}) {
  const get = path => client.request('GET', path);
  const [collections, fields, relations, policies, roles, access, permissions, flows, folders] = await Promise.all([
    get('collections?limit=-1'), get('fields?limit=-1'), get('relations?limit=-1'),
    get('policies?limit=-1&fields=id,name,enforce_tfa'), get('roles?limit=-1&fields=id,name'), get('access?limit=-1&fields=id,role,policy,user'),
    get('permissions?limit=-1'), get('flows?limit=-1&fields=id,name,status,trigger,options'), get('folders?limit=-1&fields=id,name,parent'),
  ]);
  const state = { collections, fields, relations, policies, roles, access, permissions, flows, folders, items: {} };
  if (seed) {
    for (const definition of websiteCollections) {
      if (!collections.some(c => c.collection === definition.collection)) continue;
      const data = await get(`items/${definition.collection}?limit=-1&fields=*`);
      state.items[definition.collection] = definition.singleton ? (data ? [data] : []) : data ?? [];
    }
  }
  return state;
}

const sameJson = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const emptyFilter = value => value === null || value === undefined || (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0);
const sameFilter = (a, b) => (emptyFilter(a) && emptyFilter(b)) || sameJson(a, b);

/**
 * Pure diff: returns the ordered operations needed to reach the desired state and warnings for
 * drift that the script deliberately does not touch.
 */
export function planChanges(current, { seed = false, publicPolicyId } = {}) {
  const ops = [];
  const warnings = [];
  const op = (kind, summary, method, path, body) => ops.push({ kind, summary, method, path, body });
  const hasCollection = name => current.collections.some(c => c.collection === name);

  // 1. Collections and fields (additive).
  for (const schema of desiredCollections) {
    if (!hasCollection(schema.collection)) {
      op('collection', `crear colección ${schema.collection} (${schema.fields.length} campos)`, 'POST', 'collections', schema);
      continue;
    }
    for (const field of schema.fields) {
      const existing = current.fields.find(f => f.collection === schema.collection && f.field === field.field);
      if (!existing) op('field', `crear campo ${schema.collection}.${field.field} (${field.type})`, 'POST', `fields/${schema.collection}`, field);
      else if (existing.type !== field.type) warnings.push(`${schema.collection}.${field.field}: tipo actual ${existing.type}, esperado ${field.type}; no se modifica`);
    }
  }
  // 2. Relations (file fields).
  for (const relation of websiteRelations) {
    if (!current.relations.some(r => r.collection === relation.collection && r.field === relation.field)) {
      op('relation', `crear relación ${relation.collection}.${relation.field} → ${relation.related_collection}`, 'POST', 'relations', relation);
    }
  }
  // 3. Policies, roles and role↔policy access.
  const policyIds = {};
  for (const [key, { policy, role }] of Object.entries(accessModel)) {
    const existingPolicy = current.policies.find(p => p.name === policy.name);
    policyIds[key] = existingPolicy?.id ?? policy.id;
    if (!existingPolicy) op('policy', `crear política ${policy.name}`, 'POST', 'policies', policy);
    const existingRole = current.roles.find(r => r.name === role.name);
    const roleId = existingRole?.id ?? role.id;
    if (!existingRole) op('role', `crear rol ${role.name}`, 'POST', 'roles', role);
    if (!current.access.some(a => a.role === roleId && a.policy === policyIds[key])) {
      op('access', `vincular rol ${role.name} ↔ política ${policy.name}`, 'POST', 'access', { role: roleId, policy: policyIds[key] });
    }
  }
  const editorPolicy = current.policies.find(p => p.name === accessModel.editorLegal.policy.name);
  if (!editorPolicy?.enforce_tfa) warnings.push(`La política ${accessModel.editorLegal.policy.name} ${editorPolicy ? 'no exige' : 'se crea sin exigir'} 2FA: active "Require 2FA" (enforce_tfa) a mano cuando Tatiana tenga su app de autenticación (docs/cms-editing.md)`);
  // 3b. Media folder "website" (root). Existing folder with that name wins.
  const folders = current.folders ?? [];
  const existingFolders = folders.filter(f => f.name === websiteFolder.name && !f.parent);
  if (existingFolders.length > 1) warnings.push(`Hay ${existingFolders.length} carpetas "${websiteFolder.name}" en la raíz: se usa la primera; revise duplicados a mano`);
  const folderId = existingFolders[0]?.id ?? websiteFolder.id;
  if (!existingFolders.length) op('folder', `crear carpeta de archivos "${websiteFolder.name}" (fotos públicas de la web)`, 'POST', 'folders', { ...websiteFolder });
  // 4. Permissions.
  const publicId = publicPolicyId
    ?? current.policies.find(p => p.name === PUBLIC_POLICY_NAME)?.id
    ?? current.access.find(a => a.role === null && a.user === null)?.policy;
  const desired = [
    ...(publicId ? websiteCollections.map(definition => publicReadPermission(definition, publicId)) : []),
    ...(publicId ? [publicFilesPermission(publicId, folderId)] : []),
    ...leadWriterPermissions(policyIds.leadWriter),
    ...editorLegalPermissions(policyIds.editorLegal, folderId),
  ];
  if (!publicId) warnings.push('No se encontró la política pública: no se planifican lecturas públicas de website_*');
  for (const permission of desired) {
    const label = `${permission.action} ${permission.collection} [${permission.policy === publicId ? 'public' : Object.entries(policyIds).find(([, id]) => id === permission.policy)?.[0]}]`;
    const existing = current.permissions.find(p => p.policy === permission.policy && p.collection === permission.collection && p.action === permission.action);
    if (!existing) { op('permission', `crear permiso ${label}`, 'POST', 'permissions', permission); continue; }
    const have = Array.isArray(existing.fields) ? existing.fields : typeof existing.fields === 'string' ? existing.fields.split(',') : [];
    if (!have.includes('*')) {
      const missing = permission.fields.filter(f => !have.includes(f));
      if (missing.length) op('permission-fields', `ampliar campos de ${label}: +${missing.join(', +')}`, 'PATCH', `permissions/${existing.id}`, { fields: [...have, ...missing] });
    }
    if (!sameFilter(existing.permissions, permission.permissions)) {
      warnings.push(`${label}: el filtro actual difiere del esperado; no se modifica (revisar a mano)`);
      if (emptyFilter(existing.permissions)) warnings.push(`NARROW pendiente (no aplicado): ${label} hoy no tiene filtro (acceso a todas las filas); lo esperado es ${JSON.stringify(permission.permissions)}. Estrecharlo a mano tras revisar`);
    }
    if (!sameFilter(existing.validation, permission.validation)) warnings.push(`${label}: la validación actual difiere de la esperada; no se modifica (revisar a mano)`);
  }
  if (publicId) {
    for (const p of current.permissions.filter(p => p.policy === publicId && neverBuildCollections.includes(p.collection))) {
      warnings.push(`RIESGO: la política pública tiene ${p.action} sobre ${p.collection}; retírelo manualmente (el script nunca borra)`);
    }
  }
  // 5. Optional content seed from the approved snapshot.
  if (seed) {
    for (const definition of websiteCollections) {
      const rows = current.items?.[definition.collection] ?? [];
      for (const record of definition.records) {
        const existing = rows.find(row => String(row.id) === String(record.id));
        if (!existing) {
          op('item', `crear registro ${definition.collection}/${record.id}`, definition.singleton ? 'PATCH' : 'POST', `items/${definition.collection}`, record);
          continue;
        }
        const patch = Object.fromEntries(definition.fields
          .filter(field => (existing[field.key] === null || existing[field.key] === undefined) && record[field.key] !== '' && record[field.key] !== undefined)
          .map(field => [field.key, record[field.key]]));
        if (Object.keys(patch).length) {
          op('item-fill', `completar ${definition.collection}/${record.id}: ${Object.keys(patch).join(', ')}`, 'PATCH',
            definition.singleton ? `items/${definition.collection}` : `items/${definition.collection}/${encodeURIComponent(record.id)}`, patch);
        }
      }
    }
  }
  // 6. Build flow scope: last, so seeding does not fan out into many rebuilds of new collections.
  const flow = current.flows.find(f => f.name === buildFlowName);
  if (!flow) warnings.push(`No existe el Flow "${buildFlowName}": no se modifica nada (créelo o revise el nombre)`);
  else {
    const collections = Array.isArray(flow.options?.collections) ? flow.options.collections : [];
    for (const name of neverBuildCollections) if (collections.includes(name)) warnings.push(`RIESGO: el Flow "${buildFlowName}" incluye ${name}; retírelo manualmente`);
    const missing = buildFlowCollections.filter(name => !collections.includes(name));
    if (missing.length) {
      op('flow', `añadir al Flow "${buildFlowName}": ${missing.join(', ')}`, 'PATCH', `flows/${flow.id}`, { options: { ...flow.options, collections: [...collections, ...missing] } });
    }
  }
  return { ops, warnings };
}

export async function applyPlan(client, ops, log = () => {}) {
  for (const [index, item] of ops.entries()) {
    if (item.method === 'DELETE') throw new Error('Operación DELETE prohibida');
    await client.request(item.method, item.path, item.body);
    log(`  ✓ ${index + 1}/${ops.length} ${item.summary}`);
  }
}

export function formatPlan({ ops, warnings }, title) {
  const lines = [`${title}: ${ops.length} cambio(s)`];
  const counts = ops.reduce((acc, item) => ({ ...acc, [item.kind]: (acc[item.kind] ?? 0) + 1 }), {});
  if (ops.length) lines.push(`  por tipo: ${Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(' ')}`);
  for (const item of ops) lines.push(`  + ${item.method} /${item.path.split('?')[0]} — ${item.summary}`);
  for (const warning of warnings) lines.push(`  ! ${warning}`);
  return lines.join('\n');
}

// ---------------------------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------------------------
export async function runSchemaCli(args, { env = process.env, fetcher = globalThis.fetch, stdout = line => console.log(line) } = {}) {
  const flags = new Set(args.filter(a => a.startsWith('--')));
  const fixtureIndex = args.indexOf('--fixture');
  const fixture = fixtureIndex >= 0 ? args[fixtureIndex + 1] : undefined;
  const known = new Set(['--apply', '--seed', '--json', '--fixture', '--backup-done']);
  if ([...flags].some(f => !known.has(f)) || (fixtureIndex >= 0 && (!fixture || fixture.startsWith('--')))) throw new TypeError(usage);
  const apply = flags.has('--apply');
  const seed = flags.has('--seed');
  const publicPolicyId = env.DIRECTUS_PUBLIC_POLICY_ID?.trim() || undefined;

  let client;
  let memory;
  if (fixture) {
    memory = createMemoryDirectus(JSON.parse(await readFile(fixture, 'utf8')));
    client = createClient({ baseUrl: 'http://localhost:8055', fetcher: memory.fetcher });
  } else {
    const token = typeof env.DIRECTUS_ADMIN_TOKEN === 'string' ? env.DIRECTUS_ADMIN_TOKEN.trim() : '';
    if (!token) throw new TypeError('Se requiere DIRECTUS_ADMIN_TOKEN en el entorno (nunca en argumentos)');
    if (apply && !flags.has('--backup-done')) throw new TypeError('--apply real exige --backup-done tras `directus schema snapshot` y dump de la base');
    client = createClient({ baseUrl: cmsBase(env.DIRECTUS_URL ?? '', 'DIRECTUS_URL'), token, fetcher });
  }

  const before = planChanges(await readState(client, { seed }), { seed, publicPolicyId });
  const report = { mode: apply ? (fixture ? 'simulate' : 'apply') : 'dry-run', ops: before.ops.map(({ kind, summary, method, path }) => ({ kind, summary, method, path })), warnings: before.warnings };
  if (!flags.has('--json')) stdout(formatPlan(before, `Plan (${report.mode}${fixture ? `, fixture ${fixture}` : ''})`));
  if (apply) {
    await applyPlan(client, before.ops, flags.has('--json') ? () => {} : stdout);
    const after = planChanges(await readState(client, { seed }), { seed, publicPolicyId });
    report.secondRun = after.ops.length;
    if (!flags.has('--json')) stdout(formatPlan(after, 'Segunda corrida'));
    if (memory) report.deleteRequests = memory.requests.filter(r => r.method === 'DELETE').length;
  }
  if (flags.has('--json')) stdout(JSON.stringify(report, null, 2));
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runSchemaCli(process.argv.slice(2)).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
