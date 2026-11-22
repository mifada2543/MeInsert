/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import image, {
  buildTagMap, fieldsFor, mapTags, meta, read, write, xmpOnly,
} from '../../assets/js/formats/image.js';
import { collectChanges } from '../../assets/js/editor/editor-changes.js';
import { createSnapshot } from '../../assets/js/core/metadata-snapshot.js';
import { buildChangePlan } from '../../assets/js/core/change-plan.js';
import { verifyIntegrity } from '../../assets/js/core/integrity.js';
import { buildCleanPayload } from '../../assets/js/core/privacy-categories.js';
import { crossTarget } from '../../assets/js/core/format-map.js';
const detection = { id: 'image', subtype: 'jpeg', label: 'Gambar', ext: 'jpg', mime: 'image/jpeg' };
const options = { extension: 'jpg', subtype: 'jpeg', mime: 'image/jpeg' };
const newIds = [
  'gpsLatitude', 'gpsLongitude', 'gpsAltitude', 'gpsDate', 'credit', 'source',
  'captionWriter', 'jobTitle', 'copyrightOwner', 'rating', 'label', 'identifier', 'location',
];
const rawSubtypes = ['heic', 'heif', 'dng', 'cr2', 'cr3', 'nef', 'arw', 'orf', 'rw2', 'raf'];
function fixtureFile() {
  return new File([readFileSync('tests/fixtures/gps-iptc.jpg')], 'gps-iptc.jpg', { type: 'image/jpeg' });
}
function stateFrom(before, edits = {}) {
  const values = {};
  const originalValues = {};
  for (const field of image.fieldsFor('jpeg')) {
    const original = String(before.fields[field.id] ?? '');
    originalValues[field.id] = original;
    values[field.id] = Object.hasOwn(edits, field.id) ? edits[field.id] : original;
  }
  return {
    adapter: image,
    detection,
    originalValues,
    values,
    removedFields: new Set(),
    customRows: [],
    removedCustom: new Set(),
    rawRemove: new Set(),
    coverAction: 'keep',
    sidecar: null,
    trim: null,
  };
}
function planFor(before, state, name = 'result.jpg') {
  const baseline = createSnapshot({ adapter: image, detection, readResult: before });
  const { payload, errors } = collectChanges(state);
  assert.deepEqual(errors, []);
  const plan = buildChangePlan({ adapter: image, detection, baseline, payload, outputName: name });
  return { baseline, payload, plan };
}
async function roundTrip(plan, name = 'result.jpg') {
  const written = await write(fixtureFile(), plan.payload, options, () => {});
  const after = await read(new File([await written.blob.arrayBuffer()], name, { type: 'image/jpeg' }), options);
  const result = verifyIntegrity(plan, createSnapshot({ adapter: image, detection, readResult: after }));
  return { written, after, result };
}
test('image adapter advertises HEIC and RAW extensions', () => {
  for (const ext of ['heic', 'heif', 'dng', 'cr2', 'cr3', 'nef', 'arw', 'orf', 'rw2', 'raf']) {
    assert.ok(meta.extensions.includes(ext), `missing extension ${ext}`);
  }
  assert.ok(meta.extensions.includes('jpg'));
  assert.ok(meta.extensions.includes('tiff'));
});
test('xmpOnly covers PNG, WebP, HEIC and RAW while JPEG and TIFF keep EXIF', () => {
  for (const subtype of ['png', 'webp', ...rawSubtypes]) {
    assert.equal(xmpOnly(subtype), true, `expected XMP-only for ${subtype}`);
  }
  assert.equal(xmpOnly('HEIC'), true);
  assert.equal(xmpOnly('jpeg'), false);
  assert.equal(xmpOnly('tiff'), false);
  assert.equal(xmpOnly(undefined), false);
});
test('HEIC and RAW fields include camera XMP, GPS/IPTC fields, and no comment', () => {
  for (const subtype of rawSubtypes) {
    const ids = fieldsFor(subtype).map((field) => field.id);
    assert.equal(ids.includes('comment'), false, `${subtype} must not expose comment`);
    assert.ok(newIds.every((id) => ids.includes(id)), `${subtype} missing new fields`);
    const camera = fieldsFor(subtype).find((field) => field.id === 'make');
    assert.equal(camera.native, 'XMP-tiff:Make');
  }
  const jpeg = fieldsFor('jpeg');
  assert.ok(jpeg.some((field) => field.id === 'comment' && field.native === 'EXIF:UserComment'));
  assert.equal(jpeg.find((field) => field.id === 'make').native, 'EXIF:Make');
  assert.equal(fieldsFor('tiff').some((field) => field.id === 'comment'), true);
  assert.equal(fieldsFor('png').some((field) => field.id === 'comment'), false);
  assert.equal(fieldsFor('webp').some((field) => field.id === 'comment'), false);
});
test('buildTagMap writes GPS as degree/minute/second plus references', () => {
  const tags = buildTagMap({
    set: { gpsLatitude: '-6.2088', gpsLongitude: '106.8456', gpsAltitude: '12.5', gpsDate: '2026-02-03' },
    remove: [],
  }, 'jpeg');
  assert.equal(tags['GPS:GPSLatitude'], '6 deg 12\' 31.68"');
  assert.equal(tags['GPS:GPSLatitudeRef'], 'S');
  assert.equal(tags['GPS:GPSLongitude'], '106 deg 50\' 44.16"');
  assert.equal(tags['GPS:GPSLongitudeRef'], 'E');
  assert.equal(tags['GPS:GPSAltitude'], '12.5');
  assert.equal(tags['GPS:GPSDateStamp'], '2026:02:03');
  const clean = buildTagMap({
    set: { gpsLatitude: '6.3', gpsLongitude: '-106.9' },
    remove: [],
  }, 'heic');
  assert.match(clean['XMP-exif:GPSLatitude'], /N$/);
  assert.match(clean['XMP-exif:GPSLongitude'], /W$/);
  assert.equal(Object.keys(clean).some((key) => key.startsWith('GPS:')), false);
});
test('buildTagMap writes IPTC/XMP fields and RAW writes stay XMP-only', () => {
  const tags = buildTagMap({
    set: {
      credit: 'Kredit baru', source: 'Sumber baru', captionWriter: 'Penulis baru',
      jobTitle: 'Jabatan baru', copyrightOwner: 'Pemilik baru', rating: '5',
      label: 'Baru', identifier: 'id-baru', location: 'Bandung',
    },
    remove: [],
  }, 'cr3');
  assert.equal(tags['XMP-photoshop:Credit'], 'Kredit baru');
  assert.equal(tags['XMP-iptcCore:Source'], 'Sumber baru');
  assert.equal(tags['XMP-photoshop:CaptionWriter'], 'Penulis baru');
  assert.equal(tags['XMP-iptcCore:AuthorsPosition'], 'Jabatan baru');
  assert.equal(tags['XMP-iptcExt:CopyrightOwner'], 'Pemilik baru');
  assert.equal(tags['Xmp.xmp.Rating'], '5');
  assert.equal(tags['Xmp.xmp.Label'], 'Baru');
  assert.equal(tags['XMP-dc:Identifier'], 'id-baru');
  assert.equal(tags['XMP-iptcCore:Location'], 'Bandung');
  assert.equal(Object.keys(tags).some((key) => key.startsWith('EXIF:')), false);
});
test('mapTags reads GPS decimal degrees with and without reference tags', () => {
  const fields = mapTags({
    'GPS:GPSLatitude': "6 deg 12' 34.00\"",
    'GPS:GPSLatitudeRef': 'South',
    'GPS:GPSLongitude': "106 deg 45' 0.00\"",
    'GPS:GPSLongitudeRef': 'East',
    'GPS:GPSAltitude': '12 m',
    'GPS:GPSDateStamp': '2026:01:02',
  }, 'jpeg');
  assert.equal(fields.gpsLatitude, '-6.209444');
  assert.equal(fields.gpsLongitude, '106.75');
  assert.equal(fields.gpsAltitude, '12');
  assert.equal(fields.gpsDate, '2026-01-02');
  const clean = mapTags({
    'GPS:GPSLatitude': '6.2088',
    'GPS:GPSLongitude': '-106.8456',
  }, 'jpeg');
  assert.equal(clean.gpsLatitude, '6.2088');
  assert.equal(clean.gpsLongitude, '-106.8456');
});
test('format map keeps creator/date and exposes the new image field targets', () => {
  assert.equal(crossTarget('image', 'artist'), 'creator');
  assert.equal(crossTarget('image', 'date'), 'date');
  assert.equal(crossTarget('image', 'gpsDate'), 'gpsDate');
  assert.equal(crossTarget('image', 'captionWriter'), 'captionWriter');
  assert.equal(crossTarget('image', 'copyrightOwner'), 'copyrightOwner');
});
test('read → collectChanges → buildChangePlan → write → re-read keeps integrity ok for new fields', async () => {
  const before = await read(fixtureFile(), options);
  for (const id of newIds) assert.ok(String(before.fields[id]).length > 0, `${id} missing from fixture`);
  const edits = {
    gpsLatitude: '-6.3',
    gpsLongitude: '106.9',
    gpsAltitude: '15',
    gpsDate: '2026-02-03',
    credit: 'Kredit baru',
    source: 'Sumber baru',
    captionWriter: 'Penulis baru',
    jobTitle: 'Jabatan baru',
    copyrightOwner: 'Pemilik baru',
    rating: '5',
    label: 'Baru',
    identifier: 'id-baru',
    location: 'Bandung',
  };
  const { payload, plan } = planFor(before, stateFrom(before, edits));
  for (const id of newIds) assert.ok(Object.hasOwn(payload.set, id), `${id} not collected`);
  assert.deepEqual(payload.remove, []);
  const { written, after, result } = await roundTrip(plan);
  assert.deepEqual(written.warnings, []);
  for (const [id, value] of Object.entries(edits)) {
    assert.equal(after.fields[id], value, `${id} did not round-trip`);
  }
  assert.equal(result.status, 'ok', JSON.stringify(result.findings));
  assert.equal(result.findings.length, 0);
});
test('GPS edit merged with a clean-location payload removes GPS once without conflict', async () => {
  const before = await read(fixtureFile(), options);
  const baseline = createSnapshot({ adapter: image, detection, readResult: before });
  const cleaning = buildCleanPayload(baseline, ['location']);
  assert.ok(cleaning.remove.includes('gpsLatitude'));
  assert.ok(cleaning.rawRemove.some((tag) => /^GPS:/.test(tag)));
  const state = stateFrom(before, { gpsLatitude: '-7.1' });
  for (const id of cleaning.remove) {
    state.removedFields.add(id);
    delete state.values[id];
  }
  for (const tag of cleaning.rawRemove) state.rawRemove.add(tag);
  const { payload, plan } = planFor(before, state, 'clean.jpg');
  assert.equal(Object.hasOwn(payload.set, 'gpsLatitude'), false);
  assert.ok(payload.remove.includes('gpsLatitude'));
  const targets = plan.operations.map((op) => `${op.kind}:${op.id || op.tag || op.key}`);
  assert.equal(new Set(targets).size, targets.length);
  const { after, result } = await roundTrip(plan, 'clean.jpg');
  for (const id of cleaning.remove) assert.equal(after.fields[id], '', `${id} still present`);
  assert.equal(result.status, 'ok', JSON.stringify(result.findings));
});
