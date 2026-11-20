/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import { asArray, asString, sameValue, toDateInput, toIsoDate } from '../core/tag-utils.js';
import { AppError } from '../core/errors.js';
import { inspectZip, OFFICE_METADATA_PARTS, patchZip, verifyZipPreserved } from '../core/office-zip.js';
import { strFromU8, strToU8 } from '../../vendor/fflate.mjs';
export const OFFICE_SUBTYPES = ['docx', 'xlsx', 'pptx', 'docm', 'xlsm', 'pptm', 'odt', 'ods', 'odp'];
export const meta = {
  id: 'office',
  engine: 'office',
  label: 'Office',
  description: 'Dokumen Word, Excel, PowerPoint, dan OpenDocument',
  extensions: [...OFFICE_SUBTYPES],
  mime: 'application/octet-stream',
};
const ODF_SUBTYPES = new Set(['odt', 'ods', 'odp']);
const SIGNED_WARNING = 'Dokumen Office ini memiliki tanda tangan digital. Menulis metadata akan membuat tanda tangan tidak valid.';
const MACRO_WARNING = 'Dokumen Office ini mengandung makro. Metadata ditulis dengan usaha terbaik; integritas makro tidak dijamin.';
export function sectionsFor(_subtype) {
  return [{
    id: 'umum',
    title: 'Metadata Office',
    description: 'Ditulis ke docProps/core.xml, docProps/app.xml, atau meta.xml sesuai format dokumen. Bagian lain dari arsip tidak diubah.',
  }];
}
function commonFields(nativeBase, keywordsNative, dateNative, modifiedNative, softwareNative, withOfficeExtras) {
  const fields = [
    { id: 'title', section: 'umum', label: 'Judul', type: 'text', native: `${nativeBase}:dc:title`, placeholder: 'Judul dokumen', maxLength: 256 },
    { id: 'creator', section: 'umum', label: 'Pembuat', type: 'text', native: `${nativeBase}:dc:creator`, placeholder: 'Nama pembuat atau organisasi', maxLength: 200 },
    { id: 'subject', section: 'umum', label: 'Subjek', type: 'text', native: `${nativeBase}:dc:subject`, placeholder: 'Subjek dokumen', maxLength: 500 },
    { id: 'keywords', section: 'umum', label: 'Kata kunci', type: 'tags', native: keywordsNative, placeholder: 'laporan, keuangan, 2026', helper: 'Pisahkan dengan koma.', maxLength: 1000 },
    { id: 'description', section: 'umum', label: 'Deskripsi', type: 'text', native: `${nativeBase}:dc:description`, placeholder: 'Ringkasan isi dokumen…', maxLength: 2000 },
    { id: 'date', section: 'umum', label: 'Tanggal dibuat', type: 'date', native: dateNative },
    { id: 'modified', section: 'umum', label: 'Tanggal diubah', type: 'date', native: modifiedNative },
  ];
  if (withOfficeExtras) {
    fields.push(
      { id: 'lastModifiedBy', section: 'umum', label: 'Terakhir diubah oleh', type: 'text', native: 'docProps/core.xml:cp:lastModifiedBy', placeholder: 'Nama pengguna terakhir', maxLength: 200 },
      { id: 'company', section: 'umum', label: 'Perusahaan', type: 'text', native: 'docProps/app.xml:Company', placeholder: 'Nama perusahaan', maxLength: 200 },
      { id: 'manager', section: 'umum', label: 'Manajer', type: 'text', native: 'docProps/app.xml:Manager', placeholder: 'Nama manajer', maxLength: 200 },
    );
  }
  fields.push({ id: 'software', section: 'umum', label: 'Perangkat lunak', type: 'text', native: softwareNative, placeholder: 'Aplikasi pembuat dokumen', maxLength: 200 });
  return fields;
}
const OOXML_FIELDS = commonFields(
  'docProps/core.xml',
  'docProps/core.xml:cp:keywords',
  'docProps/core.xml:dcterms:created',
  'docProps/core.xml:dcterms:modified',
  'docProps/app.xml:Application',
  true,
);
const ODF_FIELDS = commonFields(
  'meta.xml',
  'meta.xml:meta:keyword',
  'meta.xml:meta:creation-date',
  'meta.xml:dc:date',
  'meta.xml:meta:generator',
  false,
);
export function fieldsFor(subtype) {
  return ODF_SUBTYPES.has(String(subtype || '').toLowerCase()) ? ODF_FIELDS : OOXML_FIELDS;
}
const FIELD_TARGETS = {
  ooxml: {
    title: [['core', 'dc:title']],
    creator: [['core', 'dc:creator']],
    subject: [['core', 'dc:subject']],
    keywords: [['core', 'cp:keywords']],
    description: [['core', 'dc:description']],
    date: [['core', 'dcterms:created']],
    modified: [['core', 'dcterms:modified']],
    lastModifiedBy: [['core', 'cp:lastModifiedBy']],
    company: [['app', 'Company']],
    manager: [['app', 'Manager']],
    software: [['app', 'Application']],
  },
  odf: {
    title: [['meta', 'dc:title']],
    creator: [['meta', 'dc:creator']],
    subject: [['meta', 'dc:subject']],
    keywords: [['meta', 'meta:keyword']],
    description: [['meta', 'dc:description']],
    date: [['meta', 'meta:creation-date']],
    modified: [['meta', 'dc:date']],
    software: [['meta', 'meta:generator']],
  },
};
const ALL_MAPPED_TAGS = new Set(
  [...Object.values(FIELD_TARGETS.ooxml), ...Object.values(FIELD_TARGETS.odf)]
    .flat()
    .map(([, tag]) => tag.toLowerCase()),
);
const STANDARD_TAGS = new Set([
  'cp:category', 'cp:contentstatus', 'cp:version', 'cp:revision', 'cp:lastprinted',
  'cp:identifier', 'cp:language', 'dcterms:created', 'dcterms:modified',
  'dc:language', 'dc:identifier', 'dc:publisher', 'dc:contributor', 'dc:rights',
  'dc:source', 'dc:relation', 'dc:coverage', 'dc:type', 'dc:format',
  'application', 'appversion', 'company', 'manager', 'pages', 'words', 'characters',
  'paragraphs', 'lines', 'totaltime', 'template', 'lastsavedby', 'revisionnumber',
  'numberofcharacterswithspaces', 'notes', 'hiddenpages', 'hiddenslides', 'presentationformat',
  'office:meta', 'office:document-meta', 'cp:coreproperties', 'properties',
  'meta:initial-creator', 'meta:editing-cycles', 'meta:editing-duration',
  'meta:date-string', 'meta:user-defined', 'meta:document-statistic', 'meta:generator',
]);
const CONTAINER_TAGS = new Set([
  'cp:coreproperties', 'office:document-meta', 'office:meta', 'properties',
  'vt:vector', 'vt:variant', 'customproperties',
]);
const PART_NAMES = {
  core: 'docProps/core.xml',
  app: 'docProps/app.xml',
  meta: 'meta.xml',
};
const FRESH_ROOTS = {
  core: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
    + '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"'
    + ' xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/"'
    + ' xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">\n</cp:coreProperties>',
  app: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
    + '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"'
    + ' xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">\n</Properties>',
  meta: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
    + '<office:document-meta xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"'
    + ' xmlns:dc="http://purl.org/dc/elements/1.1/"'
    + ' xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0">\n<office:meta>\n</office:meta>\n</office:document-meta>',
};
async function toBytes(input) {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (input && typeof input.arrayBuffer === 'function') return new Uint8Array(await input.arrayBuffer());
  if (Array.isArray(input)) return new Uint8Array(input);
  throw new AppError('CORRUPT_FILE', 'Dokumen Office tidak bisa dibaca.');
}
function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function decodeXml(value) {
  return String(value || '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}
function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
function elementText(inner) {
  return decodeXml(String(inner).replace(/<[^>]*>/g, '')).trim();
}
function elementPatterns(qualified) {
  const name = escapeRegExp(qualified);
  return {
    paired: new RegExp(`<${name}\\b(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}\\s*>`, 'gi'),
    self: new RegExp(`<${name}\\b(?:\\s[^>]*)?\\/>`, 'gi'),
  };
}
function elementValues(xml, qualified) {
  const { paired } = elementPatterns(qualified);
  const out = [];
  for (const match of xml.matchAll(paired)) {
    const value = elementText(match[1]);
    if (value) out.push(value);
  }
  return out;
}
function hasElement(xml, qualified) {
  const { paired, self } = elementPatterns(qualified);
  return paired.test(xml) || self.test(xml);
}
function removeElements(xml, qualified) {
  const { paired, self } = elementPatterns(qualified);
  return xml.replace(self, '').replace(paired, '');
}
function rootName(xml) {
  const match = /<([A-Za-z_][\w.-]*(?::[\w.-]+)?)(?=[\s>/])/.exec(xml);
  return match ? match[1] : '';
}
function insertElements(xml, qualified, values, anchor) {
  if (!values.length) return xml;
  const fragment = values.map((value) => `<${qualified}>${escapeXml(value)}</${qualified}>`).join('');
  let closeIndex = -1;
  if (anchor) {
    const re = new RegExp(`<\\/${escapeRegExp(anchor)}\\s*>`, 'gi');
    const matches = [...xml.matchAll(re)];
    if (matches.length) closeIndex = matches[matches.length - 1].index;
  }
  if (closeIndex < 0) closeIndex = xml.lastIndexOf('</');
  if (closeIndex < 0) return `${xml}${fragment}`;
  return `${xml.slice(0, closeIndex)}${fragment}${xml.slice(closeIndex)}`;
}
function upsert(xml, qualified, values, anchor) {
  return insertElements(removeElements(xml, qualified), qualified, values, anchor);
}
function anchorFor(kind, odf, xml) {
  if (odf && kind === 'meta') return 'office:meta';
  return rootName(xml);
}
function inventory(xml) {
  const map = new Map();
  const container = rootName(xml);
  const re = /<([A-Za-z_][\w.-]*(?::[\w.-]+)?)([^>]*)>/g;
  let match;
  const tags = [];
  while ((match = re.exec(xml))) {
    if (/\/\s*$/.test(match[2])) continue;
    const tag = match[1];
    if (tag === container || CONTAINER_TAGS.has(tag.toLowerCase())) continue;
    if (tags.includes(tag)) continue;
    tags.push(tag);
  }
  for (const tag of tags) {
    const values = elementValues(xml, tag);
    if (values.length) map.set(tag, values);
  }
  return map;
}
function localName(tag) {
  return String(tag || '').split(':').pop().toLowerCase();
}
function canonicalInventory(xml) {
  const result = new Map();
  for (const [tag, values] of inventory(xml)) {
    const key = localName(tag);
    if (!result.has(key)) result.set(key, values);
  }
  return result;
}
function resolveTag(xml, qualified) {
  const local = localName(qualified);
  const match = new RegExp(`<([A-Za-z_][\\w.-]*:)?${escapeRegExp(local)}\\b`, 'i').exec(xml);
  return match ? `${match[1] || ''}${local}` : qualified;
}
const CUSTOM_PART = 'docProps/custom.xml';
const CUSTOM_FMTID = '{D5CDD505-2E9C-101B-9397-08002B2CF9AE}';
const CUSTOM_ROOT = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
  + '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties"'
  + ' xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"></Properties>';
function decodeAttribute(value) {
  return decodeXml(String(value || ''));
}
function nativeCustomEntries(inspected, odf) {
  const found = new Map();
  if (!odf) {
    const text = previewEntry(inspected, CUSTOM_PART);
    for (const match of text.matchAll(/<property\b([^>]*)>([\s\S]*?)<\/property>/gi)) {
      const name = /name="([^"]+)"/i.exec(match[1]);
      const body = /<vt:lpwstr>([\s\S]*?)<\/vt:lpwstr>/i.exec(match[2])
        || /<vt:([A-Za-z]+)>([\s\S]*?)<\/vt:\1>/i.exec(match[2]);
      if (!name) continue;
      const value = body ? decodeXml(body[2] || body[1] || '') : '';
      if (value) found.set(decodeAttribute(name[1]), value);
    }
  } else {
    const text = previewEntry(inspected, 'meta.xml');
    for (const match of text.matchAll(/<meta:user-defined\b([^>]*)>([\s\S]*?)<\/meta:user-defined>/gi)) {
      const name = /meta:name="([^"]+)"/i.exec(match[1]);
      if (!name) continue;
      const value = decodeXml(match[2]);
      if (value) found.set(decodeAttribute(name[1]), value);
    }
  }
  return found;
}
function customPropertyXml(xml, key, value) {
  const name = escapeXml(key);
  const pattern = new RegExp(`<property\\b[^>]*\\bname="${escapeRegExp(name)}"[^>]*>[\\s\\S]*?<\\/property>`, 'i');
  const ids = [...xml.matchAll(/\bpid="(\d+)"/gi)].map((match) => Number(match[1]));
  const pid = Math.max(1, ...ids) + 1;
  const element = `<property fmtid="${CUSTOM_FMTID}" pid="${pid}" name="${name}">`
    + `<vt:lpwstr>${escapeXml(value)}</vt:lpwstr></property>`;
  return pattern.test(xml) ? xml.replace(pattern, element) : xml.replace(/<\/Properties\s*>/i, `${element}</Properties>`);
}
function customPropertyRemove(xml, key, odf) {
  const name = escapeXml(key);
  if (odf) {
    const pattern = new RegExp(`<meta:user-defined\\b[^>]*\\bmeta:name="${escapeRegExp(name)}"[^>]*>[\\s\\S]*?<\\/meta:user-defined>`, 'i');
    return xml.replace(pattern, '');
  }
  const pattern = new RegExp(`<property\\b[^>]*\\bname="${escapeRegExp(name)}"[^>]*>[\\s\\S]*?<\\/property>`, 'i');
  return xml.replace(pattern, '');
}
function updateRelationshipXml(inspected, replacements) {
  const name = '_rels/.rels';
  const entry = inspected.entries.find((item) => item.name === name);
  const xml = entry ? new TextDecoder().decode(entry.data)
    : '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
  if (/Target="\/?docProps\/custom\.xml"/i.test(xml)) return;
  const ids = [...xml.matchAll(/\bId="rId(\d+)"/gi)].map((match) => Number(match[1]));
  const id = `rId${Math.max(0, ...ids) + 1}`;
  const rel = `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/custom-properties" Target="docProps/custom.xml"/>`;
  const updated = /<Relationships\s*\/>/i.test(xml)
    ? xml.replace(/<Relationships\s*\/>/i, `<Relationships>${rel}</Relationships>`)
    : xml.replace(/<\/Relationships\s*>/i, `${rel}</Relationships>`);
  replacements.set(name, strToU8(updated));
}
function updateContentTypes(inspected, replacements) {
  const name = '[Content_Types].xml';
  const entry = inspected.entries.find((item) => item.name === name);
  if (!entry) return;
  const xml = new TextDecoder().decode(entry.data);
  if (/PartName="\/?docProps\/custom\.xml"/i.test(xml)) return;
  const override = '<Override PartName="/docProps/custom.xml" ContentType="application/vnd.openxmlformats-officedocument.custom-properties+xml"/>';
  replacements.set(name, strToU8(xml.replace(/<\/Types\s*>/i, `${override}</Types>`)));
}
const PREVIEW_LIMITS = { items: 6, itemChars: 120, totalChars: 280 };
function previewText(xml, pattern) {
  const out = [];
  for (const match of String(xml || '').matchAll(pattern)) {
    const value = decodeXml(match[1]).replace(/\s+/g, ' ').trim();
    if (value) out.push(value.slice(0, PREVIEW_LIMITS.itemChars));
    if (out.length >= PREVIEW_LIMITS.items) break;
  }
  return out;
}
function previewEntry(inspected, name) {
  const entry = inspected.entries.find((item) => item.name === name);
  return entry ? new TextDecoder().decode(entry.data) : '';
}
function contentPreview(inspected, subtype) {
  const kind = String(subtype || '').toLowerCase();
  const groups = [];
  if (kind.startsWith('doc')) {
    const values = previewText(previewEntry(inspected, 'word/document.xml'), /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/gi);
    if (values.length) groups.push({ key: 'paragraphs', values });
  } else if (kind.startsWith('xls') || kind === 'ods') {
    const workbook = previewEntry(inspected, 'xl/workbook.xml');
    const sheets = previewText(workbook, /<sheet\b[^>]*\bname="([^"]+)"/gi);
    if (kind === 'ods') {
      const odf = previewText(previewEntry(inspected, 'content.xml'), /<table:table\b[^>]*\btable:name="([^"]+)"/gi);
      sheets.push(...odf);
    }
    if (sheets.length) groups.push({ key: 'sheets', values: sheets.slice(0, PREVIEW_LIMITS.items) });
    const strings = previewText(previewEntry(inspected, 'xl/sharedStrings.xml'), /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/gi);
    if (strings.length) groups.push({ key: 'cells', values: strings });
  } else if (kind.startsWith('ppt') || kind === 'odp') {
    const slides = previewText(previewEntry(inspected, 'ppt/slides/slide1.xml'), /<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/gi);
    if (kind === 'odp') slides.push(...previewText(previewEntry(inspected, 'content.xml'), /<text:p(?:\s[^>]*)?>([\s\S]*?)<\/text:p>/gi));
    if (slides.length) groups.push({ key: 'slides', values: slides });
  } else if (kind === 'odt') {
    const values = previewText(previewEntry(inspected, 'content.xml'), /<text:p(?:\s[^>]*)?>([\s\S]*?)<\/text:p>/gi);
    if (values.length) groups.push({ key: 'paragraphs', values });
  }
  let used = 0;
  const trimmed = [];
  for (const group of groups) {
    const values = [];
    for (const value of group.values) {
      if (used + value.length > PREVIEW_LIMITS.totalChars) break;
      used += value.length;
      values.push(value);
    }
    if (values.length) trimmed.push({ key: group.key, values });
    if (used >= PREVIEW_LIMITS.totalChars) break;
  }
  return { contentPreview: trimmed };
}
function inferSubtype(inspected, options, file) {
  const explicit = String(options?.subtype || '').toLowerCase();
  if (OFFICE_SUBTYPES.includes(explicit)) return explicit;
  if (inspected.odf) {
    const mimetype = inspected.mimetype;
    if (/spreadsheet/i.test(mimetype)) return 'ods';
    if (/presentation/i.test(mimetype)) return 'odp';
    return 'odt';
  }
  const contentTypes = inspected.entries.find((entry) => entry.name === '[Content_Types].xml');
  const text = contentTypes ? strFromU8(contentTypes.data) : '';
  const macro = /macroenabled/i.test(text);
  if (/wordprocessingml/i.test(text)) return macro ? 'docm' : 'docx';
  if (/spreadsheetml/i.test(text)) return macro ? 'xlsm' : 'xlsx';
  if (/presentationml/i.test(text)) return macro ? 'pptm' : 'pptx';
  const names = inspected.entries.map((entry) => entry.name);
  if (names.some((name) => name.startsWith('word/'))) return 'docx';
  if (names.some((name) => name.startsWith('xl/'))) return 'xlsx';
  if (names.some((name) => name.startsWith('ppt/'))) return 'pptx';
  const extension = String(options?.extension || (file?.name || '').split('.').pop() || '').toLowerCase();
  return OFFICE_SUBTYPES.includes(extension) ? extension : 'docx';
}
function fieldValue(fieldId, targets, parts, odf) {
  const values = [];
  for (const [kind, tag] of targets[fieldId] || []) {
    const found = parts.get(kind)?.get(localName(tag));
    if (found) values.push(...found);
  }
  if (!values.length) return fieldId === 'keywords' ? [] : '';
  if (fieldId === 'keywords') {
    return odf ? values : asArray(values.join(', '));
  }
  if (fieldId === 'date' || fieldId === 'modified') return toDateInput(values[0]);
  return values.join(', ');
}
function assertOfficePackage(inspected) {
  if (inspected.packageValid === false) {
    throw new AppError(
      'NOT_OFFICE_PACKAGE',
      'Arsip ini bukan paket Office yang valid.',
      (inspected.findings || []).join('; '),
    );
  }
}
export async function read(file, options = {}) {
  const bytes = await toBytes(file);
  const inspected = await inspectZip(bytes);
  assertOfficePackage(inspected);
  const subtype = inferSubtype(inspected, options, file);
  const odf = inspected.odf;
  const targets = FIELD_TARGETS[odf ? 'odf' : 'ooxml'];
  const parts = new Map();
  const canonical = new Map();
  const partText = new Map();
  for (const kind of ['core', 'app', 'meta']) {
    const entry = inspected.entries.find((item) => item.name === PART_NAMES[kind]);
    const text = entry ? new TextDecoder().decode(entry.data) : '';
    partText.set(kind, text);
    parts.set(kind, text ? inventory(text) : new Map());
    canonical.set(kind, text ? canonicalInventory(text) : new Map());
  }
  const fields = {};
  for (const id of new Set([...Object.keys(FIELD_TARGETS.ooxml), ...Object.keys(FIELD_TARGETS.odf)])) {
    fields[id] = fieldValue(id, targets, canonical, odf);
  }
  const raw = [];
  const custom = [];
  for (const [kind, map] of parts) {
    for (const [tag, values] of map) {
      const value = values.join(', ');
      if (!value) continue;
      raw.push({ group: kind, tag, value });
      const lower = tag.toLowerCase();
      if (!ALL_MAPPED_TAGS.has(lower) && !STANDARD_TAGS.has(lower)) custom.push({ key: tag, value });
    }
  }
  raw.sort((a, b) => a.group.localeCompare(b.group) || a.tag.localeCompare(b.tag));
  for (const [key, value] of nativeCustomEntries(inspected, odf)) {
    if (!custom.some((item) => item.key === key)) custom.push({ key, value });
  }
  custom.sort((a, b) => a.key.localeCompare(b.key));
  const warnings = [];
  if (inspected.signed) warnings.push(SIGNED_WARNING);
  if (inspected.macros) warnings.push(MACRO_WARNING);
  if (!inspected.valid) warnings.push('Struktur arsip Office tidak sepenuhnya valid. Periksa kembali file hasil.');
  return {
    fields,
    custom,
    raw,
    info: {
      subtype,
      signed: inspected.signed,
      macros: inspected.macros,
      valid: inspected.valid,
      packageValid: inspected.packageValid,
      entryCount: inspected.entries.length,
      ...officeSummary(fields, canonical, partText, subtype),
      ...contentPreview(inspected, subtype),
    },
    warnings,
  };
}
function firstValue(map, tag) {
  const values = map?.get(localName(tag));
  return values && values.length ? String(values[0]).trim() : '';
}
function attributeValue(xml, attribute) {
  const match = new RegExp(`${attribute.replace(/:/g, '\\:')}="([^"]*)"`, 'i').exec(xml || '');
  return match ? match[1].trim() : '';
}
function positiveCount(value) {
  const number = Number.parseInt(String(value || '').replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(number) && number > 0 ? number : null;
}
function officeSummary(fields, parts, partText, subtype) {
  const app = parts.get('app') || new Map();
  const metaText = partText.get('meta') || '';
  const odf = ODF_SUBTYPES.has(String(subtype || '').toLowerCase());
  const readable = (value) => (typeof value === 'string' ? value.trim() : String(value || '').trim());
  return {
    title: readable(fields.title),
    creator: readable(fields.creator),
    subject: readable(fields.subject),
    company: readable(fields.company),
    application: readable(fields.software),
    modified: readable(fields.modified),
    pages: odf ? positiveCount(attributeValue(metaText, 'meta:page-count')) : positiveCount(firstValue(app, 'Pages')),
    words: odf ? positiveCount(attributeValue(metaText, 'meta:word-count')) : positiveCount(firstValue(app, 'Words')),
    slides: odf ? null : positiveCount(firstValue(app, 'Slides')),
    sheets: odf ? null : positiveCount(firstValue(app, 'Sheets')),
  };
}
function setFieldValue(p, id, value, targets, kind, tag, odf) {
  let values;
  if (id === 'keywords') {
    const list = asArray(value);
    values = odf ? list : [list.join(', ')];
  } else if (id === 'date' || id === 'modified') {
    const iso = toIsoDate(value);
    values = iso ? [iso] : [];
  } else {
    const text = asString(value);
    values = text ? [text] : [];
  }
  p.xml = upsert(p.xml, resolveTag(p.xml, tag), values, anchorFor(kind, odf, p.xml));
}
function fieldMatches(id, expected, actual, definitions) {
  const definition = definitions.find((field) => field.id === id);
  if (definition?.type === 'tags') {
    return asArray(expected).join(', ') === asArray(actual).join(', ');
  }
  if (definition?.type === 'date') return toDateInput(expected) === toDateInput(actual);
  return sameValue(expected, actual);
}
export async function write(file, payload, options = {}, report = () => {}) {
  const bytes = await toBytes(file);
  const inspected = await inspectZip(bytes);
  assertOfficePackage(inspected);
  const subtype = inferSubtype(inspected, options, file);
  const odf = inspected.odf;
  const targets = FIELD_TARGETS[odf ? 'odf' : 'ooxml'];
  const definitions = fieldsFor(subtype);
  const supported = new Set(Object.keys(targets));
  const set = payload?.set || {};
  const remove = new Set(payload?.remove || []);
  const warnings = [];
  if (inspected.signed) warnings.push(SIGNED_WARNING);
  if (inspected.macros) warnings.push(MACRO_WARNING);
  const parts = new Map();
  const loadPart = (kind) => {
    if (parts.has(kind)) return parts.get(kind);
    const entry = inspected.entries.find((item) => item.name === PART_NAMES[kind]);
    if (!entry) {
      parts.set(kind, null);
      return null;
    }
    const xml = new TextDecoder().decode(entry.data);
    const part = { name: PART_NAMES[kind], xml, root: xml };
    parts.set(kind, part);
    return part;
  };
  const ensurePart = (kind) => {
    const existing = loadPart(kind);
    if (existing) return existing;
    const root = FRESH_ROOTS[kind];
    const part = { name: PART_NAMES[kind], xml: root, root };
    parts.set(kind, part);
    return part;
  };
  for (const [id, value] of Object.entries(set)) {
    if (!supported.has(id)) {
      warnings.push(`Field "${id}" tidak tersedia untuk format ${subtype.toUpperCase()} dan diabaikan.`);
      continue;
    }
    for (const [kind, tag] of targets[id]) {
      setFieldValue(ensurePart(kind), id, value, targets, kind, tag, odf);
    }
  }
  for (const id of remove) {
    if (!supported.has(id)) {
      warnings.push(`Field "${id}" tidak tersedia untuk format ${subtype.toUpperCase()} dan diabaikan.`);
      continue;
    }
    for (const [kind, tag] of targets[id]) {
      const part = loadPart(kind);
      if (part) part.xml = upsert(part.xml, tag, [], anchorFor(kind, odf, part.xml));
    }
  }
  const replacements = new Map();
  const removeTags = [...(payload?.rawRemove || [])].map((item) => asString(item).trim()).filter(Boolean);
  for (const tag of removeTags) {
    const entry = inspected.entries.find((item) => item.name === tag);
    if (entry && !OFFICE_METADATA_PARTS.includes(tag) && tag !== 'mimetype' && tag !== '[Content_Types].xml') {
      replacements.set(tag, null);
      continue;
    }
    let matched = false;
    for (const kind of ['core', 'app', 'meta']) {
      const part = loadPart(kind);
      if (part && hasElement(part.xml, resolveTag(part.xml, tag))) {
        part.xml = upsert(part.xml, resolveTag(part.xml, tag), [], anchorFor(kind, odf, part.xml));
        matched = true;
      }
    }
    if (!matched && !entry) warnings.push(`Tag "${tag}" tidak ditemukan di metadata yang dapat ditulis.`);
  }
  const customRemove = [...(payload?.customRemove || [])].map((item) => asString(item).trim()).filter(Boolean);
  if (customRemove.length || (payload?.custom || []).length) {
    if (odf) {
      const part = ensurePart('meta');
      let xml = part.xml;
      for (const key of customRemove) xml = customPropertyRemove(xml, key, true);
      for (const item of payload?.custom || []) {
        const key = asString(item?.key).trim();
        if (!key) continue;
        const value = asString(item?.value);
        const element = `<meta:user-defined meta:name="${escapeXml(key)}">${escapeXml(value)}</meta:user-defined>`;
        const pattern = new RegExp(`<meta:user-defined\\b[^>]*\\bmeta:name="${escapeRegExp(escapeXml(key))}"[^>]*>[\\s\\S]*?<\\/meta:user-defined>`, 'i');
        xml = pattern.test(xml) ? xml.replace(pattern, element) : xml.replace(/<\/office:meta\s*>/i, `${element}</office:meta>`);
      }
      part.xml = xml;
    } else {
      const entry = inspected.entries.find((item) => item.name === CUSTOM_PART);
      let xml = entry ? new TextDecoder().decode(entry.data) : CUSTOM_ROOT;
      for (const key of customRemove) xml = customPropertyRemove(xml, key, false);
      for (const item of payload?.custom || []) {
        const key = asString(item?.key).trim();
        if (!key) continue;
        if (!/^[A-Za-z_][\w.-]*(?::[A-Za-z_][\w.-]*)?$/.test(key)) {
          warnings.push(`Key kustom "${key}" tidak valid dan diabaikan.`);
          continue;
        }
        xml = customPropertyXml(xml, key, asString(item?.value));
      }
      replacements.set(CUSTOM_PART, strToU8(xml));
      updateRelationshipXml(inspected, replacements);
      updateContentTypes(inspected, replacements);
    }
  }
  for (const part of parts.values()) {
    if (part && part.xml !== part.root) replacements.set(part.name, strToU8(part.xml));
  }
  if (!replacements.size) throw new AppError('NO_CHANGES', 'Tidak ada metadata yang perlu ditulis.');
  report({ stage: 'Menulis metadata ke arsip Office…', pct: 40 });
  let blob;
  try {
    blob = await patchZip(bytes, replacements);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('WRITE_FAILED', 'Gagal menulis metadata Office.', error.message || String(error));
  }
  report({ stage: 'Memverifikasi hasil…', pct: 80 });
  const afterBytes = new Uint8Array(await blob.arrayBuffer());
  let preserved;
  try {
    preserved = await verifyZipPreserved(bytes, afterBytes, [...replacements.keys()]);
  } catch (error) {
    throw new AppError('VERIFY_FAILED', 'Arsip Office hasil tidak bisa diverifikasi.', error.message || String(error));
  }
  if (!preserved.ok) {
    throw new AppError('INTEGRITY_FAILED', 'Entri di luar metadata berubah saat menulis Office.', preserved.changed.join(', '));
  }
  const verified = await read(new File([afterBytes], `output.${subtype}`, {
    type: options?.mime || file?.type || meta.mime,
  }), { ...options, subtype });
  const finalWarnings = [...new Set([...warnings, ...verified.warnings])];
  for (const [id, value] of Object.entries(set)) {
    if (!supported.has(id)) continue;
    if (!fieldMatches(id, value, verified.fields[id], definitions)) {
      finalWarnings.push(`Field "${id}" tidak terbaca kembali persis seperti yang diminta.`);
    }
  }
  for (const id of remove) {
    if (supported.has(id) && asString(verified.fields[id]).trim()) {
      finalWarnings.push(`Field "${id}" belum sepenuhnya terhapus.`);
    }
  }
  return {
    blob,
    fields: verified.fields,
    custom: verified.custom,
    raw: verified.raw,
    info: verified.info,
    warnings: finalWarnings,
  };
}
export async function dispose() {}
export const fields = [...new Map(
  OFFICE_SUBTYPES.flatMap((subtype) => fieldsFor(subtype)).map((field) => [field.id, field]),
).values()];
export default { meta, sectionsFor, fieldsFor, fields, read, write, dispose };