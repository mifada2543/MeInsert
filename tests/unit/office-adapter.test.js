/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { strToU8, zipSync } from '../../assets/vendor/fflate.mjs';
import office, { fieldsFor, OFFICE_SUBTYPES, read, sectionsFor, write } from '../../assets/js/formats/office.js';
import { verifyZipPreserved } from '../../assets/js/core/office-zip.js';

const CONTENT_TYPES = '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
  + '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
  + '</Types>';

const CORE_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
  + '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"'
  + ' xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/"'
  + ' xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
  + '<dc:title>Judul lama</dc:title>'
  + '<dc:creator>Penulis lama</dc:creator>'
  + '<dc:subject>Subjek lama</dc:subject>'
  + '<cp:keywords>satu, dua</cp:keywords>'
  + '<dc:description>Deskripsi lama</dc:description>'
  + '<cp:lastModifiedBy>Editor lama</cp:lastModifiedBy>'
  + '<dcterms:created xsi:type="dcterms:W3CDTF">2020-01-01T00:00:00Z</dcterms:created>'
  + '<dcterms:modified xsi:type="dcterms:W3CDTF">2020-02-01T00:00:00Z</dcterms:modified>'
  + '</cp:coreProperties>';

const APP_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
  + '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">'
  + '<Application>Word lama</Application><Company>PT Lama</Company><Manager>Manajer lama</Manager>'
  + '</Properties>';

const META_XML = '<?xml version="1.0" encoding="UTF-8"?>'
  + '<office:document-meta xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"'
  + ' xmlns:dc="http://purl.org/dc/elements/1.1/"'
  + ' xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0">'
  + '<office:meta>'
  + '<dc:title>Judul lama</dc:title>'
  + '<dc:creator>Penulis lama</dc:creator>'
  + '<dc:subject>Subjek lama</dc:subject>'
  + '<meta:keyword>satu</meta:keyword><meta:keyword>dua</meta:keyword>'
  + '<dc:description>Deskripsi lama</dc:description>'
  + '<meta:creation-date>2020-01-01T00:00:00Z</meta:creation-date>'
  + '<dc:date>2020-02-01T00:00:00Z</dc:date>'
  + '<meta:generator>LibreOffice lama</meta:generator>'
  + '</office:meta></office:document-meta>';

function ooxmlZip(extra = {}) {
  return zipSync({
    '[Content_Types].xml': strToU8(CONTENT_TYPES),
    '_rels/.rels': strToU8('<Relationships/>'),
    'word/document.xml': strToU8('<w:document><w:body/></w:document>'),
    'docProps/core.xml': strToU8(CORE_XML),
    'docProps/app.xml': strToU8(APP_XML),
    ...extra,
  });
}

function odfZip(extra = {}) {
  return zipSync({
    mimetype: [strToU8('application/vnd.oasis.opendocument.text'), { level: 0 }],
    'META-INF/manifest.xml': strToU8('<manifest:manifest/>'),
    'content.xml': strToU8('<office:document-content/>'),
    'meta.xml': strToU8(META_XML),
    ...extra,
  });
}

function officeFile(bytes, name) {
  return new File([bytes], name, { type: 'application/octet-stream' });
}

function readU32(bytes, offset) {
  return ((bytes[offset]
    | (bytes[offset + 1] << 8)
    | (bytes[offset + 2] << 16)
    | (bytes[offset + 3] << 24)) >>> 0);
}

function markEncrypted(zipBytes) {
  const out = zipBytes.slice();
  for (let i = 0; i + 4 <= out.length; i += 1) {
    const sig = readU32(out, i);
    if (sig === 0x04034b50) out[i + 6] |= 1;
    if (sig === 0x02014b50) out[i + 8] |= 1;
  }
  return out;
}

test('adapter exports the expected metadata and 9 extensions', () => {
  assert.equal(office.meta.id, 'office');
  assert.equal(office.meta.engine, 'office');
  assert.deepEqual(office.meta.extensions, OFFICE_SUBTYPES);
  assert.equal(OFFICE_SUBTYPES.length, 9);
  assert.equal(office.meta.mime, 'application/octet-stream');
  assert.equal(typeof office.dispose, 'function');
});

