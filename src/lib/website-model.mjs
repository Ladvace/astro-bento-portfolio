import defaults from '../content/website-defaults.json' with { type: 'json' };

export const websiteDefaults = defaults;

// Only descriptions live here: all editorial values come from the approved JSON.
const editorialGroups = {
  globals: {
    'Identidad de marca': {
      brand_name: 'Nombre de marca', full_name: 'Nombre completo', brand_eyebrow: 'Identificador de marca',
      header_logo: 'Logotipo de cabecera', footer_logo: 'Logotipo de pie', symbol_image: 'Símbolo de marca',
      logo_alt: 'Texto alternativo del logotipo', home_link_label: 'Etiqueta del enlace a inicio', symbol_label: 'Etiqueta del símbolo',
    },
    'Buscadores y difusión': { social_image: 'Imagen para redes sociales', seo_suffix: 'Sufijo del título SEO', rss_title: 'Título del canal RSS' },
    'Contacto': { data_contact_url: 'Enlace de contacto de datos e IA', legal_contact_url: 'Enlace de contacto jurídico' },
    'Contacto directo y medición': {
      legal_whatsapp: 'WhatsApp jurídico (E.164)', data_whatsapp: 'WhatsApp de datos e IA (E.164)',
      contact_email: 'Correo de contacto visible', ga4_id: 'ID de Google Analytics 4 (vacío lo desactiva)',
    },
  },
  common: {
    'Navegación y accesibilidad': {
      navigation: 'Enlaces de navegación', skip_label: 'Salto al contenido', navigation_label: 'Nombre accesible de navegación',
      language_label: 'Selector de idioma', menu_open_label: 'Abrir menú', menu_close_label: 'Cerrar menú', back_home_label: 'Volver al inicio',
    },
    'Pie de página': {
      footer_tagline: 'Lema del pie', footer_scope_label: 'Encabezado del ámbito de trabajo', footer_data_scope: 'Ámbito de datos e IA',
      footer_legal_scope: 'Ámbito jurídico', footer_blog_label: 'Enlace al blog en el pie', footer_contact_label: 'Contacto en el pie',
      footer_disclaimer: 'Aviso del pie', footer_rss_label: 'Etiqueta del canal RSS',
    },
    'Archivo y proyectos': {
      blog_title: 'Título del blog', projects_title: 'Título de proyectos', blog_description: 'Descripción del blog', projects_description: 'Descripción de proyectos',
      archive_eyebrow: 'Antetítulo del archivo', archive_projects_link: 'Enlace a la vista de proyectos', archive_blog_link: 'Enlace a la vista de artículos',
      archive_entry_label: 'Tipo de entrada del archivo', archive_read_label: 'Enlace de lectura', archive_empty: 'Mensaje de archivo vacío', archive_note: 'Nota sobre el idioma original',
    },
    'Artículos': {
      article_description_default: 'Descripción predeterminada del artículo', article_back_label: 'Volver al archivo', article_eyebrow: 'Antetítulo del artículo',
      article_by_label: 'Prefijo de autoría', article_empty_note: 'Aviso de texto ampliado ausente', article_resources_label: 'Encabezado de recursos',
      article_resource_label: 'Enlace de recurso', article_demo_label: 'Enlace al proyecto en línea', article_projects_label: 'Enlace a otros proyectos',
      article_contact_label: 'Invitación de contacto del artículo', article_original_note: 'Nota de idioma del artículo',
    },
    'Páginas de servicios': { practice_process_note: 'Nota sobre el proceso de trabajo', practice_contact_label: 'Invitación de contacto del servicio' },
    'Privacidad': { privacy_title: 'Título de la política de privacidad', privacy_policy: 'Política de privacidad (Markdown)' },
  },
  home: {
    'Buscadores': { seo_title: 'Título SEO de inicio', seo_description: 'Descripción SEO de inicio' },
    'Índice de página': { rail_label: 'Nombre del índice', rail_services: 'Enlace a servicios', rail_team: 'Enlace al equipo', rail_contact: 'Enlace a contacto' },
    'Presentación principal': {
      hero_title: 'Título principal', hero_accent: 'Texto destacado principal', hero_description: 'Descripción principal', hero_primary_label: 'Acción principal',
      hero_secondary_label: 'Acción secundaria', hero_territory: 'Ámbito de la presentación',
    },
    'Firma de marca': { signature_title: 'Título de la firma', signature_accent: 'Texto destacado de la firma', signature_label: 'Etiqueta de la firma' },
    'Servicios': { services_label: 'Antetítulo de servicios', services_title: 'Título de servicios' },
    'Equipo': { team_label: 'Antetítulo del equipo', team_title: 'Título del equipo', team_description: 'Descripción del equipo' },
    'Publicaciones': {
      publications_label: 'Antetítulo de publicaciones', publications_title: 'Título de publicaciones', archive_label: 'Enlace al archivo completo',
      entry_label: 'Tipo de publicación', entry_link_label: 'Enlace al contenido original', original_note: 'Nota sobre los idiomas originales',
    },
    'Contacto': {
      contact_label: 'Antetítulo de contacto', contact_title: 'Título de contacto', contact_description: 'Descripción de contacto',
      data_contact_label: 'Acción de consulta de datos e IA', legal_contact_label: 'Acción de consulta jurídica', contact_note: 'Nota de coordinación de contacto',
    },
    'Presentación orientada a problemas': { hero_legal_cta: 'Acción del hero: consulta jurídica', hero_data_cta: 'Acción del hero: datos, marketing e IA' },
    'Cómo trabajamos y preguntas': { steps_title: 'Título de «Cómo trabajamos»', faq_title: 'Título de preguntas frecuentes', testimonials_title: 'Título de testimonios' },
    'Formulario de contacto': {
      form_title: 'Título del formulario', form_name_label: 'Etiqueta: nombre', form_area_label: 'Etiqueta: área',
      form_area_legal_option: 'Opción de área jurídica', form_area_data_option: 'Opción de área de datos e IA', form_message_label: 'Etiqueta: mensaje',
      form_whatsapp_label: 'Etiqueta: WhatsApp', form_email_label: 'Etiqueta: correo', form_contact_hint: 'Ayuda: WhatsApp o correo',
      form_submit_label: 'Botón de envío', form_error_message: 'Mensaje de error del formulario',
      form_message_hint: 'Ayuda del mensaje: no incluir datos sensibles', form_error_name: 'Error: nombre ausente o inválido',
      form_error_message_length: 'Error: longitud del mensaje', form_error_contact: 'Error: falta WhatsApp o correo válido',
    },
    'Página de gracias': { thanks_title: 'Título de gracias', thanks_description: 'Descripción de gracias', thanks_back_label: 'Enlace de regreso desde gracias' },
    'Consentimiento': {
      consent_label: 'Texto del consentimiento del formulario (Ley 1581/2012)', consent_privacy_link_label: 'Enlace a la política de privacidad',
      consent_banner_text: 'Texto del aviso de cookies', consent_banner_accept_label: 'Botón aceptar del aviso', consent_banner_reject_label: 'Botón rechazar del aviso',
      consent_preferences_label: 'Enlace para reabrir las preferencias de cookies',
    },
  },
  practices: {
    'Tarjeta de servicio': {
      card_label: 'Antetítulo de tarjeta', card_title: 'Título de tarjeta', card_description: 'Descripción de tarjeta',
      card_items: 'Servicios de la tarjeta', card_link_label: 'Enlace de la tarjeta',
    },
    'Página de servicio': {
      territory: 'Ámbito de prestación', page_title: 'Título de la página', page_description: 'Descripción de la página', disclaimer: 'Aviso del servicio',
      page_items: 'Servicios de la página', projects_link_label: 'Enlace a proyectos del servicio', page_territory: 'Territorio de la página',
    },
    'Problemas y audiencia': { problems: 'Problemas que resolvemos', audience: 'Para quién es', whatsapp_message: 'Mensaje prellenado de WhatsApp' },
  },
  people: {
    'Perfil profesional': { label: 'Área profesional', role: 'Cargo y especialidad', bio: 'Biografía', name: 'Nombre de la persona' },
    'Enlaces profesionales': { linkedin_label: 'Etiqueta de LinkedIn', linkedin_url: 'Enlace de LinkedIn' },
    'Experiencia y herramientas': { experience_label: 'Encabezado de trayectoria', jobs: 'Trayectoria laboral', tools: 'Herramientas profesionales' },
    'Foto y credencial': { photo: 'Fotografía (archivo)', credential: 'Credencial profesional' },
  },
  faq: { 'Pregunta frecuente': { area: 'Área', question: 'Pregunta', answer: 'Respuesta' } },
  steps: { 'Paso del proceso': { title: 'Título del paso', description: 'Descripción del paso' } },
  testimonials: { 'Testimonio': { area: 'Área', quote: 'Cita', author: 'Autor', role: 'Cargo o contexto del autor' } },
};

