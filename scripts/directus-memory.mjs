/**
 * In-memory stand-in for the subset of the Directus 11 REST API used by directus-schema.mjs.
 * It backs `--fixture` simulations and the tests: no network, no secrets. It never implements
 * DELETE, so any attempt to delete is reported as an error.
 */
export function createMemoryDirectus(initialState) {
  const state = structuredClone(initialState);
  for (const key of ['collections', 'fields', 'relations', 'policies', 'roles', 'access', 'permissions', 'flows', 'operations', 'folders']) state[key] ??= [];
  state.items ??= {};
  const requests = [];
  let nextPermission = Math.max(0, ...state.permissions.map(p => Number(p.id) || 0)) + 1;
  let counter = 0;
  const uuid = () => `00000000-0000-4000-8000-${String(++counter).padStart(12, '0')}`;
  const json = (data, status = 200) => new Response(status === 204 ? null : JSON.stringify({ data }), { status, headers: { 'Content-Type': 'application/json' } });
  const error = (status, message) => new Response(JSON.stringify({ errors: [{ message }] }), { status, headers: { 'Content-Type': 'application/json' } });
  const isSingleton = collection => Boolean(state.collections.find(c => c.collection === collection)?.meta?.singleton);
  const pkDefault = (collection) => state.fields.find(f => f.collection === collection && f.schema?.is_primary_key)?.meta?.special?.includes('uuid') ? uuid() : undefined;

  // Mirrors directus_operations constraints: flow FK, resolve/reject FK and UNIQUE resolve/reject.
  function operationProblem(row) {
    if (!state.flows.some(f => f.id === row.flow)) return 'operation.flow must reference an existing flow';
    for (const pointer of ['resolve', 'reject']) {
      if (!row[pointer]) continue;
      if (!state.operations.some(o => o.id === row[pointer])) return `operation.${pointer} must reference an existing operation`;
      if (state.operations.some(o => o.id !== row.id && o[pointer] === row[pointer])) return `operation.${pointer} must be unique`;
    }
    if (state.operations.some(o => o.id !== row.id && o.flow === row.flow && o.key === row.key)) return 'operation key must be unique per flow';
    return null;
  }

  async function fetcher(input, init = {}) {
    const url = new URL(String(input));
    const method = (init.method ?? 'GET').toUpperCase();
    const body = init.body ? JSON.parse(init.body) : undefined;
    requests.push({ method, path: url.pathname, body });
    const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
    const [root, a, b] = parts;
    if (method === 'DELETE') return error(405, 'DELETE no permitido en la simulación');
    if (method === 'GET') {
      if (['collections', 'fields', 'relations', 'policies', 'roles', 'access', 'permissions', 'flows', 'operations', 'folders'].includes(root) && !a) return json(structuredClone(state[root]));
      if (root === 'items' && a) {
        if (!state.collections.some(c => c.collection === a)) return error(403, 'Forbidden');
        const rows = state.items[a] ?? [];
        return json(structuredClone(isSingleton(a) ? rows[0] ?? null : rows));
      }
      return error(404, 'Not found');
    }
    if (method === 'POST') {
      if (root === 'collections') {
        if (state.collections.some(c => c.collection === body.collection)) return error(400, 'Collection exists');
        state.collections.push({ collection: body.collection, meta: body.meta, schema: { name: body.collection } });
        for (const field of body.fields ?? []) state.fields.push({ collection: body.collection, ...field });
        state.items[body.collection] = [];
        return json({ collection: body.collection });
      }
      if (root === 'fields' && a) {
        if (!state.collections.some(c => c.collection === a)) return error(403, 'Forbidden');
        if (state.fields.some(f => f.collection === a && f.field === body.field)) return error(400, 'Field exists');
        state.fields.push({ collection: a, ...body });
        return json({ collection: a, ...body });
      }
      if (root === 'relations') { state.relations.push(structuredClone(body)); return json(body); }
      if (['policies', 'roles', 'access', 'folders'].includes(root)) {
        const row = { id: body.id ?? uuid(), ...body };
        if (state[root].some(r => r.id === row.id)) return error(400, 'Duplicate id');
        state[root].push(row);
        return json(row);
      }
      if (root === 'flows') {
        const row = { id: body.id ?? uuid(), operation: null, ...body };
        if (state.flows.some(f => f.id === row.id)) return error(400, 'Duplicate id');
        state.flows.push(row);
        return json(row);
      }
      if (root === 'operations') {
        const row = { id: body.id ?? uuid(), resolve: null, reject: null, ...body };
        const problem = operationProblem(row);
        if (problem) return error(400, problem);
        state.operations.push(row);
        return json(row);
      }
      if (root === 'permissions') { const row = { id: nextPermission++, ...body }; state.permissions.push(row); return json(row); }
      if (root === 'items' && a) {
        if (!state.collections.some(c => c.collection === a)) return error(403, 'Forbidden');
        const row = { id: body.id ?? pkDefault(a), ...body };
        (state.items[a] ??= []).push(row);
        return json(row);
      }
      return error(404, 'Not found');
    }
    if (method === 'PATCH') {
      const patchRow = (rows, id) => {
        const row = rows.find(r => String(r.id) === String(id));
        if (!row) return error(404, 'Not found');
        Object.assign(row, structuredClone(body));
        return json(row);
      };
      if (root === 'permissions' && a) return patchRow(state.permissions, a);
      if (root === 'flows' && a) {
        if (body.operation && !state.operations.some(o => o.id === body.operation && o.flow === a)) return error(400, 'Flow operation must belong to the flow');
        return patchRow(state.flows, a);
      }
      if (root === 'operations' && a) {
        const row = state.operations.find(o => o.id === a);
        if (!row) return error(404, 'Not found');
        const problem = operationProblem({ ...row, ...body });
        if (problem) return error(400, problem);
        return patchRow(state.operations, a);
      }
      if (root === 'items' && a) {
        const rows = state.items[a] ?? [];
        if (isSingleton(a) && !b) { if (!rows[0]) rows.push({}); Object.assign(rows[0], structuredClone(body)); return json(rows[0]); }
        return patchRow(rows, b);
      }
      return error(404, 'Not found');
    }
    return error(405, 'Method not allowed');
  }
  return { fetcher, state, requests };
}
