/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { strToU8, zipSync } from '../../assets/vendor/fflate.mjs';
import {
  hashZipEntries,
  inspectZip,
  OFFICE_METADATA_PARTS,
  patchZip,
  verifyZipPreserved,
} from '../../assets/js/core/office-zip.js';

const SIG_LOCAL = 0x04034b50;
const SIG_CENTRAL = 0x02014b50;

function readU32(bytes, offset) {
  return ((bytes[offset]
    | (bytes[offset + 1] << 8)
    | (bytes[offset + 2] << 16)
    | (bytes[offset + 3] << 24)) >>> 0);
}

function makeZip(entries) {
  return zipSync(entries);
}

function textOf(inspected, name) {
  const entry = inspected.entries.find((item) => item.name === name);
  return entry ? new TextDecoder().decode(entry.data) : '';
}

function markEncrypted(zipBytes) {
  const out = zipBytes.slice();
  for (let i = 0; i + 4 <= out.length; i += 1) {
    const sig = readU32(out, i);
    if (sig === SIG_LOCAL) out[i + 6] |= 1;
    if (sig === SIG_CENTRAL) out[i + 8] |= 1;
  }
  return out;
}

const BASE = {
  'docProps/core.xml': strToU8('<cp:coreProperties><dc:title>Lama</dc:title></cp:coreProperties>'),
  'word/document.xml': strToU8('<w:document><w:body/></w:document>'),
  'word/styles.xml': strToU8('<w:styles/>'),
};

test('OFFICE_METADATA_PARTS exposes the three target parts', () => {
  assert.deepEqual(OFFICE_METADATA_PARTS, ['docProps/core.xml', 'docProps/app.xml', 'meta.xml']);
});

test('inspectZip reports entries, structure validity, and decoded data', async () => {
  const inspected = await inspectZip(makeZip(BASE));
  assert.equal(inspected.valid, true);
  assert.equal(inspected.entries.length, 3);
  const core = inspected.entries.find((entry) => entry.name === 'docProps/core.xml');
  assert.equal(core.method, 8);
  assert.equal(core.flags & 1, 0);
  assert.ok(core.crc32 > 0);
  assert.match(new TextDecoder().decode(core.data), /<dc:title>Lama<\/dc:title>/);
  assert.equal(inspected.signed, false);
  assert.equal(inspected.macros, false);
  assert.equal(inspected.odf, false);
  assert.equal(inspected.mimetype, '');
});

test('inspectZip detects OOXML digital signatures and macro packages', async () => {
  const signed = await inspectZip(makeZip({
    ...BASE,
    'word/_xmlsignatures/sig1.xml': strToU8('<Signature/>'),
  }));
  assert.equal(signed.signed, true);

  const byFile = await inspectZip(makeZip({ ...BASE, 'word/vbaProject.bin': strToU8('VBA') }));
  assert.equal(byFile.macros, true);

  const byContentTypes = await inspectZip(makeZip({
    ...BASE,
    '[Content_Types].xml': strToU8('<Types><Override ContentType="application/vnd.ms-word.document.macroEnabled.main+xml"/></Types>'),
  }));
  assert.equal(byContentTypes.macros, true);
});

test('inspectZip detects ODF via the mimetype entry', async () => {
  const inspected = await inspectZip(makeZip({
    mimetype: [strToU8('application/vnd.oasis.opendocument.spreadsheet'), { level: 0 }],
    'meta.xml': strToU8('<office:document-meta/>'),
  }));
  assert.equal(inspected.odf, true);
  assert.equal(inspected.mimetype, 'application/vnd.oasis.opendocument.spreadsheet');
  assert.equal(inspected.entries[0].name, 'mimetype');
  assert.equal(inspected.entries[0].method, 0);
});

test('patchZip preserves every untouched entry byte-for-byte', async () => {
  const before = makeZip(BASE);
  const after = new Uint8Array(await (await patchZip(before, new Map([
    ['docProps/core.xml', strToU8('<cp:coreProperties><dc:title>Baru</dc:title></cp:coreProperties>')],
  ]))).arrayBuffer());

  const preserved = await verifyZipPreserved(before, after, ['docProps/core.xml']);
  assert.deepEqual(preserved, { ok: true, changed: [] });

  const inspected = await inspectZip(after);
  assert.equal(inspected.valid, true);
  assert.equal(textOf(inspected, 'docProps/core.xml'), '<cp:coreProperties><dc:title>Baru</dc:title></cp:coreProperties>');
  assert.equal(textOf(inspected, 'word/document.xml'), '<w:document><w:body/></w:document>');
  assert.equal(textOf(inspected, 'word/styles.xml'), '<w:styles/>');
});

