import test from 'node:test';
import assert from 'node:assert/strict';
import { websiteCollections as allCollections } from '../src/lib/website-model.mjs';

// Fixed (stable-ID) collections; repeatable ones are covered in directus-schema.test.mjs.
const websiteCollections = allCollections.filter(definition => !definition.repeatable);
import { createCollectionSchema, websiteSchemas, publicReadPermission } from '../scripts/website-schema.mjs';

const field = (schema, key) => schema.fields.find(item => item.field === key);

test('all five fixed collection payloads preserve model identity and native Spanish admin metadata', () => {
  assert.equal(websiteSchemas.length, 8);
  websiteCollections.forEach((definition, index) => {
    const schema = websiteSchemas[index];
    assert.equal(schema.collection, definition.collection);
    assert.deepEqual(schema.schema, {});
    assert.equal(schema.meta.singleton, definition.singleton);
    assert.equal(schema.meta.display_template, '{{record_label}}');
    assert.ok(schema.meta.icon);
    assert.equal(typeof schema.meta.sort, 'number');
    assert.match(schema.meta.note, /diseño.*protegido/i);
    assert.deepEqual(schema.meta.translations.map(t => t.language), ['en-US', 'es-ES']);
    assert.equal(schema.meta.translations.find(t => t.language === 'es-ES').translation, definition.label);
    assert.equal(new Set(schema.fields.map(f => f.field)).size, schema.fields.length);
  });
});

test('IDs are string primary keys, hidden/read-only, and locale/key exist only in baseline', () => {
  websiteCollections.forEach(definition => {
    const schema = createCollectionSchema(definition);
    const id = field(schema, 'id');
    assert.equal(id.type, 'string');
    assert.equal(id.schema.is_primary_key, true);
    assert.equal(id.schema.is_nullable, false);
    assert.equal(id.schema.max_length, 64);
    assert.equal(id.meta.readonly, true);
    assert.equal(id.meta.hidden, true);
    assert.equal(id.schema.default_value, undefined);
    assert.equal(field(schema, 'record_label').type, 'text');
    for (const key of ['locale', 'key']) {
      assert.equal(Boolean(field(schema, key)), definition.records.some(row => Object.hasOwn(row, key)));
      if (field(schema, key)) assert.equal(field(schema, key).meta.readonly, true);
    }
    assert.equal(field(schema, 'status').schema.default_value, 'draft');
    assert.equal(field(schema, 'status').meta.interface, 'select-dropdown');
    assert.deepEqual(field(schema, 'status').meta.options.choices, [{ text: 'Borrador', value: 'draft' }, { text: 'Publicado', value: 'published' }]);
  });
});

test('editorial scalars use TEXT, Spanish labels and native groups, never HTML/code editors', () => {
  websiteCollections.forEach(definition => {
    const schema = createCollectionSchema(definition);
    for (const descriptor of definition.fields) {
      const generated = field(schema, descriptor.key);
      assert.equal(generated.meta.required, descriptor.required);
      assert.equal(generated.meta.translations.find(t => t.language === 'es-ES').translation, descriptor.label);
      const group = field(schema, generated.meta.group);
      assert.equal(group.type, 'alias');
      assert.equal(group.schema, null);
      assert.equal(group.meta.interface, 'group-detail');
      assert.deepEqual(group.meta.special, ['alias', 'no-data', 'group']);
      if (descriptor.format === 'file') {
        assert.equal(generated.type, 'uuid');
        assert.equal(generated.meta.interface, 'file-image');
        assert.deepEqual(generated.meta.special, ['file']);
        continue;
      }
      if (descriptor.type === 'string') {
        assert.equal(generated.type, 'text');
        if (descriptor.format === 'markdown') {
          // The only formatted editor: Markdown (no HTML), sanitized by the site when rendered.
          assert.equal(generated.meta.interface, 'input-rich-text-md');
          continue;
        }
        assert.ok(['input', 'input-multiline', 'select-dropdown'].includes(generated.meta.interface));
        if (descriptor.format) assert.equal(generated.meta.interface, 'input');
        if (['image', 'link'].includes(descriptor.format)) assert.match(generated.meta.note, /URL/);
        if (descriptor.format === 'phone') assert.match(generated.meta.note, /E\.164/);
        if (descriptor.format === 'image') assert.match(generated.meta.note, /Files/);
      }
    }
    assert.ok(!JSON.stringify(schema).includes('input-code'));
    assert.ok(!JSON.stringify(schema).replaceAll('input-rich-text-md', '').includes('input-rich-text'));
    assert.ok(!JSON.stringify(schema).includes('input-rich-text-html'));
  });
});

test('lists have typed native item fields, choices and useful templates', () => {
  for (const definition of websiteCollections) {
    const schema = createCollectionSchema(definition);
    for (const descriptor of definition.fields.filter(f => f.type === 'list')) {
      const generated = field(schema, descriptor.key);
      assert.equal(generated.type, 'json');
      assert.deepEqual(generated.meta.special, ['cast-json']);
      assert.equal(generated.meta.interface, 'list');
      assert.equal(generated.meta.options.limit, descriptor.maxItems);
      assert.match(generated.meta.options.template, /\{\{(?:label|name|company)\}\}/);
      assert.equal(generated.meta.options.fields.length, descriptor.itemFields.length);
      descriptor.itemFields.forEach((item, index) => {
        const child = generated.meta.options.fields[index];
        assert.equal(child.field, item.key);
        assert.equal(child.name, item.label);
        assert.equal(child.type, 'string');
        assert.equal(child.meta.required, item.required);
        assert.equal(typeof child.meta.options, 'object');
        if (item.choices) {
          assert.equal(child.meta.interface, 'select-dropdown');
          assert.deepEqual(child.meta.options.choices, item.choices);
        } else assert.equal(child.meta.interface, 'input');
      });
    }
  }
});

test('scalar choices are native dropdowns and schema generation does not mutate input', () => {
  // Explicitly synthetic descriptor, not public site copy.
  const fixture = { alias: 'fixture', collection: 'website_fixture', label: 'Prueba', singleton: false,
    records: [{ id: 'fixture' }], fields: [{ key: 'tone', type: 'string', label: 'Tono', group: 'Prueba', required: true, choices: [{ text: 'Prueba', value: 'test' }], maxLength: 20 }] };
  const before = structuredClone(fixture);
  const generated = field(createCollectionSchema(fixture), 'tone');
  assert.equal(generated.type, 'text');
  assert.equal(generated.meta.interface, 'select-dropdown');
  assert.deepEqual(generated.meta.options.choices, fixture.fields[0].choices);
  assert.deepEqual(fixture, before);
});

test('public policy grants ONLY published reads and explicit editorial fields', () => {
  for (const definition of websiteCollections) {
    const permission = publicReadPermission(definition, 'synthetic-policy-id');
    assert.deepEqual(permission, {
      collection: definition.collection,
      policy: 'synthetic-policy-id',
      action: 'read',
      permissions: { status: { _eq: 'published' } },
      fields: ['id', 'status', ...(definition.records.some(r => Object.hasOwn(r, 'locale')) ? ['locale'] : []), ...definition.fields.map(f => f.key)],
    });
    assert.ok(!permission.fields.includes('record_label'));
    assert.ok(!permission.fields.includes('record_label'));
    assert.ok(!permission.fields.includes('key'));
  }
  assert.throws(() => publicReadPermission(websiteCollections[0]), /pol[ií]tica/i);
});
