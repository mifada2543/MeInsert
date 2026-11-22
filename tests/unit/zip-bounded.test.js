/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — MeInsert Source-Available License v1.0 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { strToU8, zipSync } from '../../assets/vendor/fflate.mjs';
import { detectFile } from '../../assets/js/core/detector.js';
import { inspectZip, OFFICE_PREVIEW_LIMITS, OFFICE_READ_ENTRIES } from '../../assets/js/core/office-zip.js';
import { readZipDirectory, readZipDirectoryFromBlob } from '../../assets/js/core/zip-directory.js';
const SIG_LOCAL = 0x04034b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_EOCD = 0x06054b50;
const SIG_EOCD64 = 0x06064b50;
const SIG_LOCATOR64 = 0x07064b50;
function readU16(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}
function readU32(bytes, offset) {
  return ((bytes[offset]
    | (bytes[offset + 1] << 8)
    | (bytes[offset + 2] << 16)
    | (bytes[offset + 3] << 24)) >>> 0);
}
function writeU16(bytes, offset, value) {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >>> 8) & 0xff;
}
function writeU32(bytes, offset, value) {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >>> 8) & 0xff;
  bytes[offset + 2] = (value >>> 16) & 0xff;
  bytes[offset + 3] = (value >>> 24) & 0xff;
}
function findSignature(bytes, signature) {
  const out = [];
  for (let i = 0; i + 4 <= bytes.length; i += 1) {
    if (readU32(bytes, i) === signature) out.push(i);
  }
  return out;
}
function instrumentedFile(bytes, name) {
  const stats = { sliceBytes: 0, arrayBufferBytes: 0, fullArrayBufferCalls: 0, slices: [] };
  const file = {
    name,
    size: bytes.length,
    slice(start = 0, end = bytes.length) {
      const from = Math.max(0, Math.min(bytes.length, start));
      const to = Math.max(from, Math.min(bytes.length, end));
      const length = to - from;
      stats.sliceBytes += length;
      stats.slices.push([from, to]);
      return {
        async arrayBuffer() {
          stats.arrayBufferBytes += length;
          return bytes.buffer.slice(bytes.byteOffset + from, bytes.byteOffset + to);
        },
      };
    },
    async arrayBuffer() {
      stats.fullArrayBufferCalls += 1;
      stats.arrayBufferBytes += bytes.length;
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length);
    },
  };
  return { file, stats };
}
const CONTENT_TYPES = strToU8('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
const DOCUMENT = strToU8('<w:document><w:body><w:p><w:r><w:t>Halo dunia</w:t></w:r></w:p></w:body></w:document>');
function officeZip(extra = {}) {
  return zipSync({ '[Content_Types].xml': CONTENT_TYPES, 'word/document.xml': DOCUMENT, ...extra });
}
function makeZip64(bytes, eocdCount = null) {
  const eocd = findSignature(bytes, SIG_EOCD)[0];
  const count = readU16(bytes, eocd + 10);
  const cdSize = readU32(bytes, eocd + 12);
  const cdOffset = readU32(bytes, eocd + 16);
  const zip64End = new Uint8Array(56);
  writeU32(zip64End, 0, SIG_EOCD64);
  writeU32(zip64End, 4, 44);
  writeU16(zip64End, 12, 45);
  writeU16(zip64End, 14, 45);
  writeU32(zip64End, 24, count);
  writeU32(zip64End, 32, count);
  writeU32(zip64End, 40, cdSize);
  writeU32(zip64End, 48, cdOffset);
  const locator = new Uint8Array(20);
  writeU32(locator, 0, SIG_LOCATOR64);
  writeU32(locator, 8, eocd);
  writeU32(locator, 16, 1);
  const out = new Uint8Array(eocd + 56 + 20 + 22);
  out.set(bytes.subarray(0, eocd), 0);
  out.set(zip64End, eocd);
  out.set(locator, eocd + 56);
  out.set(bytes.subarray(eocd), eocd + 56 + 20);
  const newEocd = eocd + 76;
  writeU16(out, newEocd + 10, eocdCount === null ? 0xffff : eocdCount);
  writeU32(out, newEocd + 12, 0xffffffff);
  writeU32(out, newEocd + 16, 0xffffffff);
  return out;
}
test('OFFICE_READ_ENTRIES is the exact bounded inspect allow-list', () => {
  assert.deepEqual([...OFFICE_READ_ENTRIES].sort(), [
    '[Content_Types].xml',
    '_rels/.rels',
    'META-INF/manifest.xml',
    'content.xml',
    'docProps/app.xml',
    'docProps/core.xml',
    'docProps/custom.xml',
    'meta.xml',
    'mimetype',
    'ppt/presentation.xml',
    'ppt/slides/slide1.xml',
    'word/document.xml',
    'xl/_rels/workbook.xml.rels',
    'xl/sharedStrings.xml',
    'xl/workbook.xml',
  ].sort());
  assert.equal(OFFICE_PREVIEW_LIMITS.maxPreviewEntry, 2 * 1024 * 1024);
});
test('detection reads under 1 MiB from a >2 MiB Office package', async () => {
  const media = randomBytes(2 * 1024 * 1024 + 4096);
  const bytes = officeZip({ 'word/media/image1.png': [media, { level: 0 }] });
  assert.ok(bytes.length > 2 * 1024 * 1024);
  const { file, stats } = instrumentedFile(bytes, 'large.docx');
  const detection = await detectFile(file);
  assert.equal(detection.id, 'office');
  assert.equal(detection.subtype, 'docx');
  assert.equal(stats.fullArrayBufferCalls, 0);
  console.log(`detection bytes: slice=${stats.sliceBytes} arrayBuffer=${stats.arrayBufferBytes} (file=${bytes.length})`);
  assert.ok(stats.arrayBufferBytes < 1024 * 1024, `reading ${stats.arrayBufferBytes} bytes exceeds the 1 MiB budget`);
});
test('media entries are never inflated and keep empty data', async () => {
  const media = randomBytes(2 * 1024 * 1024 + 4096);
  const inspected = await inspectZip(officeZip({ 'word/media/image1.png': [media, { level: 0 }] }));
  const entry = inspected.entries.find((item) => item.name === 'word/media/image1.png');
  assert.ok(entry);
  assert.equal(entry.data.length, 0);
  assert.equal(inspected.valid, true);
  assert.equal(inspected.packageValid, true);
  assert.deepEqual(inspected.findings, []);
});
test('an oversized preview-only part is skipped with a finding, not an error', async () => {
  const big = randomBytes(OFFICE_PREVIEW_LIMITS.maxPreviewEntry + 1024);
  const inspected = await inspectZip(zipSync({ 'xl/sharedStrings.xml': [big, { level: 0 }] }));
  const entry = inspected.entries.find((item) => item.name === 'xl/sharedStrings.xml');
  assert.equal(entry.data.length, 0);
  assert.ok(inspected.findings.some((finding) => /pratinjau/i.test(finding)));
  assert.equal(inspected.valid, true);
});
test('a declared size above the per-entry limit is rejected before inflation', async () => {
  const bytes = officeZip();
  const central = findSignature(bytes, SIG_CENTRAL)[0];
  writeU32(bytes, central + 24, 64 * 1024 * 1024 + 1);
  await assert.rejects(async () => readZipDirectory(bytes), { code: 'ZIP_BOMB_SUSPECTED' });
  await assert.rejects(() => inspectZip(bytes), { code: 'ZIP_BOMB_SUSPECTED' });
});
test('actual decompression beyond the declared size is treated as a ZIP bomb', async () => {
  const bytes = zipSync({ 'word/document.xml': strToU8('A'.repeat(20000)) });
  const central = findSignature(bytes, SIG_CENTRAL)[0];
  assert.ok(readU32(bytes, central + 24) > 100);
  writeU32(bytes, central + 24, 64);
  await assert.rejects(() => inspectZip(bytes), { code: 'ZIP_BOMB_SUSPECTED' });
});
test('a suspicious deflate ratio is rejected', async () => {
  const bytes = zipSync({ 'word/document.xml': strToU8('a'.repeat(1_000_000)) });
  await assert.rejects(() => inspectZip(bytes), { code: 'ZIP_BOMB_SUSPECTED' });
});
test('duplicate names after ./, backslash or percent normalization are rejected', async () => {
  const pairs = [
    ['a/b.txt', './a/b.txt'],
    ['a/b.txt', 'a\\b.txt'],
    ['a b.txt', 'a%20b.txt'],
  ];
  for (const [first, second] of pairs) {
    const bytes = zipSync({ [first]: strToU8('x'), [second]: strToU8('y') });
    await assert.rejects(async () => readZipDirectory(bytes), {
      code: 'CORRUPT_OFFICE', message: /duplikat/i,
    });
  }
});
test('path traversal and absolute entry names are rejected', async () => {
  for (const name of ['../evil.txt', '/etc/passwd', 'C:\\evil.txt', 'a/%2e%2e/evil.txt', 'word/../../evil.txt']) {
    const bytes = zipSync({ [name]: strToU8('x') });
    await assert.rejects(async () => readZipDirectory(bytes), { code: 'CORRUPT_OFFICE' });
  }
});
test('overlapping local records are rejected', async () => {
  const bytes = officeZip();
  const centrals = findSignature(bytes, SIG_CENTRAL);
  assert.equal(centrals.length, 2);
  writeU32(bytes, centrals[1] + 42, readU32(bytes, centrals[0] + 42));
  await assert.rejects(async () => readZipDirectory(bytes), {
    code: 'CORRUPT_OFFICE', message: /tumpang tindih/i,
  });
});
test('a truncated deflate stream is reported as CORRUPT_OFFICE', async () => {
  const bytes = zipSync({ 'word/document.xml': strToU8('ABCDEFGH') });
  const central = findSignature(bytes, SIG_CENTRAL)[0];
  writeU32(bytes, central + 24, 40);
  await assert.rejects(() => inspectZip(bytes), { code: 'CORRUPT_OFFICE' });
});
test('a corrupt CRC is reported as CORRUPT_OFFICE', async () => {
  const bytes = zipSync({ 'word/document.xml': [strToU8('<w:document>ABCDEFGH</w:document>'), { level: 0 }] });
  const local = findSignature(bytes, SIG_LOCAL)[0];
  const dataStart = local + 30 + readU16(bytes, local + 26) + readU16(bytes, local + 28);
  bytes[dataStart + 5] ^= 0xff;
  await assert.rejects(() => inspectZip(bytes), { code: 'CORRUPT_OFFICE' });
});
test('ZIP64 is rejected by detection and checked for EOCD consistency', async () => {
  const bytes = officeZip();
  const { file } = instrumentedFile(makeZip64(bytes), 'zip64.docx');
  assert.equal(await detectFile(file), null);
  assert.equal(readZipDirectory(makeZip64(bytes)).zip64, true);
  await assert.rejects(async () => readZipDirectory(makeZip64(bytes, 1)), {
    code: 'CORRUPT_OFFICE', message: /konsisten/i,
  });
});
test('bounded Blob reader returns entry metadata and the ODF mimetype record', async () => {
  const bytes = zipSync({
    mimetype: [strToU8('application/vnd.oasis.opendocument.text'), { level: 0 }],
    'meta.xml': strToU8('<office:document-meta/>'),
  });
  const { file, stats } = instrumentedFile(bytes, 'meta.odt');
  const dir = await readZipDirectoryFromBlob(file);
  assert.deepEqual(dir.entries.map((entry) => entry.name), ['mimetype', 'meta.xml']);
  assert.equal(new TextDecoder().decode(dir.entries[0].data), 'application/vnd.oasis.opendocument.text');
  assert.equal(typeof dir.entries[0].localOffset, 'number');
  assert.equal(typeof dir.entries[1].compressedSize, 'number');
  assert.equal(stats.fullArrayBufferCalls, 0);
  const detection = await detectFile(instrumentedFile(bytes, 'meta.odt').file);
  assert.equal(detection.subtype, 'odt');
});