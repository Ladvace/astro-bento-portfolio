import { websiteCollections, localeChoices } from '../src/lib/website-model.mjs';

const translations = label => [
  { language: 'en-US', translation: label },
  { language: 'es-ES', translation: label },
];
const icons = { globals: 'public', common: 'translate', home: 'home', practices: 'work', people: 'groups', faq: 'quiz', steps: 'format_list_numbered', testimonials: 'format_quote' };
const displayTemplates = { faq: '{{area}} · {{question}}', steps: '{{sort}}. {{title}}', testimonials: '{{author}} · {{quote}}' };
const statusChoices = [{ text: 'Borrador', value: 'draft' }, { text: 'Publicado', value: 'published' }];
const formatNotes = {
  image: 'URL pública de imagen, sin HTML. Suba el archivo a Files y pegue su URL pública; también puede conservar la ruta del recurso existente.',
  link: 'URL del enlace como texto, sin HTML. Use una ruta o un protocolo permitido; no cambia las rutas del sitio.',
  phone: 'Número en formato internacional E.164, sin espacios: + código de país y número (ej. +573001234567). Vacío oculta el botón de WhatsApp.',
  email: 'Correo visible de respaldo, sin «mailto:».',
  ga4: 'ID de medición de Google Analytics 4 (G-XXXXXXX). Déjelo vacío para desactivar GA4 sin cambiar código.',
  markdown: 'Texto en Markdown (títulos, listas, enlaces). No pegue HTML: se sanea al publicar.',
  file: 'Suba o elija una imagen de Files. Debe ser una foto profesional; se publica tras la compilación.',
};
const hasBaselineField = (definition, key) => definition.records.some(row => Object.hasOwn(row, key));

function inputOptions(descriptor) {
  return descriptor.choices ? { choices: structuredClone(descriptor.choices) } : { ...(descriptor.maxLength ? { maxLength: descriptor.maxLength } : {}) };
}

function scalarMeta(descriptor, multiline = true) {
  const note = formatNotes[descriptor.format] ?? 'Texto plano, sin HTML. El diseño permanece protegido.';
  const multilineKey = /description|bio|disclaimer|note|answer|quote|audience|message|consent_label|banner_text/.test(descriptor.key);
  return {
    interface: descriptor.choices ? 'select-dropdown' : descriptor.format === 'markdown' ? 'input-rich-text-md' : multiline && !descriptor.format && multilineKey ? 'input-multiline' : 'input',
    options: inputOptions(descriptor),
    required: Boolean(descriptor.required),
    translations: translations(descriptor.label),
    note,
  };
}

function editorialField(descriptor, group) {
  if (descriptor.format === 'file') return {
    field: descriptor.key,
    type: 'uuid',
    schema: { is_nullable: true },
    meta: {
      interface: 'file-image', special: ['file'], required: false, group,
      translations: translations(descriptor.label), note: formatNotes.file,
    },
  };
  if (descriptor.type !== 'list') return {
    field: descriptor.key,
    type: 'text',
    schema: { is_nullable: !descriptor.required },
    meta: { ...scalarMeta(descriptor), group },
  };
  const templateKey = ['label', 'name', 'company'].find(key => descriptor.itemFields.some(child => child.key === key)) ?? descriptor.itemFields[0]?.key;
  return {
    field: descriptor.key,
    type: 'json',
    schema: { is_nullable: !descriptor.required },
    meta: {
      interface: 'list',
      special: ['cast-json'],
      required: Boolean(descriptor.required),
      group,
      translations: translations(descriptor.label),
      note: 'Añada o edite elementos mediante sus campos. Sin HTML ni editor de código JSON; el diseño permanece protegido.',
      options: {
        limit: descriptor.maxItems,
        template: `{{${templateKey}}}`,
        fields: descriptor.itemFields.map(child => ({
          field: child.key,
          name: child.label,
          type: 'string',
          meta: scalarMeta(child, false),
        })),
      },
    },
  };
}

function repeatableBaseFields() {
  return [
    {
      field: 'id', type: 'uuid',
      schema: { is_primary_key: true, is_nullable: false },
      meta: { interface: 'input', special: ['uuid'], readonly: true, hidden: true, translations: translations('Identificador'), note: 'Se genera automáticamente.' },
    },
    {
      field: 'status', type: 'string', schema: { default_value: 'draft', is_nullable: false, max_length: 16 },
      meta: {
        interface: 'select-dropdown', required: true, translations: translations('Estado de publicación'), width: 'half',
        options: { choices: structuredClone(statusChoices) },
        note: 'Solo los registros publicados se muestran en la web tras la siguiente compilación.',
      },
    },
    {
      field: 'locale', type: 'string', schema: { default_value: 'es', is_nullable: false, max_length: 8 },
      meta: { interface: 'select-dropdown', required: true, width: 'half', translations: translations('Idioma'), options: { choices: structuredClone(localeChoices) }, note: 'Cada idioma es un registro independiente; no hay traducción automática.' },
    },
    {
      field: 'sort', type: 'integer', schema: { is_nullable: true },
      meta: { interface: 'input', hidden: true, translations: translations('Orden'), note: 'Arrastre los registros en la lista para ordenarlos.' },
    },
  ];
}

