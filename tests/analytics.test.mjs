import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (p) => readFile(new URL(`../src/${p}`, import.meta.url), 'utf8');

test('Analytics.astro: basic Consent Mode, no static gtag, ads denied, no PII', async () => {
  const src = await read('components/roma/Analytics.astro');
  assert.doesNotMatch(src, /<script[^>]*src=/, 'no static external script');
  assert.doesNotMatch(src, /set:html=\{bootstrap\}/);
  assert.match(src, /createElement\('script'\)/);
  const iDefault = src.indexOf("gtag('consent', 'default'");
  assert.ok(iDefault > 0 && iDefault < src.indexOf("gtag('config'"), 'consent default must precede config');
  assert.match(src, /ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'granted'/);
  assert.match(src, /analytics_storage: 'denied'/);
  assert.match(src, /deleteGaCookies/);
  assert.match(src, /\^G-\[A-Z0-9\]\+\$/);
  assert.doesNotMatch(src, /ad_storage: 'granted'|ad_user_data: 'granted'/);
  for (const name of ['cta_click', "'contact'", 'lang_switch', "'lead_form_start'", "'lead_form_submit'", 'generate_lead']) assert.ok(src.includes(name), name);
  assert.doesNotMatch(src, /'form_start'|'form_submit_attempt'/);
  assert.doesNotMatch(src, /\.get\('(name|message|contact_email|contact_whatsapp)'\)/);
});

test('ConsentBanner reopens on roma:consent-open and footer link is conditional', async () => {
  const banner = await read('components/roma/ConsentBanner.astro');
  assert.match(banner, /addEventListener\('roma:consent-open'/);
  assert.match(banner, /emit\(choice\)/);
  const layout = await read('layouts/RomaLayout.astro');
  assert.match(layout, /preferencesLabel&&<button[^>]*data-consent-open/);
});