test('patchZip re-emits changed entries with the original compression method', async () => {
  const before = makeZip(BASE);
  const after = new Uint8Array(await (await patchZip(before, new Map([
    ['word/styles.xml', strToU8('<w:styles><w:style/></w:styles>')],
  ]))).arrayBuffer());
  const inspected = await inspectZip(after);
  assert.equal(inspected.entries.find((entry) => entry.name === 'word/styles.xml').method, 8);
  assert.equal(inspected.entries.find((entry) => entry.name === 'docProps/core.xml').method, 8);
});

test('patchZip keeps ODF mimetype first and STORED', async () => {
  const before = makeZip({
    mimetype: [strToU8('application/vnd.oasis.opendocument.text'), { level: 0 }],
    'meta.xml': strToU8('<office:document-meta/>'),
    'content.xml': strToU8('<office:document-content/>'),
  });
  const after = new Uint8Array(await (await patchZip(before, new Map([
    ['meta.xml', strToU8('<office:document-meta><dc:title>Baru</dc:title></office:document-meta>')],
  ]))).arrayBuffer());
  const inspected = await inspectZip(after);
  assert.equal(inspected.entries[0].name, 'mimetype');
  assert.equal(inspected.entries[0].method, 0);
  assert.equal(inspected.mimetype, 'application/vnd.oasis.opendocument.text');
  assert.equal(inspected.valid, true);
  assert.deepEqual(await verifyZipPreserved(before, after, ['meta.xml']), { ok: true, changed: [] });
});

test('patchZip rejects an ODF package whose mimetype is not STORED and first', async () => {
  const badOdf = makeZip({
    'meta.xml': strToU8('<office:document-meta/>'),
    mimetype: strToU8('application/vnd.oasis.opendocument.text'),
  });
  await assert.rejects(
    () => patchZip(badOdf, new Map([['meta.xml', strToU8('<office:document-meta/>')]])),
    (error) => error.code === 'ODF_MIMETYPE_LAYOUT',
  );
});

test('encrypted ZIPs are rejected by inspectZip and patchZip with ENCRYPTED_OFFICE', async () => {
  const encrypted = markEncrypted(makeZip(BASE));
  await assert.rejects(() => inspectZip(encrypted), (error) => error.code === 'ENCRYPTED_OFFICE');
  await assert.rejects(
    () => patchZip(encrypted, new Map([['docProps/core.xml', strToU8('x')]])),
    (error) => error.code === 'ENCRYPTED_OFFICE',
  );
});

test('patchZip deletes entries mapped to null and appends new entries', async () => {
  const before = makeZip(BASE);
  const after = new Uint8Array(await (await patchZip(before, new Map([
    ['word/styles.xml', null],
    ['docProps/app.xml', strToU8('<Properties><Company>Baru</Company></Properties>')],
  ]))).arrayBuffer());
  const inspected = await inspectZip(after);
  assert.deepEqual(inspected.entries.map((entry) => entry.name), [
    'docProps/core.xml', 'word/document.xml', 'docProps/app.xml',
  ]);
  assert.equal(textOf(inspected, 'docProps/app.xml'), '<Properties><Company>Baru</Company></Properties>');
});

test('hashZipEntries returns a SHA-256 hex digest per entry name', async () => {
  const before = makeZip(BASE);
  const hashes = await hashZipEntries(before);
  assert.equal(hashes.size, 3);
  for (const value of hashes.values()) assert.match(value, /^[0-9a-f]{64}$/);

  const after = makeZip({
    ...BASE,
    'docProps/core.xml': strToU8('<cp:coreProperties><dc:title>Baru</dc:title></cp:coreProperties>'),
  });
  const changedHashes = await hashZipEntries(after);
  assert.notEqual(changedHashes.get('docProps/core.xml'), hashes.get('docProps/core.xml'));
  assert.equal(changedHashes.get('word/document.xml'), hashes.get('word/document.xml'));
});

test('verifyZipPreserved detects a change that is not allow-listed', async () => {
  const before = makeZip(BASE);
  const after = new Uint8Array(await (await patchZip(before, new Map([
    ['word/styles.xml', strToU8('<w:styles><w:style/></w:styles>')],
  ]))).arrayBuffer());
  const result = await verifyZipPreserved(before, after, ['docProps/core.xml']);
  assert.equal(result.ok, false);
  assert.deepEqual(result.changed, ['word/styles.xml']);
});

test('inspectZip throws on data without a ZIP central directory', async () => {
  await assert.rejects(() => inspectZip(new Uint8Array([1, 2, 3, 4])), (error) => Boolean(error.code));
});
