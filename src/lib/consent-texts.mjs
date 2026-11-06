/**
 * Consent text versioning (Ley 1581/2012 evidence) without querying the CMS from /api/lead.
 *
 * Build time: ContactForm renders a hidden `consent_version` = short sha256 of the consent label it
 * shows (per locale, optionally prefixed by the editorial `globals.consent_version`) and registers
 * version -> { locale, text } here. The `consentTextsIntegration` hook writes that registry to
 * `<build.server>/consent-texts.json` at `astro:build:done` (server dir: never publicly served).
 *
 * Runtime: /api/lead reads that file ONCE at startup (`readConsentTexts`) and stores the exact text
 * the person saw. No network, no retries, no cached rejected promise in the request path.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const CONSENT_TEXTS_FILE = 'consent-texts.json';
const REGISTRY = Symbol.for('roma.consentTexts');
const EDITORIAL_VERSION = /^[A-Za-z0-9._-]{1,24}$/;

/** "<editorial>-<sha256 12 hex>" or just the hash when no valid editorial version is set. */
export function consentVersion(text, editorialVersion) {
  const hash = createHash('sha256').update(String(text ?? ''), 'utf8').digest('hex').slice(0, 12);
  const editorial = typeof editorialVersion === 'string' ? editorialVersion.trim() : '';
  return EDITORIAL_VERSION.test(editorial) ? `${editorial}-${hash}` : hash;
}

function registry() {
  globalThis[REGISTRY] ??= { versions: {}, current: {} };
  return globalThis[REGISTRY];
}

/** Called while rendering the form (prerender happens in the build process). Returns the version. */
export function registerConsentText(locale, text, editorialVersion) {
  const version = consentVersion(text, editorialVersion);
  const map = registry();
  map.versions[version] = { locale, text: String(text ?? '') };
  map.current[locale] = version;
  return version;
}

export const consentTextsSnapshot = () => structuredClone(registry());

/** Astro integration: persists the registry next to the server bundle once pages are prerendered. */
export function consentTextsIntegration() {
  let serverDir;
  return {
    name: 'roma-consent-texts',
    hooks: {
      'astro:config:done': ({ config }) => { serverDir = config.build.server; },
      'astro:build:done': ({ logger }) => {
        const map = registry();
        const count = Object.keys(map.versions).length;
        if (!serverDir || count === 0) {
          logger.warn('consent-texts: ningún formulario registró texto de consentimiento; /api/lead usará el texto por defecto marcado como [version desconocida]');
          return;
        }
        writeFileSync(new URL(CONSENT_TEXTS_FILE, serverDir), `${JSON.stringify(map, null, 1)}\n`);
        logger.info(`consent-texts: ${count} versión(es) escritas en ${CONSENT_TEXTS_FILE}`);
      },
    },
  };
}

/**
 * Finds consent-texts.json: explicit path first, then walking up from the bundled module's directory
 * (the endpoint chunk lives somewhere below dist/server/). Returns null when absent or malformed.
 * @param {{ explicitPath?: string, fromUrl?: string, maxLevels?: number }} [options]
 * @returns {{ versions: Record<string, { locale: string, text: string }>, current: Record<string, string> } | null}
 */
export function readConsentTexts({ explicitPath, fromUrl, maxLevels = 5 } = {}) {
  const candidates = [];
  if (explicitPath) candidates.push(explicitPath);
  if (fromUrl) {
    let dir = dirname(fileURLToPath(fromUrl));
    for (let level = 0; level <= maxLevels; level += 1) {
      candidates.push(join(dir, CONSENT_TEXTS_FILE));
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  for (const path of candidates) {
    try {
      if (!existsSync(path)) continue;
      const data = JSON.parse(readFileSync(path, 'utf8'));
      if (data && typeof data.versions === 'object' && typeof data.current === 'object') return data;
    } catch { /* try the next candidate */ }
  }
  return null;
}
