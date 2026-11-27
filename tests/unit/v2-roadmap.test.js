/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — MeInsert Source-Available License v1.0 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { strToU8, zipSync } from '../../assets/vendor/fflate.mjs';
import { detectFile } from '../../assets/js/core/detector.js';
import { readZipDirectory } from '../../assets/js/core/zip-directory.js';
import { presetPatch, validatePreset } from '../../assets/js/core/metadata-presets.js';
import { rawSnapshotDiff } from '../../assets/js/core/snapshot-diff.js';
import { nextTrackPatch, replaceBatchText } from '../../assets/js/batch/batch-transform.js';
import { BatchProcessor } from '../../assets/js/batch/batch-processor.js';
import { statusLabel, zipEligible } from '../../assets/js/batch/batch-item.js';
import { makeReport } from '../../assets/js/batch/batch-report.js';
import { buildChangePlan } from '../../assets/js/core/change-plan.js';
import { createSnapshot } from '../../assets/js/core/metadata-snapshot.js';
import { fuzzCoordinates, gpsFuzzPatch } from '../../assets/js/core/gps-fuzz.js';
import epub from '../../assets/js/formats/epub.js';
import svg from '../../assets/js/formats/svg.js';

test('preset projection filters capabilities and maps creator to a PDF author', () => {
  const preset = validatePreset(JSON.parse('{"version":1,"name":"Credit","fields":[{"id":"creator","value":"Mifada"},{"id":"album","value":"Album"}],"__proto__":{"bad":true}}'));
  assert.deepEqual(Object.keys(preset), ['version', 'name', 'fields']);
  assert.deepEqual(presetPatch(preset, { fields: [{ id: 'author' }] }, { id: 'pdf' }), { author: 'Mifada' });
  assert.throws(() => validatePreset({ version: 1, name: 'x', fields: [{ id: '__proto__', value: 'y' }] }));
});

test('batch literal replacement treats dots and replacement tokens as ordinary text', async () => {
  assert.deepEqual(await replaceBatchText(['A.B a*b', 'a.b'], { query: 'a.b', replacement: '$&' }), ['$& a*b', '$&']);
  assert.deepEqual(nextTrackPatch([{ id: 'track' }], 3, 2, 12), { track: '03/12' });
  assert.deepEqual(nextTrackPatch([{ id: 'trackNumber' }, { id: 'trackTotal' }], 3, 2, 12),
    { trackNumber: '3', trackTotal: '12' });
});

test('raw diff preserves equal duplicates and reports one modified instance', () => {
  const row = (value) => ({ group: 'ID3', tag: 'COMM', value });
  const diff = rawSnapshotDiff([row('one'), row('one'), row('two')], [row('one'), row('one'), row('three')]);
  assert.equal(diff.filter(({ status }) => status === 'unchanged').length, 2);
  assert.deepEqual(diff.find(({ status }) => status === 'modified'),
    { group: 'ID3', tag: 'COMM', status: 'modified', before: 'two', after: 'three' });
});

test('GPS displacement stays bounded at the pole and isolates extra GPS representations', () => {
  for (const [lat, lon] of [[89.99, 179.99], [-90, -180], [0, 0]]) {
    const result = fuzzCoordinates(lat, lon, 1000);
    const latitude2 = Number(result.gpsLatitude);
    const longitude2 = Number(result.gpsLongitude);
    const rad = (value) => value * Math.PI / 180;
    const term = Math.sin(rad(latitude2 - lat) / 2) ** 2
      + Math.cos(rad(lat)) * Math.cos(rad(latitude2)) * Math.sin(rad(longitude2 - lon) / 2) ** 2;
    assert.ok(2 * 6371008.8 * Math.asin(Math.sqrt(term)) <= 1000.01);
    assert.ok(longitude2 >= -180 && longitude2 <= 180);
  }
  const patch = gpsFuzzPatch({ fields: { gpsLatitude: 1, gpsLongitude: 2 }, raw: [
    { tag: 'GPS:GPSLatitude' }, { tag: 'XMP-exif:GPSLatitude' }, { tag: 'GPS:GPSDestLongitude' },
  ] }, 1000);
  assert.deepEqual(patch.rawRemove, ['XMP-exif:GPSLatitude', 'GPS:GPSDestLongitude']);
});