// Fields added for the conversion landing. They are optional everywhere: Directus rows that predate
// them hold NULL (invalid → baseline), and an explicit empty string is a deliberate editorial choice.
export const landingFieldKeys = new Set([
  'legal_whatsapp', 'data_whatsapp', 'contact_email', 'ga4_id', 'privacy_title', 'privacy_policy',
  'hero_legal_cta', 'hero_data_cta', 'steps_title', 'faq_title', 'testimonials_title',
  'form_title', 'form_name_label', 'form_area_label', 'form_area_legal_option', 'form_area_data_option', 'form_message_label',
  'form_whatsapp_label', 'form_email_label', 'form_contact_hint', 'form_submit_label', 'form_error_message',
  'form_message_hint', 'form_error_name', 'form_error_message_length', 'form_error_contact', 'consent_preferences_label',
  'thanks_title', 'thanks_description', 'thanks_back_label',
  'consent_label', 'consent_privacy_link_label', 'consent_banner_text', 'consent_banner_accept_label', 'consent_banner_reject_label',
  'problems', 'audience', 'whatsapp_message', 'photo', 'credential',
]);
const areaChoices = {
  faq: [{ text: 'Jurídica', value: 'legal' }, { text: 'Datos, marketing e IA', value: 'data' }, { text: 'General', value: 'general' }],
  testimonials: [{ text: 'Jurídica', value: 'legal' }, { text: 'Datos, marketing e IA', value: 'data' }],
};
export const localeChoices = [{ text: 'Español', value: 'es' }, { text: 'English', value: 'en' }];

