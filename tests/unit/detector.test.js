/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { detectFile } from '../../assets/js/core/detector.js';
import { strToU8, zipSync } from '../../assets/vendor/fflate.mjs';
import { t } from '../../assets/js/i18n/index.js';
function bytes(head, size = 128) {
  const out = new Uint8Array(size);
  out.set(head);
  return out;
}
function file(name, head) {
  return new File([bytes(head)], name);
}
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG = [0xff, 0xd8, 0xff, 0xe0];
const PDF = [...new TextEncoder().encode('%PDF-1.7')];
const OGG_OPUS = [...new TextEncoder().encode('OggS'), 0, 0,0,0,0,0,0,0,0,0,0,0,0, ...new TextEncoder().encode('OpusHead')];
const MP4_M4A = [0, 0, 0, 20, ...new TextEncoder().encode('ftypM4A ')];
const HEIC = [0, 0, 0, 24, ...new TextEncoder().encode('ftypheic')];
const TIFF = [0x49, 0x49, 0x2a, 0x00];
const CR3 = [0, 0, 0, 24, ...new TextEncoder().encode('ftypcrx ')];
const R3D = [...new TextEncoder().encode('R3D')];
const BRAW = [0, 0, 0, 24, ...new TextEncoder().encode('braw')];
test('warns when a .jpg file actually contains PNG data', async () => {
  const detection = await detectFile(file('photo.jpg', PNG));
  assert.equal(detection.subtype, 'png');
  assert.equal(detection.ext, 'png');
  assert.match(detection.warning, /Ekstensi \.jpg tidak cocok/);
  assert.match(detection.warning, /PNG/);
});
test('warns when a .png file actually contains PDF data', async () => {
  const detection = await detectFile(file('document.png', PDF));
  assert.equal(detection.id, 'pdf');
  assert.equal(detection.ext, 'pdf');
  assert.match(detection.warning, /terdeteksi PDF/);
});
test('does not warn when extension and magic bytes agree', async () => {
  const detection = await detectFile(file('photo.png', PNG));
  assert.equal(detection.subtype, 'png');
  assert.equal(detection.warning, undefined);
});
test('mendeteksi JPEG asli dari magic bytes tanpa peringatan', async () => {
  const detection = await detectFile(file('photo.jpg', JPEG));
  assert.equal(detection.id, 'image');
  assert.equal(detection.subtype, 'jpeg');
  assert.equal(detection.mime, 'image/jpeg');
  assert.equal(detection.warning, undefined);
});
test('does not warn for generic Ogg or MP4 container extensions', async () => {
  const ogg = await detectFile(file('audio.ogg', OGG_OPUS));
  assert.equal(ogg.subtype, 'opus');
  assert.equal(ogg.warning, undefined);

  const mp4 = await detectFile(file('audio.mp4', MP4_M4A));
  assert.equal(mp4.subtype, 'm4a');
  assert.equal(mp4.warning, undefined);
});
test('warns when an explicit .opus extension contains Vorbis data', async () => {
  const vorbis = [...new TextEncoder().encode('OggS'), 0,0,0,0,0,0,0,0,0,0,0,0,0, 1, ...new TextEncoder().encode('vorbis')];
  const detection = await detectFile(file('audio.opus', vorbis));
  assert.equal(detection.subtype, 'vorbis');
  assert.match(detection.warning, /Ekstensi \.opus tidak cocok/);
});
test('warns when content is recognized only from the extension', async () => {
  const detection = await detectFile(file('unknown.png', [1, 2, 3, 4, 5]));
  assert.equal(detection.subtype, 'png');
  assert.match(detection.warning, /isi file tidak dikenali/);
});
test('detects an Office package whose local headers are after a prefix', async () => {
  const entries = {
    'padding.bin': [new Uint8Array(12000), { level: 0 }],
    '[Content_Types].xml': strToU8('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'),
    'word/document.xml': strToU8('<w:document><w:body/></w:document>'),
  };
  const detection = await detectFile(new File([zipSync(entries)], 'wrong.xlsx'));
  assert.equal(detection.id, 'office');
  assert.equal(detection.subtype, 'docx');
  assert.equal(detection.ext, 'docx');
  assert.match(detection.warning, /Ekstensi \.xlsx tidak cocok/);
});
test('does not classify an ordinary ZIP as Office from its extension alone', async () => {
  const bytes = zipSync({ 'test.txt': strToU8('not a document') });
  const detection = await detectFile(new File([bytes], 'generic.docx'));
  assert.equal(detection.id, 'office');
  assert.match(detection.warning, /isi file tidak dikenali/);
});
test('mendeteksi HEIC dari brand ftyp heic', async () => {
  const detection = await detectFile(file('image.heic', HEIC));
  assert.equal(detection.id, 'image');
  assert.equal(detection.subtype, 'heic');
  assert.equal(detection.ext, 'heic');
  assert.equal(detection.warning, undefined);
});
test('mendeteksi DNG dari ekstensi dengan magic TIFF', async () => {
  const detection = await detectFile(file('raw.dng', TIFF));
  assert.equal(detection.id, 'image');
  assert.equal(detection.subtype, 'dng');
  assert.equal(detection.ext, 'dng');
  assert.equal(detection.warning, t('ui.rawUncertain', { v0: 'dng' }));
});
test('mendeteksi CR3 dari brand ftyp crx', async () => {
  const detection = await detectFile(file('raw.cr3', CR3));
  assert.equal(detection.id, 'image');
  assert.equal(detection.subtype, 'cr3');
  assert.equal(detection.ext, 'cr3');
  assert.equal(detection.warning, undefined);
});
test('mendeteksi R3D dari magic di awal file', async () => {
  const detection = await detectFile(file('clip.r3d', R3D));
  assert.equal(detection.id, 'rawVideo');
  assert.equal(detection.subtype, 'r3d');
  assert.equal(detection.ext, 'r3d');
});
test('mendeteksi BRAW dari fourcc braw', async () => {
  const detection = await detectFile(file('clip.braw', BRAW));
  assert.equal(detection.id, 'rawVideo');
  assert.equal(detection.subtype, 'braw');
  assert.equal(detection.ext, 'braw');
});
test('TIFF renamed to NEF remains tentative rather than silently verified', async () => {
  const detection = await detectFile(file('fake.nef', TIFF));
  assert.equal(detection.subtype, 'nef');
  assert.equal(detection.warning, t('ui.rawUncertain', { v0: 'nef' }));
});
test('DNGVersion TIFF tag identifies DNG independently of file extension', async () => {
  const data = bytes(TIFF);
  const view = new DataView(data.buffer);
  view.setUint32(4, 8, true); // IFD offset
  view.setUint16(8, 1, true); // one IFD entry
  view.setUint16(10, 0xc612, true); // DNGVersion tag
  view.setUint16(12, 1, true); // BYTE
  view.setUint32(14, 4, true);
  data.set([1, 4, 0, 0], 18);
  const detected = await detectFile(new File([data], 'capture.dng'));
  assert.equal(detected.subtype, 'dng');
  assert.equal(detected.warning, undefined);
  const mislabeled = await detectFile(new File([data], 'capture.nef'));
  assert.equal(mislabeled.subtype, 'dng');
  assert.match(mislabeled.warning, /tidak cocok/);
});
test('CR2 signature is stronger than a TIFF container extension', async () => {
  const data = bytes(TIFF);
  data.set([0x43, 0x52, 0x02, 0x00], 8);
  const detected = await detectFile(new File([data], 'capture.cr2'));
  assert.equal(detected.subtype, 'cr2');
  assert.equal(detected.warning, undefined);
});