/** Pure Directus collection-create payload. It never writes to the CMS. */
export function createCollectionSchema(definition) {
  if (definition.repeatable) {
    const fields = repeatableBaseFields();
    for (const descriptor of definition.fields) fields.push(editorialField(descriptor, null));
    fields.forEach((field, sort) => { field.meta.sort = sort + 1; });
    return {
      collection: definition.collection,
      meta: {
        singleton: false,
        icon: icons[definition.alias] ?? 'article',
        translations: translations(definition.label),
        display_template: displayTemplates[definition.alias] ?? '{{id}}',
        sort_field: 'sort',
        note: 'Contenido editorial repetible por idioma. Solo lo publicado aparece en la web tras la compilación.',
        sort: Math.max(0, websiteCollections.findIndex(item => item.alias === definition.alias)) + 1,
      },
      schema: {},
      fields,
    };
  }
  const fields = [
    {
      field: 'id', type: 'string',
      schema: { is_primary_key: true, is_nullable: false, max_length: 64 },
      meta: { interface: 'input', readonly: true, hidden: true, translations: translations('Identificador estable'), note: 'ID del registro aprobado; no generar ni modificar.' },
    },
    {
      field: 'record_label', type: 'text', schema: { is_nullable: false },
      meta: { interface: 'input', required: true, translations: translations('Nombre editorial del registro'), note: 'Nombre para identificar el registro en el administrador; no se muestra en la web.' },
    },
    {
      field: 'status', type: 'string', schema: { default_value: 'draft', is_nullable: false },
      meta: {
        interface: 'select-dropdown', required: true, translations: translations('Estado de publicación'),
        options: { choices: [{ text: 'Borrador', value: 'draft' }, { text: 'Publicado', value: 'published' }] },
        note: 'Solo los registros publicados podrán leerse públicamente. La web estática requiere una nueva compilación.',
      },
    },
  ];
  for (const [key, label] of [['locale', 'Idioma'], ['key', 'Clave estable']]) {
    if (hasBaselineField(definition, key)) fields.push({
      field: key, type: 'string', schema: { is_nullable: false, max_length: 64 },
      meta: { interface: 'input', readonly: true, translations: translations(label), note: 'Metadato del registro aprobado; no modificar.' },
    });
  }
  const groups = new Map();
  for (const descriptor of definition.fields) {
    if (!groups.has(descriptor.group)) {
      const alias = `editorial_group_${groups.size + 1}`;
      groups.set(descriptor.group, alias);
      fields.push({
        field: alias, type: 'alias', schema: null,
        meta: { interface: 'group-detail', special: ['alias', 'no-data', 'group'], options: { start: 'open' }, translations: translations(descriptor.group) },
      });
    }
    fields.push(editorialField(descriptor, groups.get(descriptor.group)));
  }
  fields.forEach((field, sort) => { field.meta.sort = sort + 1; });
  return {
    collection: definition.collection,
    meta: {
      singleton: definition.singleton,
      icon: icons[definition.alias] ?? 'article',
      translations: translations(definition.label),
      display_template: '{{record_label}}',
      note: 'Contenido editorial: diseño protegido. Código, estructura, tipografías, CSS y rutas válidas no se editan aquí. Publicación estática tras compilación y despliegue aprobados.',
      sort: Math.max(0, websiteCollections.findIndex(item => item.alias === definition.alias)) + 1,
    },
    schema: {},
    fields,
  };
}

export const websiteSchemas = websiteCollections.map(createCollectionSchema);

/** Caller supplies the reviewed public policy ID; no other action is granted. */
export function publicReadPermission(definition, policyId) {
  if (typeof policyId !== 'string' || !policyId.trim()) throw new TypeError('Se requiere el ID de la política pública');
  return {
    collection: definition.collection,
    policy: policyId,
    action: 'read',
    permissions: { status: { _eq: 'published' } },
    fields: publicFields(definition),
  };
}

