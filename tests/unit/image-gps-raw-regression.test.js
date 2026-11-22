/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildTagMap, mapTags, read, write } from '../../assets/js/formats/image.js';
import { writeTags, readTags } from '../../assets/js/engines/exiftool.js';
import { t } from '../../assets/js/i18n/index.js';
import { collectChanges } from '../../assets/js/editor/editor-changes.js';

function fixture(ext = 'jpg') {
  return new File([readFileSync(`tests/fixtures/pattern.${ext}`)], `pattern.${ext}`);
}
const jpeg = { extension: 'jpg', subtype: 'jpeg', mime: 'image/jpeg' };
const png = { extension: 'png', subtype: 'png', mime: 'image/png' };

test('negative altitude uses EXIF GPSAltitudeRef, and zero uses sea-level-above reference', () => {
  const negative = buildTagMap({ set: { gpsAltitude: '-15.5' } }, 'jpeg');
  assert.equal(negative['GPS:GPSAltitude'], '15.5');
  assert.equal(negative['GPS:GPSAltitudeRef'], 'Below Sea Level');
  const zero = buildTagMap({ set: { gpsAltitude: '0' } }, 'jpeg');
  assert.equal(zero['GPS:GPSAltitudeRef'], 'Above Sea Level');
  const removal = buildTagMap({ remove: ['gpsAltitude'] }, 'jpeg');
  assert.equal(removal['GPS:GPSAltitude'], '');
  assert.equal(removal['GPS:GPSAltitudeRef'], '');
});
test('negative altitude survives real JPEG and PNG ExifTool round trip', async () => {
  for (const [ext, options] of [['jpg', jpeg], ['png', png]]) {
    const out = await write(fixture(ext), {
      set: { gpsLatitude: '-6.2088', gpsLongitude: '106.8456', gpsAltitude: '-15.5', gpsDate: '2026-02-03' },
      remove: [],
    }, options);
    assert.deepEqual(out.warnings, [], `${ext}: ${out.warnings.join('; ')}`);
    assert.equal(out.fields.gpsAltitude, '-15.5', ext);
    assert.equal(out.fields.gpsLatitude, '-6.2088', ext);
    assert.equal(out.fields.gpsLongitude, '106.8456', ext);
    assert.equal(out.fields.gpsDate, '2026-02-03', ext);
    const outputFile = new File([out.blob], `output.${ext}`);
    const reread = await read(outputFile, options);
    assert.equal(reread.fields.gpsAltitude, '-15.5');
    const raw = await readTags(outputFile);
    const ref = ext === 'png' ? 'XMP-exif:GPSAltitudeRef' : 'GPS:GPSAltitudeRef';
    assert.equal(raw[ref], 'Below Sea Level', ext);
    if (ext === 'png') {
      assert.equal(raw['GPS:GPSAltitude'], undefined, 'PNG GPS should be XMP-only');
      assert.equal(raw['XMP-exif:GPSDateTime'], '2026:02:03');
    }
  }
});
test('existing below sea level EXIF reference and composite value parse as negative', async () => {
  const bytes = await writeTags(fixture(), { 'GPS:GPSAltitude': '15.5', 'GPS:GPSAltitudeRef': 'Below Sea Level' });
  const tags = await readTags(new File([bytes], 'below.jpg'));
  assert.equal(mapTags(tags, 'jpeg').gpsAltitude, '-15.5');
  assert.equal(mapTags({ 'Composite:GPSAltitude': '15.5 m Below Sea Level' }, 'jpeg').gpsAltitude, '-15.5');
});
test('RAW, HEIC, PNG and WebP request XMP tags only for standard fields', () => {
  const payload = { set: {
    creator: 'Artist', description: 'desc', rights: '© 2026', software: 'MeInsert',
    gpsLatitude: '-6.2088', gpsLongitude: '106.8456', gpsAltitude: '-15.5', gpsDate: '2026-02-03',
  } };
  for (const subtype of ['png', 'webp', 'dng', 'cr2', 'cr3', 'nef', 'arw', 'orf', 'rw2', 'raf', 'heic', 'heif']) {
    const tags = buildTagMap(payload, subtype);
    assert.ok(Object.keys(tags).every((k) => /^XMP[-.]/i.test(k)), subtype);
    assert.equal(tags['XMP-exif:GPSAltitudeRef'], 'Below Sea Level', subtype);
    assert.equal(tags['XMP-exif:GPSDateTime'], '2026:02:03', subtype);
  }
});
test('XMP-only blocks non-XMP custom/raw removal rather than silently rewriting EXIF', () => {
  const cases = [
    { payload: { custom: [{ key: 'EXIF:Artist', value: 'malicious' }] }, key: 'ui.unsupportedTagWrite', v0: 'EXIF:Artist' },
    { payload: { customRemove: ['GPS:GPSLatitude'] }, key: 'ui.unsupportedTagRemove', v0: 'GPS:GPSLatitude' },
    { payload: { rawRemove: ['EXIF:Copyright'] }, key: 'ui.unsupportedTagRemove', v0: 'EXIF:Copyright' },
  ];
  for (const item of cases) {
    assert.throws(() => buildTagMap(item.payload, 'nef'), (error) => error.code === 'UNSUPPORTED_TAG'
      && error.message === t(item.key, { v0: item.v0 }));
  }
});
test('GPS coordinate validation rejects invalid/malformed values before write', () => {
  for (const bad of ['91', '-90.0001', 'Infinity', '12.0N', '12abc', 'NaN', '', '1e4']) {
    assert.throws(() => buildTagMap({ set: { gpsLatitude: bad } }, 'jpeg'), { code: 'INVALID_GPS' }, bad);
  }
  for (const bad of ['181', '-180.01', 'oops']) {
    assert.throws(() => buildTagMap({ set: { gpsLongitude: bad } }, 'heic'), { code: 'INVALID_GPS' }, bad);
  }
  assert.equal(buildTagMap({ set: { gpsLatitude: '-90', gpsLongitude: '180' } }, 'jpeg')['GPS:GPSLatitudeRef'], 'S');
});

test('XMP GPS wins over old native GPS when both exist on a RAW image', () => {
  const fields = mapTags({
    'GPS:GPSLatitude': '6 deg 12\' 0"',
    'GPS:GPSLatitudeRef': 'South',
    'XMP-exif:GPSLatitude': '6 deg 12\' 31.68" N',
    'GPS:GPSAltitude': '30 m',
    'GPS:GPSAltitudeRef': 'Below Sea Level',
    'XMP-exif:GPSAltitude': '15.5 m',
    'XMP-exif:GPSAltitudeRef': 'Above Sea Level',
  }, 'dng');
  assert.equal(fields.gpsLatitude, '6.2088');
  assert.equal(fields.gpsAltitude, '15.5');
});

test('collectChanges reports XMP-only custom tag errors before save', () => {
  const state = {
    adapter: { meta: { id: 'image' }, fieldsFor: () => [] },
    detection: { subtype: 'nef' },
    originalValues: {},
    removedFields: new Set(),
    values: {},
    customRows: [{ key: 'EXIF:Artist', value: 'x', originalKey: '', originalValue: '' }],
    removedCustom: new Set(),
    rawRemove: new Set(['GPS:GPSLatitude']),
    coverAction: 'keep',
    sidecar: null,
    trim: null,
  };
  const result = collectChanges(state, { validate: true });
  assert.ok(result.errors.includes(t('ui.unsupportedTagWrite', { v0: 'EXIF:Artist' })));
  assert.ok(result.errors.includes(t('ui.unsupportedTagRemove', { v0: 'GPS:GPSLatitude' })));
});
