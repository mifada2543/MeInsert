/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
/**
 * Generator mandiri untuk fixture Office (OOXML + ODF) MeInsert.
 *
 * Membuat sebelas file kecil sepenuhnya dengan Node dan fflate yang sudah
 * di-vendor (assets/vendor/fflate.mjs): tanpa ffmpeg, ImageMagick, jaringan,
 * atau data pihak ketiga. Semua metadata bersifat sintetis dan jelas-jelas
 * untuk pengujian. Keluaran deterministik: setiap entri ZIP memakai tanggal
 * tetap (mtime) dan tidak ada sumber waktu/kebetulan lain, sehingga menjalankan
 * ulang skrip menghasilkan byte yang identik.
 *
 * Jalankan dari root repositori:
 *   node tests/fixtures/office-generate.mjs
 */
import { writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { zipSync, strToU8, unzipSync } from '../../assets/vendor/fflate.mjs';
const dir = fileURLToPath(new URL('.', import.meta.url));
const FIXED_DATE = new Date(2026, 0, 2, 3, 4, 6);
const ZIP_OPTS = { level: 6, mtime: FIXED_DATE };
const XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const XML_DECL_ODF = '<?xml version="1.0" encoding="UTF-8"?>';
const xml = (text) => strToU8(text);
function makeZip(entries) {
  const data = {};
  for (const [name, bytes, opts] of entries) data[name] = opts ? [bytes, opts] : bytes;
  return zipSync(data, ZIP_OPTS);
}
function check(condition, message) {
  if (!condition) throw new Error(`Verifikasi fixture gagal: ${message}`);
}
const utf8 = (bytes) => Buffer.from(bytes).toString('utf8');
const includes = (bytes, needle) => utf8(bytes).includes(needle);
/* OOXML */
const CORE_PROPS = `${XML_DECL}
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>Contoh Judul</dc:title><dc:subject>Subjek Uji</dc:subject><dc:creator>Penguji Sintetis</dc:creator><cp:keywords>uji, meinsert</cp:keywords><cp:lastModifiedBy>Penyunting</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">2026-01-02T03:04:06Z</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">2026-01-02T03:04:06Z</dcterms:modified></cp:coreProperties>`;
const APP_PROPS = `${XML_DECL}
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>MeInsert Test</Application><Company>Perusahaan Uji</Company><Manager>Manajer Uji</Manager></Properties>`;
const WORD_DOCUMENT = `${XML_DECL}
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Contoh dokumen uji MeInsert.</w:t></w:r></w:p><w:sectPr/></w:body></w:document>`;
const XL_WORKBOOK = `${XML_DECL}
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Lembar Uji" sheetId="1" r:id="rId1"/></sheets></workbook>`;
const XL_WORKBOOK_RELS = `${XML_DECL}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`;
const XL_SHEET = `${XML_DECL}
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Contoh Judul</t></is></c></row></sheetData></worksheet>`;
const PPT_PRESENTATION = `${XML_DECL}
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:sldIdLst><p:sldId id="256" r:id="rId1"/></p:sldIdLst><p:sldSz cx="9144000" cy="6858000" type="screen4x3"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`;

const PPT_RELS = `${XML_DECL}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/></Relationships>`;
const PPT_SLIDE = `${XML_DECL}
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
function dummyVba() {
  const head = strToU8('MeInsert synthetic VBA placeholder - not a real macro project.\n');
  const out = new Uint8Array(256);
  for (let i = 0; i < out.length; i += 1) out[i] = i < head.length ? head[i] : (i * 37 + 11) & 0xff;
  return out;
}
const OOXML_KINDS = {
  docx: { main: 'word/document.xml', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml', macro: false },
  docm: { main: 'word/document.xml', type: 'application/vnd.ms-word.document.macroEnabled.main+xml', macro: true, vba: 'word/vbaProject.bin' },
  xlsx: { main: 'xl/workbook.xml', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml', macro: false },
  xlsm: { main: 'xl/workbook.xml', type: 'application/vnd.ms-excel.sheet.macroEnabled.main+xml', macro: true, vba: 'xl/vbaProject.bin' },
  pptx: { main: 'ppt/presentation.xml', type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml', macro: false },
  pptm: { main: 'ppt/presentation.xml', type: 'application/vnd.ms-powerpoint.presentation.macroEnabled.main+xml', macro: true, vba: 'ppt/vbaProject.bin' },
};
function ooxmlEntries(kind) {
  const spec = OOXML_KINDS[kind];
  const overrides = [
    `<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>`,
    `<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>`,
    `<Override PartName="/${spec.main}" ContentType="${spec.type}"/>`,
  ];
  if (spec.macro) overrides.push(`<Default Extension="bin" ContentType="application/vnd.ms-office.vbaProject"/>`);
  if (kind === 'xlsx' || kind === 'xlsm') overrides.push(`<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`);
  if (kind === 'pptx' || kind === 'pptm') overrides.push(`<Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`);
  const contentTypes = `${XML_DECL}
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${overrides.join('')}</Types>`;
  const rootRels = `${XML_DECL}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="${spec.main}"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`;
  const entries = [
    ['[Content_Types].xml', xml(contentTypes)],
    ['_rels/.rels', xml(rootRels)],
    ['docProps/core.xml', xml(CORE_PROPS)],
    ['docProps/app.xml', xml(APP_PROPS)],
    [spec.main, xml(spec.main.startsWith('word/') ? WORD_DOCUMENT : spec.main.startsWith('xl/') ? XL_WORKBOOK : PPT_PRESENTATION)],
  ];
  if (kind === 'xlsx' || kind === 'xlsm') {
    entries.push(['xl/_rels/workbook.xml.rels', xml(XL_WORKBOOK_RELS)]);
    entries.push(['xl/worksheets/sheet1.xml', xml(XL_SHEET)]);
  }
  if (kind === 'pptx' || kind === 'pptm') {
    entries.push(['ppt/_rels/presentation.xml.rels', xml(PPT_RELS)]);
    entries.push(['ppt/slides/slide1.xml', xml(PPT_SLIDE)]);
  }
  if (spec.macro) entries.push([spec.vba, dummyVba()]);
  return entries;
}
const OFFICE_NS = 'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"';
const TEXT_NS = 'xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"';
const TABLE_NS = 'xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"';
const DRAW_NS = 'xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0"';
const SVG_NS = 'xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0"';
function odfMeta() {
  return `${XML_DECL_ODF}
<office:document-meta ${OFFICE_NS} xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0" office:version="1.2"><office:meta><meta:generator>MeInsert Test</meta:generator><dc:title>Contoh Judul</dc:title><dc:subject>Subjek Uji</dc:subject><dc:creator>Penguji Sintetis</dc:creator><meta:initial-creator>Penguji Sintetis</meta:initial-creator><meta:creation-date>2026-01-02T03:04:06Z</meta:creation-date><dc:date>2026-01-02T03:04:06Z</dc:date><meta:editing-cycles>2</meta:editing-cycles><meta:editing-duration>PT00H04M06S</meta:editing-duration><meta:keyword>uji, meinsert</meta:keyword></office:meta></office:document-meta>`;
}
function odfManifest(mime) {
  return `${XML_DECL_ODF}
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2"><manifest:file-entry manifest:full-path="/" manifest:version="1.2" manifest:media-type="${mime}"/><manifest:file-entry manifest:full-path="mimetype" manifest:media-type="text/plain"/><manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/><manifest:file-entry manifest:full-path="meta.xml" manifest:media-type="text/xml"/></manifest:manifest>`;
}
function odfContent(kind) {
  const body = kind === 'odt'
    ? `<office:text><text:p>Contoh dokumen uji MeInsert.</text:p></office:text>`
    : kind === 'ods'
      ? `<office:spreadsheet><table:table table:name="Lembar Uji"><table:table-row><table:table-cell office:value-type="string"><text:p>Contoh Judul</text:p></table:table-cell></table:table-row></table:table></office:spreadsheet>`
      : `<office:presentation><draw:page draw:name="Halaman 1"><draw:frame draw:name="Judul" svg:width="10cm" svg:height="2cm" svg:x="1cm" svg:y="1cm"><draw:text-box><text:p>Contoh Judul</text:p></draw:text-box></draw:frame></draw:page></office:presentation>`;
  return `${XML_DECL_ODF}
<office:document-content ${OFFICE_NS} ${TEXT_NS} ${TABLE_NS} ${DRAW_NS} ${SVG_NS} office:version="1.2"><office:body>${body}</office:body></office:document-content>`;
}
const ODF_KINDS = {
  odt: 'application/vnd.oasis.opendocument.text',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
  odp: 'application/vnd.oasis.opendocument.presentation',
};
function odfEntries(kind) {
  const mime = ODF_KINDS[kind];
  return [
    ['mimetype', strToU8(mime), { level: 0 }],
    ['META-INF/manifest.xml', xml(odfManifest(mime))],
    ['meta.xml', xml(odfMeta())],
    ['content.xml', xml(odfContent(kind))],
  ];
}
/* Verifikasi */
function firstZipEntry(bytes) {
  const b = Buffer.from(bytes);
  check(b.readUInt32LE(0) === 0x04034b50, 'tanda tangan local file header ZIP');
  const method = b.readUInt16LE(8);
  const nameLen = b.readUInt16LE(26);
  const extraLen = b.readUInt16LE(28);
  return {
    method,
    name: b.toString('utf8', 30, 30 + nameLen),
    headerSize: 30 + nameLen + extraLen,
  };
}
function verifyOoxml(name, bytes, spec) {
  const entries = unzipSync(bytes);
  check('[Content_Types].xml' in entries, `${name}: [Content_Types].xml`);
  check('_rels/.rels' in entries, `${name}: _rels/.rels`);
  check('docProps/core.xml' in entries, `${name}: docProps/core.xml`);
  check('docProps/app.xml' in entries, `${name}: docProps/app.xml`);
  check(spec.main in entries, `${name}: ${spec.main}`);
  const core = entries['docProps/core.xml'];
  for (const needle of ['Contoh Judul', 'Penguji Sintetis', 'uji, meinsert', 'Subjek Uji', 'Penyunting', 'dcterms:created']) {
    check(includes(core, needle), `${name}: core.xml memuat ${needle}`);
  }
  const app = entries['docProps/app.xml'];
  for (const needle of ['Perusahaan Uji', 'Manajer Uji', 'MeInsert Test']) {
    check(includes(app, needle), `${name}: app.xml memuat ${needle}`);
  }
  if (spec.macro) check(spec.vba in entries, `${name}: ${spec.vba}`);
}
function verifyOdf(name, bytes, kind) {
  const entries = unzipSync(bytes);
  const keys = Object.keys(entries);
  check(keys[0] === 'mimetype', `${name}: mimetype adalah entri pertama (didapat ${keys[0]})`);
  check(Buffer.from(entries.mimetype).equals(strToU8(ODF_KINDS[kind])), `${name}: nilai mimetype`);
  const first = firstZipEntry(bytes);
  check(first.name === 'mimetype', `${name}: nama entri ZIP pertama`);
  check(first.method === 0, `${name}: mimetype STORED (method=${first.method})`);
  check(first.headerSize === 38, `${name}: header mimetype tanpa extra field (${first.headerSize})`);
  const meta = entries['meta.xml'];
  for (const needle of ['dc:title', 'dc:creator', 'meta:initial-creator', 'meta:generator',
    'meta:creation-date', 'dc:date', 'meta:editing-cycles', 'meta:editing-duration', 'meta:keyword']) {
    check(includes(meta, needle), `${name}: meta.xml memuat ${needle}`);
  }
  check('META-INF/manifest.xml' in entries, `${name}: manifest`);
  check('content.xml' in entries, `${name}: content.xml`);
}
/* Build + tulis */
const outputs = [];
for (const kind of Object.keys(OOXML_KINDS)) {
  const name = `sample.${kind}`;
  const bytes = makeZip(ooxmlEntries(kind));
  verifyOoxml(name, bytes, OOXML_KINDS[kind]);
  outputs.push([name, bytes]);
}
const signedName = 'signed.docx';
const signedEntries = [
  ...ooxmlEntries('docx'),
  ['_xmlsignatures/origin.sigs', xml(`${XML_DECL}\n<Mock:signatures xmlns:Mock="urn:meinsert:test:mock-signature">Synthetic XML signature marker. Presence-only: NOT a real signature.</Mock:signatures>`)],
];
const signed = makeZip(signedEntries);
{
  const entries = unzipSync(signed);
  check('[Content_Types].xml' in entries, 'signed.docx: [Content_Types].xml');
  check('_xmlsignatures/origin.sigs' in entries, 'signed.docx: _xmlsignatures/origin.sigs');
}
outputs.push([signedName, signed]);