/** Exactly the fields the build reads: never record_label, key or system metadata. */
export function publicFields(definition) {
  return ['id', 'status', ...(definition.repeatable || hasBaselineField(definition, 'locale') ? ['locale'] : []), ...(definition.repeatable ? ['sort'] : []), ...definition.fields.map(field => field.key)];
}

/** M2O relations for Directus file fields (website_people.photo → directus_files). */
export const websiteRelations = websiteCollections.flatMap(definition => definition.fields
  .filter(field => field.format === 'file')
  .map(field => ({ collection: definition.collection, field: field.key, related_collection: 'directus_files', schema: { on_delete: 'SET NULL' }, meta: { sort_field: null } })));

// ---------------------------------------------------------------------------------------------
// Leads inbox: private collection. Only the lead-writer policy may create; nobody public reads.
// ---------------------------------------------------------------------------------------------
const leadAreaChoices = [{ text: 'Jurídica', value: 'legal' }, { text: 'Datos, marketing e IA', value: 'data' }];
export const leadStatusChoices = [{ text: 'Nuevo', value: 'nuevo' }, { text: 'Contactado', value: 'contactado' }, { text: 'Descartado', value: 'descartado' }];
export const crmStatusChoices = [{ text: 'Pendiente', value: 'pending' }, { text: 'Sincronizado', value: 'synced' }, { text: 'Error', value: 'error' }];

function leadField(field, type, label, { maxLength, required = false, readonly = false, hidden = false, interface: iface, choices, defaultValue, special, note, width = 'half' } = {}) {
  return {
    field, type,
    schema: { is_nullable: !required, ...(maxLength ? { max_length: maxLength } : {}), ...(defaultValue !== undefined ? { default_value: defaultValue } : {}) },
    meta: {
      interface: iface ?? (choices ? 'select-dropdown' : type === 'boolean' ? 'boolean' : type === 'text' ? 'input-multiline' : 'input'),
      ...(choices ? { options: { choices: structuredClone(choices) }, display: 'labels' } : {}),
      ...(special ? { special } : {}),
      required, readonly, hidden, width,
      translations: translations(label),
      ...(note ? { note } : {}),
    },
  };
}

export const leadsSchema = (() => {
  const fields = [
    leadField('id', 'uuid', 'Identificador', { readonly: true, hidden: true, special: ['uuid'] }),
    leadField('date_created', 'timestamp', 'Recibido', { readonly: true, special: ['date-created'], interface: 'datetime' }),
    leadField('status', 'string', 'Estado del lead', { maxLength: 16, required: true, choices: leadStatusChoices, defaultValue: 'nuevo', note: 'Actualice el estado tras contactar a la persona.' }),
    leadField('area', 'string', 'Área', { maxLength: 8, required: true, choices: leadAreaChoices, readonly: true }),
    leadField('name', 'string', 'Nombre', { maxLength: 120, required: true, readonly: true }),
    leadField('contact_whatsapp', 'string', 'WhatsApp', { maxLength: 20, readonly: true }),
    leadField('contact_email', 'string', 'Correo', { maxLength: 254, readonly: true }),
    leadField('message', 'text', 'Mensaje', { readonly: true, width: 'full' }),
    leadField('locale', 'string', 'Idioma', { maxLength: 8, choices: localeChoices, readonly: true }),
    leadField('consent', 'boolean', 'Consentimiento (Ley 1581/2012)', { required: true, defaultValue: false, readonly: true }),
    leadField('consent_text', 'text', 'Texto de consentimiento aceptado', { readonly: true, width: 'full' }),
    leadField('page', 'string', 'Página de origen', { maxLength: 2048, readonly: true, width: 'full' }),
    leadField('utm_source', 'string', 'utm_source', { maxLength: 255, readonly: true }),
    leadField('utm_medium', 'string', 'utm_medium', { maxLength: 255, readonly: true }),
    leadField('utm_campaign', 'string', 'utm_campaign', { maxLength: 255, readonly: true }),
    leadField('posthog_distinct_id', 'string', 'PostHog distinct_id', { maxLength: 200, readonly: true }),
    leadField('crm_status', 'string', 'Estado en Twenty CRM', { maxLength: 16, required: true, choices: crmStatusChoices, defaultValue: 'pending', readonly: true }),
    leadField('twenty_person_id', 'string', 'Twenty: persona', { maxLength: 64, readonly: true }),
    leadField('twenty_opportunity_id', 'string', 'Twenty: oportunidad', { maxLength: 64, readonly: true }),
    leadField('crm_error', 'text', 'Error de sincronización CRM', { readonly: true, width: 'full' }),
  ];
  fields[0].schema = { is_primary_key: true, is_nullable: false };
  fields.forEach((field, sort) => { field.meta.sort = sort + 1; });
  return {
    collection: 'leads',
    meta: {
      singleton: false, icon: 'inbox', sort: websiteCollections.length + 1,
      translations: translations('Leads'),
      display_template: '{{name}} · {{area}} · {{status}}',
      sort_field: null,
      archive_field: 'status', archive_value: 'descartado', unarchive_value: 'nuevo', archive_app_filter: true,
      note: 'Bandeja privada de leads del formulario web. Sin acceso público. La sincronización con Twenty la hace un Flow.',
    },
    schema: {},
    fields,
  };
})();