test('sectionsFor and fieldsFor follow the adapter field contract', () => {
  assert.deepEqual(sectionsFor('docx').map((section) => section.id), ['umum']);
  const ooxml = fieldsFor('docx');
  assert.ok(ooxml.some((field) => field.id === 'company' && field.native === 'docProps/app.xml:Company'));
  assert.ok(ooxml.every((field) => ['text', 'date', 'tags'].includes(field.type)));
  assert.ok(ooxml.every((field) => field.section === 'umum' && typeof field.label === 'string'));
  const odf = fieldsFor('odt');
  assert.ok(odf.some((field) => field.id === 'keywords' && field.native === 'meta.xml:meta:keyword'));
  assert.ok(!odf.some((field) => field.id === 'company'));
});

test('read returns mapped fields and raw rows for OOXML packages', async () => {
  const result = await read(officeFile(ooxmlZip(), 'input.docx'), { subtype: 'docx' });
  assert.equal(result.fields.title, 'Judul lama');
  assert.equal(result.fields.creator, 'Penulis lama');
  assert.deepEqual(result.fields.keywords, ['satu', 'dua']);
  assert.equal(result.fields.date, '2020-01-01');
  assert.equal(result.fields.modified, '2020-02-01');
  assert.equal(result.fields.lastModifiedBy, 'Editor lama');
  assert.equal(result.fields.company, 'PT Lama');
  assert.equal(result.fields.manager, 'Manajer lama');
  assert.equal(result.fields.software, 'Word lama');
  assert.deepEqual(result.info, { subtype: 'docx', signed: false, macros: false, entryCount: 5 });
  assert.ok(result.raw.some((row) => row.group === 'core' && row.tag === 'dc:title' && row.value === 'Judul lama'));
  assert.ok(result.raw.some((row) => row.group === 'app' && row.tag === 'Company' && row.value === 'PT Lama'));
  assert.deepEqual(result.warnings, []);
});

test('read infers the ODF subtype from the mimetype and reads multiple keywords', async () => {
  const result = await read(officeFile(odfZip(), 'input.odt'), {});
  assert.equal(result.info.subtype, 'odt');
  assert.deepEqual(result.fields.keywords, ['satu', 'dua']);
  assert.equal(result.fields.date, '2020-01-01');
  assert.equal(result.fields.modified, '2020-02-01');
  assert.equal(result.fields.software, 'LibreOffice lama');
  assert.equal(result.fields.company, '');
  assert.ok(result.raw.some((row) => row.group === 'meta' && row.tag === 'meta:keyword'));
});

test('write applies set, remove, rawRemove, and custom edits while preserving other entries', async () => {
  const before = ooxmlZip();
  const result = await write(officeFile(before, 'input.docx'), {
    set: { title: 'Judul baru', company: 'PT Baru', keywords: ['satu', 'tiga'] },
    remove: ['creator'],
    rawRemove: ['cp:lastModifiedBy'],
    custom: [{ key: 'cp:myTag', value: 'Nilai' }],
  }, { subtype: 'docx' }, (progress) => {
    assert.equal(typeof progress.pct, 'number');
  });

  const after = new Uint8Array(await result.blob.arrayBuffer());
  assert.deepEqual(
    await verifyZipPreserved(before, after, ['docProps/core.xml', 'docProps/app.xml']),
    { ok: true, changed: [] },
  );
  assert.equal(result.fields.title, 'Judul baru');
  assert.equal(result.fields.creator, '');
  assert.equal(result.fields.company, 'PT Baru');
  assert.deepEqual(result.fields.keywords, ['satu', 'tiga']);
  assert.ok(!result.raw.some((row) => row.tag === 'dc:creator'));
  assert.ok(!result.raw.some((row) => row.tag === 'cp:lastModifiedBy'));
  assert.deepEqual(result.custom, [{ key: 'cp:myTag', value: 'Nilai' }]);
  assert.equal(result.info.subtype, 'docx');
});

