import { resolveWebsiteContent } from './website-model.mjs';

/**
 * One loader instance per build; templates share the resolved editorial source.
 * @param {{source?: string, collections?: {collection: string, singleton?: boolean, repeatable?: boolean, records?: {locale?: string}[], fields: {key: string}[]}[], baseUrl?: string, fetcher?: typeof fetch, attempts?: number, retryDelayMs?: number}} [options]
 */
export function createWebsiteLoader({ source = 'snapshot', collections = [], baseUrl = 'https://cms.romahomestore.com', fetcher = globalThis.fetch, attempts = 3, retryDelayMs = 250 } = {}) {
  async function read(url, collection) {
    for (let attempt = 1; ; attempt += 1) {
      try {
        const response = await fetcher(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10000) });
        if (!response.ok) {
          const error = Object.assign(new Error(`CMS ${collection} HTTP ${response.status}`), { retryable: response.status >= 500 || response.status === 429 || response.status === 408 });
          throw error;
        }
        return (await response.json()).data;
      } catch (error) {
        if (error.retryable === false || attempt >= attempts) throw error;
        await new Promise(resolve => setTimeout(resolve, retryDelayMs * 2 ** (attempt - 1)));
      }
    }
  }
  let pendingRows;
  return async (locale) => {
    if (source === 'snapshot') return resolveWebsiteContent({}, locale);
    const rows = await (pendingRows ??= Promise.all(collections.map(async (definition) => {
      const url = new URL(`/items/${definition.collection}`, baseUrl);
      // Repeatable collections (FAQ, steps, testimonials) are always localized and ordered by `sort`.
      const fields = ['id', 'status', ...(definition.repeatable || definition.records?.some(row => row.locale) ? ['locale'] : []),
        ...(definition.repeatable ? ['sort'] : []), ...definition.fields.map(field => field.key)];
      url.searchParams.set('fields', fields.join(','));
      if (!definition.singleton) {
        url.searchParams.set('limit', '-1');
        url.searchParams.set('filter', JSON.stringify({ status: { _eq: 'published' } }));
        if (definition.repeatable) url.searchParams.set('sort', 'sort,id');
      }
      const data = await read(url, definition.collection);
      const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
      if (definition.singleton ? data !== null && !isRecord(data) : !Array.isArray(data) || !data.every(isRecord)) {
        throw new Error(`Invalid CMS ${definition.collection} response`);
      }
      return [definition.collection, definition.singleton ? (data === null ? [] : [data]) : data];
    })));
    return resolveWebsiteContent(Object.fromEntries(rows), locale);
  };
}