/** Fields the public website endpoint may set. Never status, crm_*, twenty_* or system fields. */
export const leadWriterFields = ['name', 'area', 'message', 'contact_whatsapp', 'contact_email', 'locale', 'consent', 'consent_text', 'page', 'utm_source', 'utm_medium', 'utm_campaign', 'posthog_distinct_id'];

// Stable IDs used only if the policy/role does not already exist BY NAME. Existing IDs always win.
export const accessModel = {
  leadWriter: {
    policy: { id: '6c1f3b0e-2a51-4c3e-9f0a-1d7e5b2c4a01', name: 'website-lead-writer', icon: 'edit_note', admin_access: false, app_access: false, enforce_tfa: false, description: 'Solo crea leads desde la web (token estático del servidor). Sin lectura.' },
    role: { id: '6c1f3b0e-2a51-4c3e-9f0a-1d7e5b2c4a02', name: 'website-lead-writer', icon: 'edit_note', description: 'Rol técnico del endpoint /api/lead. Su token lo crea el orquestador.' },
  },
  editorLegal: {
    policy: { id: '6c1f3b0e-2a51-4c3e-9f0a-1d7e5b2c4a03', name: 'editor-legal', icon: 'gavel', admin_access: false, app_access: true, enforce_tfa: false, description: 'Tatiana: contenido jurídico de la web y leads del área legal.' },
    role: { id: '6c1f3b0e-2a51-4c3e-9f0a-1d7e5b2c4a04', name: 'editor-legal', icon: 'gavel', description: 'Editora del área jurídica. Asignar al usuario de Tatiana manualmente.' },
  },
};

export function leadWriterPermissions(policyId) {
  return [{
    collection: 'leads', policy: policyId, action: 'create',
    fields: [...leadWriterFields], permissions: null,
    validation: { _and: [{ consent: { _eq: true } }, { area: { _in: ['legal', 'data'] } }] },
    presets: null,
  }];
}

/** Least privilege for the legal editor. Henry keeps the Administrator role. */
export function editorLegalPermissions(policyId) {
  const def = alias => websiteCollections.find(item => item.alias === alias);
  const editorial = alias => def(alias).fields.map(field => field.key);
  const rowFields = alias => ['locale', 'status', 'sort', ...editorial(alias)];
  const legal = { area: { _eq: 'legal' } };
  const p = (collection, action, fields, permissions = {}, validation = null) => ({ collection, policy: policyId, action, fields, permissions, validation, presets: null });
  const readAll = collection => p(collection, 'read', ['*']);
  return [
    readAll('website_globals'), p('website_globals', 'update', ['legal_whatsapp']),
    readAll('website_common'),
    readAll('website_home'), p('website_home', 'update', ['hero_legal_cta', 'form_area_legal_option']),
    readAll('website_practices'), p('website_practices', 'update', ['status', ...editorial('practices')], { key: { _eq: 'legal' } }),
    readAll('website_people'), p('website_people', 'update', ['status', ...editorial('people')], { key: { _eq: 'tatiana' } }),
    readAll('website_steps'),
    ...['faq', 'testimonials'].flatMap(alias => [
      readAll(`website_${alias}`),
      p(`website_${alias}`, 'create', rowFields(alias), {}, legal),
      p(`website_${alias}`, 'update', rowFields(alias), legal, legal),
      p(`website_${alias}`, 'delete', ['*'], legal),
    ]),
    p('leads', 'read', ['*'], legal),
    p('leads', 'update', ['status'], legal),
    // Photo upload for her own profile. Files stay private unless the public policy reads them.
    readAll('directus_files'),
    p('directus_files', 'create', ['*']),
    p('directus_files', 'update', ['*'], { uploaded_by: { _eq: '$CURRENT_USER' } }),
  ];
}

export const buildFlowName = 'Trigger Coolify Build';
export const buildFlowCollections = websiteCollections.map(definition => definition.collection);
/** Collections that must never trigger a public rebuild (private data). */
export const neverBuildCollections = ['leads'];