for (const kind of Object.keys(ODF_KINDS)) {
  const name = `sample.${kind}`;
  const bytes = makeZip(odfEntries(kind));
  verifyOdf(name, bytes, kind);
  outputs.push([name, bytes]);
}
const encryptedName = 'encrypted.docx';
const oleMagic = Buffer.from('d0cf11e0a1b11ae1', 'hex');
const encNote = strToU8('MeInsert synthetic OLE2-like header (MOCK, NOT a real encrypted document). Adapter error-path fixture only.\n');
const encrypted = new Uint8Array(512);
encrypted.set(oleMagic, 0);
encrypted.set(encNote, 72);
check(Buffer.from(encrypted.subarray(0, 8)).equals(oleMagic), 'encrypted.docx: OLE2 magic');
outputs.push([encryptedName, encrypted]);
for (const [name, bytes] of outputs) {
  check(bytes.length < 8192, `${name}: ukuran ${bytes.length} byte >= 8192`);
  writeFileSync(join(dir, name), bytes);
}
for (const [name, bytes] of outputs) {
  const written = readFileSync(join(dir, name));
  check(Buffer.from(written).equals(Buffer.from(bytes)), `${name}: isi file di disk identik`);
}
console.log(`Generated ${outputs.length} synthetic Office fixtures (all < 8 KB, deterministic).`);
console.log(`ODF check: mimetype is entry 0, STORED, no extra field, header size 38 bytes.`);
console.log(`OOXML check: [Content_Types].xml + core.xml/app.xml present; signed.docx has _xmlsignatures/; encrypted.docx starts with OLE2 magic.`);