test('batch low-memory output is never called for a result that fails integrity', async () => {
  const file = new File(['test'], 'test.pdf');
  const adapter = { meta: { id: 'pdf' }, fields: [{ id: 'title', type: 'text' }] };
  const detection = { id: 'pdf', subtype: 'pdf' };
  const readResult = { fields: { title: 'Before' }, raw: [] };
  const item = { file, adapter, detection, readResult, included: true };
  const plan = buildChangePlan({ adapter, detection, baseline: createSnapshot({ adapter, detection, readResult }),
    payload: { set: { title: 'After' } } });
  const processor = new BatchProcessor({ disposeAll: async () => {} });
  processor.writeItem = async () => ({ blob: file, fields: { title: 'Unrelated' }, raw: [] });
  let downloads = 0;
  await processor.applyPlans([{ ...plan, item }], [], null, { lowMemory: true, onOutput: () => { downloads += 1; } });
  assert.equal(item.integrity.status, 'failed');
  assert.equal(downloads, 0);
  assert.equal(item.downloadedPerFile, false);
});

test('SVG edits only metadata, never builds HTML, and rejects fake SVG content', async () => {
  assert.equal(await detectFile(new File(['<html></html>'], 'fake.svg')), null);
  const activeMarkup = '<path d="M0 0"/><script>example()</script><image href="https://example.invalid/a.png"/>';
  const file = new File([`<svg xmlns="http://www.w3.org/2000/svg">${activeMarkup}</svg>`], 'vector.svg');
  assert.equal((await detectFile(file)).id, 'svg');
  const result = await svg.write(file, { set: { title: '<sample>', creator: 'Mifada', rights: 'Rights' } });
  assert.equal(result.fields.title, '<sample>');
  assert.equal(result.fields.creator, 'Mifada');
  assert.ok((await result.blob.text()).includes(activeMarkup));
});

test('EPUB patches the OPF and retains every other local ZIP record byte for byte', async () => {
  const files = {
    mimetype: 'application/epub+zip',
    'META-INF/container.xml': '<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OPS/book.opf"/></rootfiles></container>',
    'OPS/book.opf': '<package xmlns="http://www.idpf.org/2007/opf" xmlns:dc="http://purl.org/dc/elements/1.1/"><metadata><dc:title>Old</dc:title><dc:language>id</dc:language></metadata><spine/></package>',
    'OPS/chapter.xhtml': '<html><body>Chapter</body></html>',
  };
  const zip = (level) => zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strToU8(v)])), { level });
  const input = zip(0);
  const file = new File([input], 'book.epub');
  assert.equal((await detectFile(file)).id, 'epub');
  await assert.rejects(epub.read(new File([zip(6)], 'wrong.epub')), /mimetype/);
  const result = await epub.write(file, { set: { title: 'New', creator: 'Mifada' } });
  assert.equal(result.fields.title, 'New');
  assert.equal(result.fields.creator, 'Mifada');
  const original = readZipDirectory(input).entries;
  const updated = readZipDirectory(new Uint8Array(await result.blob.arrayBuffer())).entries;
  for (const entry of original.filter(({ name }) => name !== 'OPS/book.opf')) {
    assert.deepEqual(updated.find(({ name }) => name === entry.name).localBytes, entry.localBytes);
  }
});

test('an unavailable read-back blocks automatic batch export and is flagged in the report', async () => {
  const file = new File(['test'], 'test.pdf');
  const adapter = { meta: { id: 'pdf' }, fields: [{ id: 'title', type: 'text' }] };
  const detection = { id: 'pdf', subtype: 'pdf' };
  const readResult = { fields: { title: 'Before' }, raw: [] };
  const plan = buildChangePlan({ adapter, detection, baseline: createSnapshot({ adapter, detection, readResult }),
    payload: { set: { title: 'After' } } });
  const processor = new BatchProcessor({ disposeAll: async () => {} });
  processor.writeItem = async () => ({
    blob: file, fields: { title: 'After' }, raw: [],
    get info() { throw new Error('Read-back unavailable'); },
  });
  const item = { file, adapter, detection, readResult, included: true, includeFailedInZip: true };
  let exports = 0;
  await processor.applyPlans([{ ...plan, item }], [], null, { lowMemory: true, onOutput: () => { exports += 1; } });
  assert.equal(exports, 0);
  assert.equal(item.downloadedPerFile, false);
  assert.equal(item.integrity.status, 'unverified');
  assert.equal(statusLabel(item), 'Perlu diperiksa');

  await processor.applyPlans([{ ...plan, item }], [], null);
  assert.ok(item.outputFile);
  assert.equal(zipEligible(item), false, 'a new write must clear any prior explicit override');
  const report = makeReport([item]);
  assert.equal(report.totals.flagged, 1);
  assert.equal(report.files[0].integrity.includedInZip, false);
  item.includeFailedInZip = true;
  assert.equal(zipEligible(item), true, 'normal ZIP retains the explicit review override');
});
