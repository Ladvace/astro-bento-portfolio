/**
 * Minimal interpreter for the Directus 11 Flow semantics used by scripts/directus-flows.mjs, for
 * tests only. It approximates (does not reproduce) Directus: options are rendered with mustache
 * where a string that is exactly one {{path}} yields the raw value; operations run in order via
 * resolve/reject; exec code runs in a bare node:vm context (ECMAScript builtins only, like
 * isolated-vm: no fetch, require, URL or Buffer); request ops throw {status, data} on non-2xx.
 */
import vm from 'node:vm';

const get = (data, path) => path.split('.').reduce((value, key) => (value === null || value === undefined ? undefined : value[key]), data);

export function render(value, data) {
  if (typeof value === 'string') {
    const whole = value.match(/^\{\{\s*([^{}\s]+)\s*\}\}$/);
    if (whole) { const raw = get(data, whole[1]); if (raw !== undefined) return raw; }
    return value.replace(/\{\{\s*([^{}\s]+)\s*\}\}/g, (_, path) => {
      const raw = get(data, path);
      if (raw === undefined || raw === null) return '';
      return typeof raw === 'object' ? JSON.stringify(raw) : String(raw);
    });
  }
  if (Array.isArray(value)) return value.map(item => render(item, data));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, render(item, data)]));
  return value;
}

/** Directus dynamic date variable: $NOW or $NOW(-15 minutes). */
function dynamic(value, now) {
  const match = typeof value === 'string' && value.match(/^\$NOW(?:\(([+-]?\d+) (second|minute|hour|day)s?\))?$/);
  if (!match) return value;
  const ms = { second: 1e3, minute: 6e4, hour: 36e5, day: 864e5 }[match[2]] ?? 0;
  return new Date(now().getTime() + Number(match[1] ?? 0) * ms).toISOString();
}

function matches(row, filter, now = () => new Date()) {
  if (!filter) return true;
  if (filter._and) return filter._and.every(part => matches(row, part, now));
  if (filter._or) return filter._or.some(part => matches(row, part, now));
  return Object.entries(filter).every(([field, rule]) => {
    const value = row?.[field];
    if (rule && typeof rule === 'object' && !Object.keys(rule).some(k => k.startsWith('_'))) return matches(value, rule, now);
    if ('_eq' in rule) return value === rule._eq;
    if ('_neq' in rule) return value !== rule._neq;
    if ('_in' in rule) return Array.isArray(rule._in) && rule._in.includes(value);
    if ('_nnull' in rule) return value !== null && value !== undefined;
    if ('_lt' in rule) return value !== null && value !== undefined && Date.parse(value) < Date.parse(dynamic(rule._lt, now));
    throw new Error(`filtro no soportado: ${JSON.stringify(rule)}`);
  });
}

export function createFlowRunner({ flows, operations, items, fetcher, env = {}, now = () => new Date() }) {
  const logs = [];
  const notifications = [];
  const runs = [];
  const handlers = {
    'item-read': async ({ collection, key, query }) => {
      const rows = items[collection] ?? [];
      if (key && key.length) {
        const row = rows.find(r => r.id === key[0]);
        if (!row) throw Object.assign(new Error('You don\'t have permission to access this.'), { status: 403 });
        return structuredClone(row);
      }
      return rows.filter(row => matches(row, query?.filter, now)).slice(0, query?.limit ?? 100).map(row => (query?.fields ? Object.fromEntries(query.fields.map(f => [f, row[f]])) : structuredClone(row)));
    },
    'item-update': async ({ collection, key, payload, query }) => {
      if (!key || !key.length) {
        // Directus updateByQuery: every row matching query.filter.
        const rows = (items[collection] ?? []).filter(row => matches(row, query?.filter, now));
        for (const row of rows) Object.assign(row, structuredClone(payload));
        return rows.map(row => row.id);
      }
      const row = (items[collection] ?? []).find(r => r.id === key[0]);
      if (!row) throw new Error('item not found');
      Object.assign(row, structuredClone(payload));
      return key[0];
    },
    condition: async ({ filter }, data) => {
      if (!matches(data, filter, now)) throw [{ message: 'condition failed' }];
      return null;
    },
    exec: async ({ code }, data) => {
      const context = vm.createContext({ module: { exports: {} } });
      vm.runInContext(code, context, { timeout: 1000 });
      return JSON.parse(JSON.stringify(await context.module.exports(JSON.parse(JSON.stringify(data))) ?? null));
    },
    request: async ({ method, url, headers, body }) => {
      const response = await fetcher(url, { method, headers: Object.fromEntries(headers.map(h => [h.header, h.value])), body: body ?? undefined });
      const text = await response.text();
      let parsed = text;
      try { parsed = JSON.parse(text); } catch { /* text body */ }
      const result = { status: response.status, statusText: response.statusText, headers: {}, data: parsed };
      if (!response.ok) throw result;
      return result;
    },
    trigger: async ({ flow, payload }) => {
      if (Array.isArray(payload)) { const results = []; for (const item of payload) results.push(await runFlow(flow, item)); return results; }
      return runFlow(flow, payload);
    },
    notification: async options => { notifications.push(options); return null; },
    log: async ({ message }) => { logs.push(message); return null; },
    mail: async () => { throw new Error('SMTP no configurado'); },
  };

  async function runFlow(flowId, trigger) {
    const flow = flows.find(f => f.id === flowId);
    if (!flow) throw new Error(`Flow ${flowId} no existe`);
    const data = { $trigger: trigger, $last: trigger, $accountability: null, $env: env };
    const steps = [];
    let next = flow.operation;
    while (next) {
      const op = operations.find(o => o.id === next);
      let ok = true;
      let result;
      try { result = await handlers[op.type](render(op.options, data), data); } catch (error) { ok = false; result = error instanceof Error ? { name: error.name, message: error.message } : error; }
      data[op.key] = result;
      data.$last = result;
      steps.push(`${op.key}:${ok ? 'ok' : 'fail'}`);
      next = ok ? op.resolve : op.reject;
    }
    runs.push({ flow: flow.name, steps });
    return flow.options?.return ? get(data, flow.options.return) : undefined;
  }
  /** Directus action event: every active event Flow for that scope/collection runs independently. */
  function emitAction(scope, collection, trigger) {
    return flows
      .filter(flow => flow.status === 'active' && flow.trigger === 'event' && flow.options?.scope?.includes(scope) && flow.options?.collections?.includes(collection))
      .map(flow => ({ name: flow.name, done: runFlow(flow.id, trigger) }));
  }
  return { runFlow, emitAction, notifications, runs, logs };
}

