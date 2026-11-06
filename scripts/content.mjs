import { pathToFileURL } from 'node:url';
import { websiteCollections, validateContentPatch } from '../src/lib/website-model.mjs';

const usage = 'Uso: content.mjs list [MODULE] | get MODULE RECORD FIELD | set MODULE RECORD FIELD VALUE [--apply]';
const defaultCmsUrl = 'https://cms.romahomestore.com';

export function cmsBase(value, label = 'CONTENT_CMS_URL') {
  let url;
  try {
    if (typeof value !== 'string' || /[\s\\\p{Cc}]/u.test(value)) throw new Error();
    url = new URL(value);
  } catch { throw new TypeError(`${label} inválida`); }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) || url.username || url.password || url.search || url.hash) {
    throw new TypeError(`${label} requiere HTTPS o HTTP localhost, sin credenciales, consulta ni fragmento`);
  }
  return url.href.replace(/\/+$/, '');
}

function knownModule(alias) {
  const definition = websiteCollections.find(item => item.alias === alias);
  if (!definition) throw new TypeError('Módulo desconocido');
  return definition;
}

/** Tiny one-field editor. Importing the module is inert; tests inject all I/O. */
export async function runContentCli(args, { env = process.env, fetcher = globalThis.fetch, stdout = line => console.log(line) } = {}) {
  const emit = value => {
    const serialized = JSON.stringify(value, null, 2);
    if (typeof stdout === 'function') stdout(serialized);
    else stdout.write(`${serialized}\n`);
    return value;
  };
  const [command, alias, id, key, rawValue, flag] = args;
  if (command === 'list') {
    if (args.length > 2) throw new TypeError(usage);
    const definitions = alias === undefined ? websiteCollections : [knownModule(alias)];
    return emit(definitions.map(definition => ({
      alias: definition.alias, collection: definition.collection, label: definition.label,
      records: definition.records.map(row => ({ id: row.id, label: row.record_label, ...(row.locale ? { locale: row.locale } : {}) })),
      fields: structuredClone(definition.fields),
    })));
  }
  if ((command !== 'get' && command !== 'set') || (command === 'get' && args.length !== 4) ||
      (command === 'set' && (args.length < 5 || args.length > 6 || (args.length === 6 && flag !== '--apply')))) {
    throw new TypeError(usage);
  }
  const definition = knownModule(alias);
  if (!definition.records.some(row => row.id === id)) throw new TypeError('Registro desconocido');
  const descriptor = definition.fields.find(field => field.key === key);
  if (!descriptor) throw new TypeError('Campo no editable o no permitido');
  let patch;
  if (command === 'set') {
    let value = rawValue;
    if (descriptor.type === 'list') {
      try { value = JSON.parse(rawValue); }
      catch { throw new TypeError('La lista requiere un arreglo JSON válido'); }
    }
    patch = validateContentPatch(alias, id, { [key]: value });
    if (flag !== '--apply') return emit({ mode: 'dry-run', collection: definition.collection, id, patch });
  }

  // Only this private variable is ever inspected. PUBLIC_* variables are ignored.
  const token = typeof env.DIRECTUS_CONTENT_TOKEN === 'string' ? env.DIRECTUS_CONTENT_TOKEN.trim() : '';
  if (command === 'set' && !token) throw new TypeError('Para --apply se requiere DIRECTUS_CONTENT_TOKEN privado');
  const base = cmsBase(env.CONTENT_CMS_URL ?? defaultCmsUrl);
  // Directus singleton endpoints have no /:id suffix; the known model ID is still validated above.
  const url = new URL(`${base}/items/${encodeURIComponent(definition.collection)}${definition.singleton ? '' : `/${encodeURIComponent(id)}`}`);
  if (command === 'get') url.searchParams.set('fields', key);
  const headers = { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  if (command === 'set') headers['Content-Type'] = 'application/json';
  let response;
  try {
    response = await fetcher(url.href, {
      method: command === 'get' ? 'GET' : 'PATCH', headers,
      redirect: 'error', signal: AbortSignal.timeout(10000),
      ...(patch ? { body: JSON.stringify(patch) } : {}),
    });
  } catch {
    // Do not echo request URL, token, transport exception or server response body.
    throw new Error('CMS: error de red o tiempo de espera agotado; no se reintentó la operación');
  }
  if (!response.ok) {
    const status = Number.isInteger(response.status) ? response.status : 'desconocido';
    throw new Error(`CMS: HTTP ${status}; no se reintentó la operación`);
  }
  if (command === 'set') return emit({ mode: 'applied', collection: definition.collection, id, patch });
  let value;
  try {
    const body = await response.json();
    if (!body?.data || !Object.hasOwn(body.data, key)) throw new Error();
    // Defense in depth: only known, correctly typed editorial content reaches stdout.
    value = validateContentPatch(alias, id, { [key]: body.data[key] })[key];
  } catch { throw new Error('CMS: respuesta inválida para el campo solicitado'); }
  return emit({ collection: definition.collection, id, field: key, value });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runContentCli(process.argv.slice(2)).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
