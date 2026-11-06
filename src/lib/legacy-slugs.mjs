/**
 * Published-article check for the SSR legacy redirects (see docs/seo.md).
 * Articles are prerendered at build as dist/client/<locale>/blog/<slug>/index.html, so that file's existence
 * IS the list of published slugs. Resolved against the standalone server layout (dist/server/** next to dist/client).
 */
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const SLUG = /^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/;

function clientDirs() {
  const here = import.meta.url;
  return [
    process.env.ROMA_CLIENT_DIR,
    join(process.cwd(), 'dist', 'client'),
    fileURLToPath(new URL('../client/', here)),
    fileURLToPath(new URL('../../client/', here)),
    fileURLToPath(new URL('../../../client/', here)),
  ].filter(Boolean);
}

let root;
function findRoot() {
  if (root === undefined) root = clientDirs().find((d) => existsSync(join(d, 'es', 'blog', 'index.html'))) ?? null;
  return root;
}

/** True when /{es,en}/blog/<slug>/ exists in the build. In `astro dev` (no dist) it fails open. */
export function hasArticle(slug) {
  if (!SLUG.test(slug)) return false;
  const dir = findRoot();
  if (!dir) return Boolean(import.meta.env?.DEV);
  return existsSync(join(dir, 'es', 'blog', slug, 'index.html'));
}
