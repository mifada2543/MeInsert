/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogs, getLanguage, onLanguageChange, resolveLanguage, setLanguage, t, translateSource } from '../../assets/js/i18n/index.js';

const placeholders = (text) => [...new Set(String(text).match(/\{\w+\}/g) || [])].sort();
test('i18n catalogs have identical semantic keys and interpolation placeholders', () => {
  assert.deepEqual(Object.keys(catalogs.id).sort(), Object.keys(catalogs.en).sort());
  for (const [key, original] of Object.entries(catalogs.id)) {
    const expected = placeholders(typeof original === 'object' ? original.other : original);
    for (const text of typeof catalogs.en[key] === 'object' ? Object.values(catalogs.en[key]) : [catalogs.en[key]]) {
      assert.equal(typeof text, 'string', key);
      assert.ok(text.length > 0, key);
      assert.deepEqual(placeholders(text), expected, key);
    }
  }
});
test('i18n preference order is stored, supported navigator language, Indonesian fallback', () => {
  assert.equal(resolveLanguage('id', ['en-US']), 'id');
  assert.equal(resolveLanguage('en', ['id-ID']), 'en');
  assert.equal(resolveLanguage(null, ['fr-FR', 'en-GB']), 'en');
  assert.equal(resolveLanguage('invalid', ['id-ID']), 'id');
  assert.equal(resolveLanguage(null, ['fr-FR']), 'id');
  assert.equal(resolveLanguage(null, []), 'id');
});
test('i18n safely interpolates plain text, falls back to Indonesian, and uses Intl plurals', () => {
  assert.equal(t('page.title', {}, 'unsupported'), catalogs.id['page.title']);
  const title = catalogs.en['page.title'];
  try {
    delete catalogs.en['page.title'];
    assert.equal(t('page.title', {}, 'en'), catalogs.id['page.title']);
  } finally {
    catalogs.en['page.title'] = title;
  }
  assert.equal(t('missing.key', {}, 'en'), 'missing.key');
  assert.equal(t('count.files', { count: 1 }, 'en'), '1 file');
  assert.equal(t('count.files', { count: 2 }, 'en'), '2 files');
  assert.equal(t('count.files', { count: 2 }, 'id'), '2 file');
  assert.equal(t('ui.outputName', { v0: '<img onerror="alert(1)">' }, 'en'), 'Output name: <img onerror="alert(1)">');
  assert.equal(t('ui.outputName', {}, 'en'), 'Output name: {v0}');
});
test('presentation source templates preserve embedded names and raw diagnostics', () => {
  setLanguage('en', { persist: false });
  assert.equal(translateSource('Membaca Judul…'), 'Reading Judul…');
  assert.equal(translateSource('Hapus tag Judul'), 'Remove tag Judul');
  assert.equal(translateSource('Artis'), 'Artist');
  assert.equal(translateSource('2 file dipilih'), '2 files selected');
  assert.equal(translateSource('Apply to 1 file'), 'Apply to 1 file');
  assert.equal(translateSource('Output name: Judul file'), 'Output name: Judul file');
  assert.equal(translateSource('Unknown library diagnostic <foo>'), 'Unknown library diagnostic <foo>');
  setLanguage('id', { persist: false });
  assert.equal(translateSource('Membaca Judul…'), 'Membaca Judul…');
  assert.equal(translateSource('Album artist'), 'Artis album');
  assert.equal(translateSource('Creator'), 'Pembuat');
});
test('language subscription can be removed and invalid locales fall back safely', () => {
  const values = [];
  const unsubscribe = onLanguageChange((locale) => values.push(locale));
  setLanguage('en', { persist: false });
  unsubscribe();
  setLanguage('xx', { persist: false });
  assert.deepEqual(values, ['en']);
  assert.equal(getLanguage(), 'id');
});
