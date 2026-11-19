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
    const found = parts.get(kind)?.get(tag);
    if (found) values.push(...found);
  }
  if (!values.length) return fieldId === 'keywords' ? [] : '';
  if (fieldId === 'keywords') {
    return odf ? values : asArray(values.join(', '));
  }
  if (fieldId === 'date' || fieldId === 'modified') return toDateInput(values[0]);
  return values.join(', ');
}

export async function read(file, options = {}) {
  const bytes = await toBytes(file);
  const inspected = await inspectZip(bytes);
  const subtype = inferSubtype(inspected, options, file);
  const odf = inspected.odf;
  const targets = FIELD_TARGETS[odf ? 'odf' : 'ooxml'];

  const parts = new Map();
  for (const kind of ['core', 'app', 'meta']) {
    const entry = inspected.entries.find((item) => item.name === PART_NAMES[kind]);
    parts.set(kind, entry ? inventory(new TextDecoder().decode(entry.data)) : new Map());
  }

  const fields = {};
  for (const id of new Set([...Object.keys(FIELD_TARGETS.ooxml), ...Object.keys(FIELD_TARGETS.odf)])) {
    fields[id] = fieldValue(id, targets, parts, odf);
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
      entryCount: inspected.entries.length,
    },
    warnings,
  };
}

function hasNamespace(xml, prefix) {
  return new RegExp(`xmlns:${escapeRegExp(prefix)}\\s*=`, 'i').test(xml);
}

function ensureNamespace(xml, prefix) {
  if (!prefix || hasNamespace(xml, prefix)) return xml;
  const match = /<[A-Za-z_][\w.-]*(?::[\w.-]+)?[^>]*?>/.exec(xml);
  if (!match) return xml;
  const index = match.index + match[0].length - 1;
  return `${xml.slice(0, index)} xmlns:${prefix}="urn:meinsert:custom"${xml.slice(index)}`;
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
  p.xml = upsert(p.xml, tag, values, anchorFor(kind, odf, p.xml));
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
  const removeTags = [
    ...(payload?.rawRemove || []),
    ...(payload?.customRemove || []),
  ].map((item) => asString(item).trim()).filter(Boolean);
  for (const tag of removeTags) {
    const entry = inspected.entries.find((item) => item.name === tag);
    if (entry && !OFFICE_METADATA_PARTS.includes(tag) && tag !== 'mimetype' && tag !== '[Content_Types].xml') {
      replacements.set(tag, null);
      continue;
    }
    let matched = false;
    for (const kind of ['core', 'app', 'meta']) {
      const part = loadPart(kind);
      if (part && hasElement(part.xml, tag)) {
        part.xml = upsert(part.xml, tag, [], anchorFor(kind, odf, part.xml));
        matched = true;
      }
    }
    if (!matched && !entry) warnings.push(`Tag "${tag}" tidak ditemukan di metadata yang dapat ditulis.`);
  }

  for (const item of payload?.custom || []) {
    const key = asString(item?.key).trim();
    if (!key) continue;
    if (!/^[A-Za-z_][\w.-]*(?::[A-Za-z_][\w.-]*)?$/.test(key)) {
      warnings.push(`Key kustom "${key}" tidak valid dan diabaikan.`);
      continue;
    }
    const kind = odf ? 'meta' : 'core';
    const part = ensurePart(kind);
    const prefix = key.includes(':') ? key.split(':')[0] : '';
    if (prefix && !hasNamespace(part.xml, prefix)) {
      part.xml = ensureNamespace(part.xml, prefix);
      warnings.push(`Tag kustom "${key}" memakai namespace "${prefix}" yang tidak dikenal; deklarasi placeholder ditambahkan.`);
    }
    const value = asString(item?.value);
    part.xml = upsert(part.xml, key, value ? [value] : [], anchorFor(kind, odf, part.xml));
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

// Generic form rendering/validation still reads `adapter.fields`; expose the
// union of all subtype fields so office files use the same path as other
// adapters (sections still come from `sectionsFor`/`fieldsFor`).
export const fields = [...new Map(
  OFFICE_SUBTYPES.flatMap((subtype) => fieldsFor(subtype)).map((field) => [field.id, field]),
).values()];
export default { meta, sectionsFor, fieldsFor, fields, read, write, dispose };
