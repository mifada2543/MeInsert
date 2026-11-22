/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — MeInsert Source-Available License v1.0 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { strFromU8, strToU8, unzipSync, zipSync } from '../../assets/vendor/fflate.mjs';
import { NS } from '../../assets/js/core/office-xml.js';
import { read, write } from '../../assets/js/formats/office.js';
const DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const CT = `${DECL}<Types xmlns="${NS.ct}">`
  + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
  + '<Default Extension="xml" ContentType="application/xml"/>'
  + '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
  + '</Types>';
const RELS = `${DECL}<Relationships xmlns="${NS.rels}">`
  + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
  + '</Relationships>';
const DOC = `${DECL}<w:document xmlns:w="${NS.w}"><w:body><w:p><w:r><w:t>Halo</w:t></w:r></w:p></w:body></w:document>`;
function core(body = '', extraAttrs = '') {
  return `${DECL}<cp:coreProperties xmlns:cp="${NS.cp}" xmlns:dc="${NS.dc}"`
    + ` xmlns:dcterms="${NS.dcterms}" xmlns:xsi="${NS.xsi}"${extraAttrs}>${body}</cp:coreProperties>`;
}
function ooxml(extra = {}) {
  return zipSync({
    '[Content_Types].xml': strToU8(CT),
    '_rels/.rels': strToU8(RELS),
    'word/document.xml': strToU8(DOC),
    'docProps/core.xml': strToU8(core()),
    ...extra,
  });
}
function odf(extra = {}) {
  const mimetype = strToU8('application/vnd.oasis.opendocument.text');
  return zipSync({
    mimetype: [mimetype, { level: 0 }],
    'META-INF/manifest.xml': strToU8(`${DECL}<manifest:manifest xmlns:manifest="${NS.manifest}">`
      + '<manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.text"/>'
      + '<manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>'
      + '<manifest:file-entry manifest:full-path="meta.xml" manifest:media-type="text/xml"/>'
      + '</manifest:manifest>'),
    'content.xml': strToU8(`${DECL}<office:document-content xmlns:office="${NS.office}"/>`),
    'meta.xml': strToU8(`${DECL}<office:document-meta xmlns:office="${NS.office}" xmlns:dc="${NS.dc}"`
      + ` xmlns:meta="${NS.meta}"><office:meta/></office:document-meta>`),
    ...extra,
  });
}
const file = (bytes, name = 'input.docx') => new File([bytes], name);
async function outputParts(result) {
  return unzipSync(new Uint8Array(await result.blob.arrayBuffer()));
}
function rejectCode(promise, code) {
  return assert.rejects(promise, (error) => error.code === code, `expected ${code}`);
}
const hasXmllint = spawnSync('xmllint', ['--version'], { stdio: 'ignore' }).status === 0;
function assertWellFormed(parts, names) {
  if (!hasXmllint) return;
  for (const name of names) {
    const check = spawnSync('xmllint', ['--noout', '-'], { input: parts[name], stdio: ['pipe', 'ignore', 'pipe'] });
    assert.equal(check.status, 0, `${name} is not well-formed: ${check.stderr.toString()}`);
  }
}
test('alternative dc prefix with an existing title is preserved and valid', async () => {
  const source = ooxml({
    'docProps/core.xml': strToU8(`${DECL}<cp:coreProperties xmlns:cp="${NS.cp}" xmlns:d="${NS.dc}">`
      + '<d:title>Lama</d:title></cp:coreProperties>'),
  });
  const result = await write(file(source), { set: { title: 'Baru' } }, { subtype: 'docx' });
  const parts = await outputParts(result);
  const xml = strFromU8(parts['docProps/core.xml']);
  assert.match(xml, /<d:title>Baru<\/d:title>/);
  assert.doesNotMatch(xml, /<dc:title>/);
  assertWellFormed(parts, ['docProps/core.xml', '[Content_Types].xml', '_rels/.rels']);
});
test('alternative prefix with a missing title creates a declared prefix', async () => {
  const source = ooxml({
    'docProps/core.xml': strToU8(`${DECL}<cp:coreProperties xmlns:cp="${NS.cp}" xmlns:d="${NS.dc}"/>`),
  });
  const result = await write(file(source), { set: { title: 'Judul baru' } }, { subtype: 'docx' });
  const parts = await outputParts(result);
  const xml = strFromU8(parts['docProps/core.xml']);
  assert.match(xml, /<d:title>Judul baru<\/d:title>/);
  assert.doesNotMatch(xml, /<dc:title>/);
  assertWellFormed(parts, ['docProps/core.xml']);
});
test('no bound prefix generates a declared prefix instead of an unbound one', async () => {
  const source = ooxml({
    'docProps/core.xml': strToU8(`${DECL}<cp:coreProperties xmlns:cp="${NS.cp}"/>`),
  });
  const result = await write(file(source), { set: { title: 'Judul' } }, { subtype: 'docx' });
  const parts = await outputParts(result);
  const xml = strFromU8(parts['docProps/core.xml']);
  assert.match(xml, /xmlns:dc="http:\/\/purl\.org\/dc\/elements\/1\.1\/"/);
  assert.match(xml, /<dc:title[^>]*>Judul<\/dc:title>/);
  assertWellFormed(parts, ['docProps/core.xml']);
});
test('default namespaces and nested redeclarations are honoured', async () => {
  const source = ooxml({
    'docProps/core.xml': strToU8(`${DECL}<coreProperties xmlns="${NS.cp}" xmlns:dc="${NS.dc}">`
      + '<dc:title xmlns:dc="urn:shadow">Lama</dc:title></coreProperties>'),
  });
  const result = await write(file(source), { set: { title: 'Baru' } }, { subtype: 'docx' });
  const parts = await outputParts(result);
  const xml = strFromU8(parts['docProps/core.xml']);
  assert.match(xml, /<dc:title xmlns:dc="urn:shadow">Lama<\/dc:title>/);
  assert.match(xml, /<dc:title>Baru<\/dc:title>/);
  assertWellFormed(parts, ['docProps/core.xml']);
});
test('entities, numeric references, Unicode and empty elements round-trip', async () => {
  const value = 'A & <B> "C" \u00e9 \u{1f600}';
  const source = ooxml({
    'docProps/core.xml': strToU8(`${DECL}<cp:coreProperties xmlns:cp="${NS.cp}" xmlns:dc="${NS.dc}">`
      + `<dc:title/><dc:subject>&#x1F600; &amp; d&#233;j&#224; vu</dc:subject></cp:coreProperties>`),
  });
  const readBack = await read(file(source), { subtype: 'docx' });
  assert.match(readBack.fields.subject, /\u{1f600} & d\u00e9j\u00e0 vu/u);
  const result = await write(file(source), { set: { title: value } }, { subtype: 'docx' });
  assert.equal(result.fields.title, value);
  const parts = await outputParts(result);
  assertWellFormed(parts, ['docProps/core.xml']);
});
test('xsi:type and unknown elements survive an edit', async () => {
  const source = ooxml({
    'docProps/core.xml': strToU8(core(
      '<dcterms:created xsi:type="dcterms:W3CDTF">2020-01-01T00:00:00Z</dcterms:created>'
      + '<extra:keep flag="yes" xmlns:extra="urn:meinsert:extra">unknown</extra:keep>',
    )),
  });
  const result = await write(file(source), { set: { date: '2026-05-06' } }, { subtype: 'docx' });
  const parts = await outputParts(result);
  const xml = strFromU8(parts['docProps/core.xml']);
  assert.match(xml, /<dcterms:created xsi:type="dcterms:W3CDTF">2026-05-06T00:00:00Z<\/dcterms:created>/);
  assert.match(xml, /<extra:keep flag="yes" xmlns:extra="urn:meinsert:extra">unknown<\/extra:keep>/);
  assertWellFormed(parts, ['docProps/core.xml']);
});
test('malformed metadata XML is rejected, not silently accepted', async () => {
  await rejectCode(read(file(ooxml({
    'docProps/core.xml': strToU8('<cp:coreProperties><dc:title>broken</cp:coreProperties>'),
  })), { subtype: 'docx' }), 'NOT_OFFICE_PACKAGE');
});
test('synthetic packages with fake Office entry names are rejected', async () => {
  const fake = zipSync({
    '[Content_Types].xml': strToU8('not xml at all <'),
    'word/document.xml': strToU8('<<<>>>'),
  });
  await rejectCode(read(file(fake, 'fake.docx'), { subtype: 'docx' }), 'NOT_OFFICE_PACKAGE');
  await rejectCode(write(file(fake, 'fake.docx'), { set: { title: 'x' } }, { subtype: 'docx' }), 'NOT_OFFICE_PACKAGE');
});
test('missing relationships, wrong root and wrong content type are rejected', async () => {
  const withoutRels = ooxml();
  const noRels = unzipSync(withoutRels);
  delete noRels['_rels/.rels'];
  await rejectCode(read(file(zipSync(noRels)), { subtype: 'docx' }), 'NOT_OFFICE_PACKAGE');
  const wrongRoot = unzipSync(ooxml());
  wrongRoot['word/document.xml'] = strToU8(`${DECL}<p:presentation xmlns:p="${NS.p}"/>`);
  await rejectCode(read(file(zipSync(wrongRoot)), { subtype: 'docx' }), 'NOT_OFFICE_PACKAGE');
  const wrongType = unzipSync(ooxml());
  wrongType['[Content_Types].xml'] = strToU8(CT.replace('wordprocessingml.document.main+xml', 'presentationml.presentation.main+xml'));
  await rejectCode(read(file(zipSync(wrongType)), { subtype: 'docx' }), 'NOT_OFFICE_PACKAGE');
  const missingMain = unzipSync(ooxml());
  delete missingMain['word/document.xml'];
  await rejectCode(read(file(zipSync(missingMain)), { subtype: 'docx' }), 'NOT_OFFICE_PACKAGE');
});
test('ODF manifest is validated semantically and encrypted packages are rejected', async () => {
  const badManifest = unzipSync(odf());
  badManifest['META-INF/manifest.xml'] = strToU8(`${DECL}<manifest:manifest xmlns:manifest="${NS.manifest}"/>`);
  await rejectCode(read(file(zipSync(badManifest), 'bad.odt'), {}), 'NOT_OFFICE_PACKAGE');
  const encrypted = unzipSync(odf());
  encrypted.mimetype = strToU8('application/vnd.oasis.opendocument.text-encrypted');
  await rejectCode(read(file(zipSync(encrypted), 'enc.odt'), {}), 'ENCRYPTED_OFFICE');
});
test('a valid package with a wrong extension is still identified from content', async () => {
  const result = await read(file(ooxml(), 'wrong.zip'), {});
  assert.equal(result.info.subtype, 'docx');
  assert.equal(result.info.packageValid, true);
});
test('creating a missing core part registers content type and relationship', async () => {
  const withoutCore = unzipSync(ooxml());
  delete withoutCore['docProps/core.xml'];
  withoutCore['[Content_Types].xml'] = strToU8(CT.replace(/<Override PartName="\/docProps\/core\.xml"[^>]*>/g, ''));
  withoutCore['_rels/.rels'] = strToU8(`${DECL}<Relationships xmlns="${NS.rels}">`
    + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
    + '</Relationships>');
  const result = await write(file(zipSync(withoutCore)), { set: { title: 'Registered' } }, { subtype: 'docx' });
  const parts = await outputParts(result);
  assert.ok(parts['docProps/core.xml']);
  assert.match(strFromU8(parts['[Content_Types].xml']), /docProps\/core\.xml/);
  assert.match(strFromU8(parts['_rels/.rels']), /core-properties/);
  assertWellFormed(parts, ['docProps/core.xml', '[Content_Types].xml', '_rels/.rels']);
  const repeated = await write(result.blob, { set: { creator: 'Again' } }, { subtype: 'docx' });
  const repeatedParts = await outputParts(repeated);
  assert.equal(strFromU8(repeatedParts['_rels/.rels']).match(/core-properties/g)?.length, 1);
});
test('native custom property value types are preserved', async () => {
  const source = ooxml({
    'docProps/custom.xml': strToU8(`${DECL}<Properties xmlns="${NS.custom}" xmlns:vt="${NS.vt}">`
      + '<property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="2" name="Count"><vt:i4>42</vt:i4></property>'
      + '</Properties>'),
  });
  const result = await write(file(source), { custom: [{ key: 'Count', value: '43' }] }, { subtype: 'docx' });
  const parts = await outputParts(result);
  assert.match(strFromU8(parts['docProps/custom.xml']), /<vt:i4>43<\/vt:i4>/);
  assertWellFormed(parts, ['docProps/custom.xml']);
});
test('invalid dates are rejected instead of silently deleting metadata', async () => {
  await rejectCode(
    write(file(ooxml()), { set: { date: 'not-a-date' } }, { subtype: 'docx' }),
    'INVALID_DATE',
  );
});
test('rawRemove can target entries in metadata parts that were not otherwise edited', async () => {
  const source = ooxml({
    'docProps/app.xml': strToU8(`${DECL}<Properties xmlns="${NS.ep}"><Company>ACME</Company></Properties>`),
  });
  const result = await write(file(source), { rawRemove: ['Company'] }, { subtype: 'docx' });
  assert.equal(result.fields.company, '');
});
test('field remove and rawRemove targeting the same element do not overlap edits', async () => {
  const source = ooxml({
    'docProps/core.xml': strToU8(core(
      '<dc:creator>Penulis</dc:creator>'
      + '<dcterms:modified xsi:type="dcterms:W3CDTF">2020-01-01T00:00:00Z</dcterms:modified>',
    )),
  });
  const result = await write(file(source), {
    remove: ['creator'],
    rawRemove: ['dc:creator', 'dcterms:modified'],
  }, { subtype: 'docx' });
  assert.equal(result.fields.creator, '');
  assert.equal(result.fields.modified, '');
});
test('an oversized preview part is skipped without rejecting a valid package', async () => {
  const noise = new Uint8Array(3 * 1024 * 1024);
  let seed = 7;
  for (let index = 0; index < noise.length; index += 1) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    noise[index] = (seed >>> 24) & 0xff;
  }
  const source = ooxml({ 'xl/sharedStrings.xml': noise });
  const result = await read(file(source), { subtype: 'docx' });
  assert.equal(result.info.packageValid, true);
  assert.ok(Array.isArray(result.info.contentPreview));
});