const targets = [
  { text: 'Inicio', value: 'home' }, { text: 'Servicios', value: 'services' }, { text: 'Nosotros', value: 'about' },
  { text: 'Blog', value: 'blog' }, { text: 'Contacto', value: 'contact' },
];
const imageKeys = new Set(['header_logo', 'footer_logo', 'symbol_image', 'social_image']);
const specialFormats = { legal_whatsapp: 'phone', data_whatsapp: 'phone', contact_email: 'email', ga4_id: 'ga4', privacy_policy: 'markdown', photo: 'file' };
const formatLength = { phone: 16, email: 254, ga4: 20, markdown: 50000, file: 36 };
function scalar(key, label, group) {
  const format = specialFormats[key] ?? (imageKeys.has(key) ? 'image' : key.endsWith('_url') || key === 'url' ? 'link' : undefined);
  const required = !landingFieldKeys.has(key) && format !== 'link' && !key.endsWith('_note') && !key.endsWith('disclaimer') && !['projects_link_label', 'experience_label'].includes(key);
  return { key, type: 'string', label, group, required, ...(format ? { format } : {}), maxLength: formatLength[format] ?? (format ? 2048 : 20000) };
}
function field(key, label, group, alias) {
  if (key === 'area') return { ...scalar(key, label, group), choices: structuredClone(areaChoices[alias]), maxLength: 16 };
  const lists = {
    navigation: { maxItems: 10, items: [['target', 'Destino'], ['label', 'Texto del enlace'], ['url', 'URL alternativa']] },
    jobs: { maxItems: 30, items: [['company', 'Empresa'], ['role', 'Cargo'], ['year', 'Año']] },
    tools: { maxItems: 50, items: [['name', 'Nombre de herramienta']] },
    card_items: { maxItems: 30, items: [['label', 'Nombre del servicio']] },
    page_items: { maxItems: 30, items: [['label', 'Nombre del servicio']] },
    problems: { maxItems: 12, items: [['label', 'Problema']] },
  };
  if (!Object.hasOwn(lists, key)) return scalar(key, label, group);
  const list = lists[key];
  return {
    key, type: 'list', label, group, required: false, maxItems: list.maxItems,
    itemFields: list.items.map(([itemKey, itemLabel]) => ({
      ...scalar(itemKey, itemLabel, group), ...(itemKey === 'target' ? { choices: targets } : {}),
    })),
  };
}