/** In-memory Twenty REST API (people, opportunities, notes, noteTargets) with failure injection. */
export function createMockTwenty({ apiKey = 'test-twenty-key', now = () => new Date() } = {}) {
  const db = { people: [], opportunities: [], notes: [], noteTargets: [] };
  const singular = { people: 'person', opportunities: 'opportunity', notes: 'note', noteTargets: 'noteTarget' };
  const create = { people: 'createPerson', opportunities: 'createOpportunity', notes: 'createNote', noteTargets: 'createNoteTarget' };
  const failures = [];
  const requests = [];
  let counter = 0;
  const id = () => `aaaaaaaa-0000-4000-8000-${String(++counter).padStart(12, '0')}`;
  const reply = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const fieldValue = (record, path) => path.split('.').reduce((value, key) => value?.[key], record);

  async function fetcher(input, init = {}) {
    const url = new URL(String(input));
    const method = init.method ?? 'GET';
    requests.push({ method, path: url.pathname, search: url.search, body: init.body, auth: init.headers?.Authorization });
    // `skip` lets the first N matching calls through before the failure applies.
    const failure = failures.find(f => f.method === method && url.pathname.startsWith(f.path) && (f.skip > 0 ? (f.skip--, false) : f.times-- > 0));
    if (failure?.hang) return new Promise(() => {});
    if (failure?.network) throw new TypeError('fetch failed');
    if (failure) return reply(failure.status, failure.body ?? { statusCode: failure.status, error: 'Error', messages: ['Internal server error'] });
    if (init.headers?.Authorization !== `Bearer ${apiKey}`) return reply(401, { statusCode: 401, messages: ['Unauthorized'] });
    const [, rest, object, recordId] = url.pathname.split('/');
    if (rest !== 'rest' || !db[object]) return reply(404, { messages: ['Not found'] });
    if (method === 'GET' && recordId) {
      const record = db[object].find(r => r.id === recordId);
      return record ? reply(200, { data: { [singular[object]]: record } }) : reply(404, { messages: ['Record not found'] });
    }
    if (method === 'GET') {
      const filter = url.searchParams.get('filter') ?? '';
      const clauses = [...filter.matchAll(/([\w.]+)\[eq\]:"([^"]*)"/g)].map(m => [m[1], m[2]]);
      const found = db[object].filter(record => clauses.some(([path, value]) => fieldValue(record, path) === value));
      return reply(200, { data: { [object]: found.slice(0, Number(url.searchParams.get('limit') ?? 60)) }, totalCount: found.length });
    }
    if (method === 'POST') {
      const body = JSON.parse(init.body);
      if (object === 'opportunities' && !db.people.some(p => p.id === body.pointOfContactId)) return reply(400, { messages: ['pointOfContactId inválido'] });
      const record = { id: id(), createdAt: now().toISOString(), ...body };
      db[object].push(record);
      return reply(201, { data: { [create[object]]: record } });
    }
    // Any PATCH/PUT would overwrite a record: the integration must never send one.
    return reply(405, { messages: ['Method not allowed'] });
  }
  return { fetcher, db, requests, fail: (method, path, options = {}) => failures.push({ method, path, times: 1, status: 500, ...options }) };
}