test('write honors customRemove on its own output', async () => {
  const first = await write(officeFile(ooxmlZip(), 'input.docx'), {
    custom: [{ key: 'cp:myTag', value: 'Nilai' }],
  }, { subtype: 'docx' });
  assert.deepEqual(first.custom, [{ key: 'cp:myTag', value: 'Nilai' }]);

  const second = await write(new File([first.blob], 'out.docx', { type: 'application/octet-stream' }), {
    customRemove: ['cp:myTag'],
  }, { subtype: 'docx' });
  assert.deepEqual(second.custom, []);
});

test('write updates ODF meta.xml and re-reads its own output', async () => {
  const before = odfZip();
  const result = await write(officeFile(before, 'input.odt'), {
    set: { title: 'Judul ODF', keywords: ['alpha', 'beta'], date: '2024-03-02', software: 'MeInsert' },
    remove: ['description'],
  }, { subtype: 'odt' });

  const after = new Uint8Array(await result.blob.arrayBuffer());
  assert.deepEqual(await verifyZipPreserved(before, after, ['meta.xml']), { ok: true, changed: [] });
  assert.equal(result.fields.title, 'Judul ODF');
  assert.deepEqual(result.fields.keywords, ['alpha', 'beta']);
  assert.equal(result.fields.date, '2024-03-02');
  assert.equal(result.fields.software, 'MeInsert');
  assert.equal(result.fields.description, '');
  assert.ok(!result.raw.some((row) => row.tag === 'dc:description'));
  assert.equal(result.info.subtype, 'odt');
});

test('read and write warn about signatures and macros', async () => {
  const signed = await read(officeFile(ooxmlZip({
    'word/_xmlsignatures/sig1.xml': strToU8('<Signature/>'),
  }), 'signed.docx'), { subtype: 'docx' });
  assert.ok(signed.info.signed);
  assert.ok(signed.warnings.some((warning) => /tanda tangan digital/i.test(warning)));

  const signedWrite = await write(officeFile(ooxmlZip({
    'word/_xmlsignatures/sig1.xml': strToU8('<Signature/>'),
  }), 'signed.docx'), { set: { title: 'X' } }, { subtype: 'docx' });
  assert.ok(signedWrite.warnings.some((warning) => /tanda tangan digital/i.test(warning)));

  const macros = await read(officeFile(ooxmlZip({
    'word/vbaProject.bin': strToU8('VBA'),
  }), 'macro.docm'), { subtype: 'docm' });
  assert.ok(macros.info.macros);
  assert.ok(macros.warnings.some((warning) => /makro/i.test(warning)));
});

test('encrypted packages surface ENCRYPTED_OFFICE from read and write', async () => {
  const encrypted = officeFile(markEncrypted(ooxmlZip()), 'encrypted.docx');
  await assert.rejects(() => read(encrypted, { subtype: 'docx' }), (error) => error.code === 'ENCRYPTED_OFFICE');
  await assert.rejects(
    () => write(encrypted, { set: { title: 'X' } }, { subtype: 'docx' }),
    (error) => error.code === 'ENCRYPTED_OFFICE',
  );
});

test('write escapes XML entities and round-trips the exact value', async () => {
  const title = 'A & B <C> "D" \'E\'';
  const result = await write(officeFile(ooxmlZip(), 'input.docx'), {
    set: { title },
  }, { subtype: 'docx' });
  assert.equal(result.fields.title, title);
  assert.deepEqual(result.warnings, []);
});

test('write rejects an empty plan with NO_CHANGES and dispose is safe', async () => {
  await assert.rejects(
    () => write(officeFile(ooxmlZip(), 'input.docx'), {}, { subtype: 'docx' }),
    (error) => error.code === 'NO_CHANGES',
  );
  await assert.doesNotReject(() => office.dispose());
  await assert.doesNotReject(() => office.dispose());
});