// `repeatable` collections hold any number of rows per locale (FAQ, steps, testimonials): editors create
// them freely, ordered by `sort`. Fixed collections keep the approved stable IDs.
const collectionLabels = {
  globals: 'Identidad y enlaces', common: 'Textos comunes', home: 'Inicio', practices: 'Servicios', people: 'Personas',
  faq: 'Preguntas frecuentes', steps: 'Cómo trabajamos', testimonials: 'Testimonios',
};
export const repeatableAliases = ['faq', 'steps', 'testimonials'];
export const websiteCollections = Object.entries(collectionLabels).map(([alias, label]) => ({
  alias, collection: `website_${alias}`, label, singleton: alias === 'globals', repeatable: repeatableAliases.includes(alias),
  records: structuredClone(defaults[`website_${alias}`]),
  fields: Object.entries(editorialGroups[alias]).flatMap(([group, labels]) => Object.entries(labels).map(([key, fieldLabel]) => field(key, fieldLabel, group, alias))),
}));

function isRecord(value) {
  return value !== null && typeof value === 'object' && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function safeUrl(value, image = false) {
  if (typeof value !== 'string' || value.length > 2048 || /[\s\\\p{Cc}\p{Cf}]/u.test(value)) return false;
  // Encoded line breaks/backslashes are unsafe even inside otherwise allowed schemes.
  if (/%(?:0[0-9a-f]|1[0-9a-f]|7f|5c)/i.test(value)) return false;
  if (/^\/(?!\/)/.test(value)) {
    try {
      const decoded = decodeURIComponent(value);
      return !/^\/[/\\]/.test(decoded) && !/[\\\p{Cc}\p{Cf}]/u.test(decoded);
    } catch { return false; }
  }
  if (/^https:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password;
    } catch { return false; }
  }
  return !image && (/^#[^#]+$/.test(value) || /^(?:mailto|tel):[^/].+$/i.test(value));
}

const formatPatterns = {
  phone: /^\+[1-9]\d{6,14}$/,
  email: /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i,
  ga4: /^G-[A-Z0-9]{4,16}$/,
  file: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
};
function validFormat(field, value) {
  if (!field.format || field.format === 'markdown' || (!field.required && value === '')) return true;
  if (formatPatterns[field.format]) return formatPatterns[field.format].test(value);
  return safeUrl(value, field.format === 'image');
}

function validField(field, value) {
  if (field.type === 'list') {
    return Array.isArray(value) && value.length <= field.maxItems && Array.from(value).every(item =>
      isRecord(item) && Object.keys(item).every(key => field.itemFields.some(child => child.key === key)) &&
      field.itemFields.every(child => Object.hasOwn(item, child.key) ? validField(child, item[child.key]) : !child.required));
  }
  return typeof value === 'string' && value.length <= field.maxLength && (!field.required || value.trim().length > 0) &&
    (!field.choices || field.choices.some(choice => choice.value === value)) &&
    validFormat(field, value);
}

const workflowFields = [
  { ...scalar('status', 'Estado de publicación', 'Flujo editorial'), choices: [{ text: 'Borrador', value: 'draft' }, { text: 'Publicado', value: 'published' }] },
  scalar('record_label', 'Nombre editorial del registro', 'Flujo editorial'),
];

export function validateContentPatch(alias, recordId, patch) {
  const definition = websiteCollections.find(item => item.alias === alias);
  if (!definition || !definition.records.some(item => item.id === recordId)) throw new TypeError('Colección o registro desconocido');
  if (!isRecord(patch)) throw new TypeError('El cambio debe ser un objeto');
  for (const key of Object.keys(patch)) {
    const field = [...definition.fields, ...workflowFields].find(field => field.key === key);
    if (!field) throw new TypeError(`Campo no editable: ${key}`);
    if (!validField(field, patch[key])) throw new TypeError(`Valor inválido: ${key}`);
  }
  return structuredClone(patch);
}

function assertLocale(locale) {
  if (locale !== 'es' && locale !== 'en') throw new RangeError('Idioma desconocido');
}

export function navigationHref(item, locale) {
  assertLocale(locale);
  if (safeUrl(item?.url)) return item.url;
  const routes = { home: '', services: '#servicios', about: '#nosotros', blog: 'blog/', contact: '#contacto' };
  const target = item?.target;
  return `/${locale}/${typeof target === 'string' && Object.hasOwn(routes, target) ? routes[target] : ''}`;
}

export function resolveWebsiteContent(records, locale) {
  assertLocale(locale);
  const record = (collection, id) => {
    const baseline = defaults[collection].find(item => item.id === id);
    const result = structuredClone(baseline);
    const override = records?.[collection]?.find(item => item.id === id && item.status === 'published' && (!Object.hasOwn(item, 'locale') || item.locale === baseline.locale));
    if (override) {
      const definition = websiteCollections.find(item => item.collection === collection);
      for (const field of [...definition.fields, ...workflowFields]) {
        if (Object.hasOwn(override, field.key) && validField(field, override[field.key])) result[field.key] = structuredClone(override[field.key]);
      }
    }
    return result;
  };
  const rows = alias => {
    const definition = websiteCollections.find(item => item.alias === alias);
    const valid = row => isRecord(row) && row.status === 'published' && row.locale === locale &&
      definition.fields.every(field => Object.hasOwn(row, field.key) ? validField(field, row[field.key]) : !field.required);
    const project = row => ({
      id: String(row.id), locale, sort: Number.isFinite(row.sort) ? row.sort : null,
      ...Object.fromEntries(definition.fields.map(field => [field.key, Object.hasOwn(row, field.key) ? structuredClone(row[field.key]) : ''])),
    });
    const fromCms = (Array.isArray(records?.[definition.collection]) ? records[definition.collection] : []).filter(valid);
    // Published CMS rows replace the snapshot for that locale; otherwise the approved snapshot is used.
    const chosen = fromCms.length ? fromCms : definition.records.filter(valid);
    return chosen.map(project).sort((a, b) => (a.sort ?? Infinity) - (b.sort ?? Infinity) || a.id.localeCompare(b.id));
  };
  return {
    globals: record('website_globals', 'global'),
    common: record('website_common', locale),
    home: record('website_home', locale),
    practices: Object.fromEntries(['legal', 'data'].map(key => [key, record('website_practices', `${locale}-${key}`)])),
    people: Object.fromEntries(['tatiana', 'henry'].map(key => [key, record('website_people', `${locale}-${key}`)])),
    faq: rows('faq'),
    steps: rows('steps'),
    // Hidden by the template when empty: no testimonial is ever invented in the snapshot.
    testimonials: rows('testimonials'),
  };
}

/** Public Directus asset URL for a file field; empty when no file is set. */
export function websiteFileUrl(fileId, baseUrl = 'https://cms.romahomestore.com') {
  if (typeof fileId !== 'string' || !formatPatterns.file.test(fileId)) return '';
  return new URL(`/assets/${fileId}`, baseUrl).href;
}

/** wa.me link from an E.164 number and a prefilled message; empty when the number is not set. */
export function whatsappHref(number, message = '') {
  if (typeof number !== 'string' || !formatPatterns.phone.test(number)) return '';
  return `https://wa.me/${number.slice(1)}${message ? `?text=${encodeURIComponent(message)}` : ''}`;
}
