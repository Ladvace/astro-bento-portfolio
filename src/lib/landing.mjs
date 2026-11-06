import { whatsappHref, websiteFileUrl } from './website-model.mjs';

export const areas = ['legal', 'data'];

/** Direct WhatsApp link for an area, or the in-page fallback anchor when the number is not configured. */
export function areaContact(site, area, fallback = '#contacto') {
  const number = area === 'legal' ? site.globals.legal_whatsapp : site.globals.data_whatsapp;
  const href = whatsappHref(number, site.practices[area]?.whatsapp_message ?? '');
  return href ? { href, whatsapp: true, track: 'whatsapp_click' } : { href: fallback, whatsapp: false, track: 'cta_click' };
}

export const hasWhatsapp = (site) => areas.some((area) => areaContact(site, area).whatsapp);

export function contactEmailHref(site) {
  const email = site.globals.contact_email;
  return typeof email === 'string' && /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(email) ? `mailto:${email}` : '';
}

export function initials(name) {
  return String(name ?? '').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('');
}

export function personPhoto(person) {
  return websiteFileUrl(person?.photo);
}

/** Splits the consent sentence around the privacy link: `{privacy_link}` placeholder, label match, or appended. */
export function consentParts(label, linkLabel) {
  const text = String(label ?? '');
  const placeholder = text.indexOf('{privacy_link}');
  if (placeholder >= 0) return { before: text.slice(0, placeholder), link: linkLabel, after: text.slice(placeholder + '{privacy_link}'.length) };
  const at = linkLabel ? text.toLowerCase().indexOf(String(linkLabel).toLowerCase()) : -1;
  if (at >= 0) return { before: text.slice(0, at), link: text.slice(at, at + linkLabel.length), after: text.slice(at + linkLabel.length) };
  return { before: text ? `${text} ` : '', link: linkLabel, after: '' };
}
