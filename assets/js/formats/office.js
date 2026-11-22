/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — MeInsert Source-Available License v1.0 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import { asArray, asString, sameValue, toDateInput, toIsoDate } from '../core/tag-utils.js';
import { AppError } from '../core/errors.js';
import { inspectZip, OFFICE_METADATA_PARTS, patchZip, verifyZipPreserved } from '../core/office-zip.js';
import { strToU8 } from '../../vendor/fflate.mjs';
import { NS, parseXml, encodeXml } from '../core/office-xml.js';
import { validateOfficePackage, normalizePart } from '../core/office-package.js';
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
const T = (part, uri, local, preferred = '', extra = {}) => ({ part, uri, local, preferred, ...extra });
const DATE_ATTR = {
  uri: NS.xsi, local: 'type', prefix: 'xsi', valueUri: NS.dcterms, valuePrefix: 'dcterms', valueSuffix: 'W3CDTF',
};
const FIELD_TARGETS = {
  ooxml: {
    title: [T('core', NS.dc, 'title', 'dc')],
    creator: [T('core', NS.dc, 'creator', 'dc')],
    subject: [T('core', NS.dc, 'subject', 'dc')],
    keywords: [T('core', NS.cp, 'keywords', 'cp')],
    description: [T('core', NS.dc, 'description', 'dc')],
    date: [T('core', NS.dcterms, 'created', 'dcterms', { attribute: DATE_ATTR })],
    modified: [T('core', NS.dcterms, 'modified', 'dcterms', { attribute: DATE_ATTR })],
    lastModifiedBy: [T('core', NS.cp, 'lastModifiedBy', 'cp')],
    company: [T('app', NS.ep, 'Company')],
    manager: [T('app', NS.ep, 'Manager')],
    software: [T('app', NS.ep, 'Application')],
  },
  odf: {
    title: [T('meta', NS.dc, 'title', 'dc')],
    creator: [T('meta', NS.dc, 'creator', 'dc')],
    subject: [T('meta', NS.dc, 'subject', 'dc')],
    keywords: [T('meta', NS.meta, 'keyword', 'meta')],
    description: [T('meta', NS.dc, 'description', 'dc')],
    date: [T('meta', NS.meta, 'creation-date', 'meta')],
    modified: [T('meta', NS.dc, 'date', 'dc')],
    software: [T('meta', NS.meta, 'generator', 'meta')],
  },
};
const MAPPED_LOCALS = new Set(
  [...Object.values(FIELD_TARGETS.ooxml), ...Object.values(FIELD_TARGETS.odf)]
    .flat().map((target) => target.local.toLowerCase()),
);
const CONTAINER_LOCALS = new Set([
  'coreproperties', 'document-meta', 'meta', 'properties', 'vector', 'variant', 'customproperties',
]);
const STANDARD_LOCALS = new Set([
  'category', 'contentstatus', 'version', 'revision', 'lastprinted', 'identifier', 'language',
  'keywords', 'title', 'creator', 'subject', 'description', 'created', 'modified', 'lastmodifiedby',
  'company', 'manager', 'application', 'pages', 'words', 'characters', 'paragraphs', 'lines',
  'totaltime', 'template', 'lastsavedby', 'revisionnumber', 'numberofcharacterswithspaces',
  'notes', 'hiddenpages', 'hiddenslides', 'presentationformat', 'coreproperties', 'properties',
  'vector', 'variant', 'customproperties', 'document-meta', 'meta', 'initial-creator',
  'editing-cycles', 'editing-duration', 'date-string', 'user-defined', 'document-statistic', 'generator',
  'date', 'creation-date', 'keyword', 'property', 'lpwstr',
]);
const PART_NAMES = { core: 'docProps/core.xml', app: 'docProps/app.xml', meta: 'meta.xml' };
const PART_TYPES = {
  core: 'application/vnd.openxmlformats-package.core-properties+xml',
  app: 'application/vnd.openxmlformats-officedocument.extended-properties+xml',
  custom: 'application/vnd.openxmlformats-officedocument.custom-properties+xml',
};
const PART_RELS = {
  core: 'http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties',
  app: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties',
  custom: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/custom-properties',
};
const CUSTOM_PART = 'docProps/custom.xml';
const CUSTOM_FMTID = '{D5CDD505-2E9C-101B-9397-08002B2CF9AE}';
const FRESH_ROOTS = {
  core: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
    + `<cp:coreProperties xmlns:cp="${NS.cp}" xmlns:dc="${NS.dc}" xmlns:dcterms="${NS.dcterms}"`
    + ` xmlns:xsi="${NS.xsi}"></cp:coreProperties>`,
  app: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
    + `<Properties xmlns="${NS.ep}" xmlns:vt="${NS.vt}"></Properties>`,
  meta: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
    + `<office:document-meta xmlns:office="${NS.office}" xmlns:dc="${NS.dc}" xmlns:meta="${NS.meta}">`
    + '<office:meta></office:meta></office:document-meta>',
  custom: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
    + `<Properties xmlns="${NS.custom}" xmlns:vt="${NS.vt}"></Properties>`,
};
async function toBytes(input) {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (input && typeof input.arrayBuffer === 'function') return new Uint8Array(await input.arrayBuffer());
  if (Array.isArray(input)) return new Uint8Array(input);
  throw new AppError('CORRUPT_FILE', 'Dokumen Office tidak bisa dibaca.');
}
const decoder = new TextDecoder();
function partText(inspected, name) {
  const entry = inspected.entries.find((item) => item.name === name);
  return entry ? decoder.decode(entry.data) : '';
}
function localName(qualified) {
  const at = String(qualified || '').indexOf(':');
  return (at < 0 ? qualified : qualified.slice(at + 1)).toLowerCase();
}
function attrValue(doc, node, local, uri = '') {
  const attr = node?.attrs.find((item) => {
    const at = item.name.indexOf(':');
    const prefix = at < 0 ? '' : item.name.slice(0, at);
    return item.name.slice(at + 1) === local && (!uri || (node.ns[prefix] || '') === uri);
  });
  return attr ? attr.value.trim() : '';
}
function parsePart(text, label) {
  return text ? parseXml(text, label) : null;
}
function validatedPackage(inspected) {
  const result = validateOfficePackage(inspected);
  if (!result.packageValid) {
    throw new AppError(
      'NOT_OFFICE_PACKAGE',
      'Arsip ini bukan paket Office yang valid.',
      result.findings.join('; '),
    );
  }
  return result;
}
function inferSubtype(validated, inspected, options, file) {
  if (validated?.subtype && OFFICE_SUBTYPES.includes(validated.subtype)) return validated.subtype;
  if (inspected.odf) {
    const mimetype = String(inspected.mimetype || '');
    if (/spreadsheet/i.test(mimetype)) return 'ods';
    if (/presentation/i.test(mimetype)) return 'odp';
    return 'odt';
  }
  const extension = String(options?.extension || (file?.name || '').split('.').pop() || '').toLowerCase();
  return OFFICE_SUBTYPES.includes(extension) ? extension : 'docx';
}
function fieldValue(id, targets, docs, odf) {
  const values = [];
  for (const target of targets[id] || []) {
    values.push(...(docs.get(target.part)?.findAll(target.uri, target.local)
      .map((node) => docs.get(target.part).value(node).trim()) || []));
  }
  if (!values.length) return id === 'keywords' ? [] : '';
  if (id === 'keywords') return odf ? values : asArray(values.join(', '));
  if (id === 'date' || id === 'modified') return toDateInput(values[0]);
  return values.join(', ');
}
function nativeCustomEntries(inspected, odf) {
  const found = new Map();
  if (!odf) {
    const doc = parsePart(partText(inspected, CUSTOM_PART), CUSTOM_PART);
    for (const node of doc?.findAll(NS.custom, 'property') || []) {
      const name = attrValue(doc, node, 'name');
      if (!name) continue;
      const valueNode = node.children.find((child) => child.type === 'element' && (child.ns[child.prefix] || '') === NS.vt);
      const value = valueNode ? doc.value(valueNode).trim() : '';
      if (value) found.set(name, value);
    }
  } else {
    const doc = parsePart(partText(inspected, 'meta.xml'), 'meta.xml');
    for (const node of doc?.findAll(NS.meta, 'user-defined') || []) {
      const name = attrValue(doc, node, 'name', NS.meta);
      const value = doc.value(node).trim();
      if (name && value) found.set(name, value);
    }
  }
  return found;
}
function positiveCount(value) {
  const number = Number.parseInt(String(value || '').replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(number) && number > 0 ? number : null;
}
function officeSummary(fields, docs, subtype) {
  const odf = ODF_SUBTYPES.has(String(subtype || '').toLowerCase());
  const app = docs.get('app');
  const meta = docs.get('meta');
  const readable = (value) => (typeof value === 'string' ? value.trim() : String(value || '').trim());
  const first = (doc, uri, local) => doc?.findAll(uri, local)[0] ? doc.value(doc.findAll(uri, local)[0]).trim() : '';
  const statistic = meta?.findAll(NS.meta, 'document-statistic')[0] || null;
  const metaAttr = (name) => (statistic ? attrValue(meta, statistic, name, NS.meta) : '');
  return {
    title: readable(fields.title),
    creator: readable(fields.creator),
    subject: readable(fields.subject),
    company: readable(fields.company),
    application: readable(fields.software),
    modified: readable(fields.modified),
    pages: odf ? positiveCount(metaAttr('page-count')) : positiveCount(first(app, NS.ep, 'Pages')),
    words: odf ? positiveCount(metaAttr('word-count')) : positiveCount(first(app, NS.ep, 'Words')),
    slides: odf ? null : positiveCount(first(app, NS.ep, 'Slides')),
    sheets: odf ? null : positiveCount(first(app, NS.ep, 'Sheets')),
  };
}
const PREVIEW_LIMITS = { items: 6, itemChars: 120, totalChars: 280 };
function previewText(doc, uri, local) {
  if (!doc) return [];
  const out = [];
  for (const node of doc.findAll(uri, local)) {
    const value = doc.value(node).replace(/\s+/g, ' ').trim();
    if (value) out.push(value.slice(0, PREVIEW_LIMITS.itemChars));
    if (out.length >= PREVIEW_LIMITS.items) break;
  }
  return out;
}
function contentPreview(inspected, subtype) {
  const kind = String(subtype || '').toLowerCase();
  const groups = [];
  const docFor = (name) => {
    const text = partText(inspected, name);
    if (!text || text.length > 2 * 1024 * 1024) return null;
    try { return parseXml(text, name); } catch { return null; }
  };
  if (kind.startsWith('doc')) {
    const values = previewText(docFor('word/document.xml'), NS.w, 't');
    if (values.length) groups.push({ key: 'paragraphs', values });
  } else if (kind.startsWith('xls') || kind === 'ods') {
    const workbook = docFor('xl/workbook.xml');
    const sheets = previewText(workbook, NS.s, 'sheet').length
      ? previewText(workbook, NS.s, 'sheet')
      : (workbook?.findAll(NS.s, 'sheet') || []).map((node) => attrValue(workbook, node, 'name')).filter(Boolean);
    if (kind === 'ods') {
      const content = docFor('content.xml');
      sheets.push(...(content?.findAll(NS.table, 'table') || []).map((node) => attrValue(content, node, 'name', NS.table)).filter(Boolean));
    }
    if (sheets.length) groups.push({ key: 'sheets', values: sheets.slice(0, PREVIEW_LIMITS.items) });
    const strings = previewText(docFor('xl/sharedStrings.xml'), NS.s, 't');
    if (strings.length) groups.push({ key: 'cells', values: strings });
  } else if (kind.startsWith('ppt') || kind === 'odp') {
    const slides = previewText(docFor('ppt/slides/slide1.xml'), NS.a, 't');
    if (kind === 'odp') slides.push(...previewText(docFor('content.xml'), NS.text, 'p'));
    if (slides.length) groups.push({ key: 'slides', values: slides });
  } else if (kind === 'odt') {
    const values = previewText(docFor('content.xml'), NS.text, 'p');
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
export async function read(file, options = {}) {
  const bytes = await toBytes(file);
  const inspected = await inspectZip(bytes);
  const validated = validatedPackage(inspected);
  const subtype = inferSubtype(validated, inspected, options, file);
  const odf = inspected.odf;
  const targets = FIELD_TARGETS[odf ? 'odf' : 'ooxml'];
  const docs = new Map();
  for (const kind of ['core', 'app', 'meta']) {
    const label = PART_NAMES[kind];
    const doc = parsePart(partText(inspected, label), label);
    if (doc) docs.set(kind, doc);
  }
  const fields = {};
  for (const id of new Set([...Object.keys(FIELD_TARGETS.ooxml), ...Object.keys(FIELD_TARGETS.odf)])) {
    fields[id] = fieldValue(id, targets, docs, odf);
  }
  const raw = [];
  const custom = [];
  for (const [group, doc] of docs) {
    for (const node of doc.nodes) {
      if (node.type !== 'element' || node === doc.root) continue;
      if (CONTAINER_LOCALS.has(localName(node.name))) continue;
      const value = doc.value(node).trim();
      if (!value) continue;
      const tag = node.name;
      raw.push({ group, tag, value });
      const local = localName(tag);
      if (!MAPPED_LOCALS.has(local) && !STANDARD_LOCALS.has(local)) custom.push({ key: tag, value });
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
      macros: inspected.macros || validated.macro,
      valid: inspected.valid,
      packageValid: validated.packageValid,
      entryCount: inspected.entries.length,
      ...officeSummary(fields, docs, subtype),
      ...contentPreview(inspected, subtype),
    },
    warnings,
  };
}
function setTargetValues(doc, target, values) {
  const nodes = doc.findAll(target.uri, target.local);
  for (let index = 0; index < values.length; index += 1) {
    if (index < nodes.length) {
      doc.setValue(nodes[index], values[index]);
    } else {
      const attributes = [];
      if (target.attribute?.uri === NS.xsi) {
        const typePrefix = doc.prefixFor(doc.root, NS.dcterms, 'dcterms').prefix;
        attributes.push({ uri: NS.xsi, prefix: 'xsi', local: 'type', value: `${typePrefix}:${target.attribute.valueSuffix}` });
      }
      doc.insert(doc.root, {
        uri: target.uri, local: target.local, value: values[index],
        preferredPrefix: target.preferred, attributes,
      });
    }
  }
  for (let index = values.length; index < nodes.length; index += 1) doc.remove(nodes[index]);
}
function fieldInput(id, value, odf) {
  if (id === 'keywords') {
    const list = asArray(value);
    return odf ? list : [list.join(', ')];
  }
  if (id === 'date' || id === 'modified') {
    if (asString(value).trim() && !toDateInput(value)) {
      throw new AppError('INVALID_DATE', `Nilai tanggal tidak valid untuk field "${id}".`);
    }
    const iso = toIsoDate(value);
    return iso ? [iso] : [];
  }
  const text = asString(value);
  return text ? [text] : [];
}
function currentText(inspected, replacements, name) {
  if (replacements.has(name)) {
    const value = replacements.get(name);
    return value ? new TextDecoder().decode(value) : '';
  }
  return partText(inspected, name);
}
function registerPart(inspected, replacements, key) {
  const name = PART_NAMES[key] || CUSTOM_PART;
  if (!name) return;
  const type = PART_TYPES[key];
  const relType = PART_RELS[key];
  const ctDoc = parsePart(currentText(inspected, replacements, '[Content_Types].xml'), '[Content_Types].xml');
  if (ctDoc) {
    const exists = ctDoc.findAll(NS.ct, 'Override')
      .some((node) => normalizePart(attrValue(ctDoc, node, 'PartName')) === name);
    if (!exists) {
      ctDoc.insert(ctDoc.root, {
        uri: NS.ct, local: 'Override',
        attributes: [{ name: 'PartName', value: `/${name}` }, { name: 'ContentType', value: type }],
      });
      replacements.set('[Content_Types].xml', strToU8(ctDoc.toString()));
    }
  }
  const relName = '_rels/.rels';
  const relSource = currentText(inspected, replacements, relName)
    || '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
      + `<Relationships xmlns="${NS.rels}"></Relationships>`;
  const relDoc = parsePart(relSource, relName);
  if (!relDoc) return;
  const rels = relDoc.findAll(NS.rels, 'Relationship');
  const exists = rels.some((node) => normalizePart(attrValue(relDoc, node, 'Target')) === name);
  if (exists) return;
  const ids = rels.map((node) => attrValue(relDoc, node, 'Id')).map((id) => /^rId(\d+)$/i.exec(id)).filter(Boolean);
  const next = Math.max(0, ...ids.map((match) => Number(match[1]))) + 1;
  relDoc.insert(relDoc.root, {
    uri: NS.rels, local: 'Relationship',
    attributes: [
      { name: 'Id', value: `rId${next}` },
      { name: 'Type', value: relType },
      { name: 'Target', value: name },
    ],
  });
  replacements.set(relName, strToU8(relDoc.toString()));
}
function registerOdfPart(inspected, replacements, name) {
  const label = 'META-INF/manifest.xml';
  const doc = parsePart(currentText(inspected, replacements, label), label);
  if (!doc) return;
  const exists = doc.findAll(NS.manifest, 'file-entry')
    .some((node) => attrValue(doc, node, 'full-path', NS.manifest) === name);
  if (exists) return;
  doc.insertRaw(doc.root,
    `<manifest:file-entry manifest:full-path="${encodeXml(name)}" manifest:media-type="text/xml"/>`);
  replacements.set(label, strToU8(doc.toString()));
}
function customPropertyFragment(doc, key, value) {
  const ids = doc.findAll(NS.custom, 'property')
    .map((node) => Number.parseInt(attrValue(doc, node, 'pid'), 10))
    .filter(Number.isFinite);
  const pid = Math.max(1, ...ids) + 1;
  return `<property fmtid="${CUSTOM_FMTID}" pid="${pid}" name="${encodeXml(key)}">`
    + `<vt:lpwstr>${encodeXml(value)}</vt:lpwstr></property>`;
}
function setValueOnCustom(doc, key, value) {
  const property = doc.findAll(NS.custom, 'property')
    .find((node) => attrValue(doc, node, 'name') === key);
  if (property) {
    const valueNode = property.children.find((child) => child.type === 'element' && (child.ns[child.prefix] || '') === NS.vt);
    if (valueNode) doc.setValue(valueNode, value);
    else doc.insertRaw(property, `<vt:lpwstr>${encodeXml(value)}</vt:lpwstr>`);
    return;
  }
  doc.insertRaw(doc.root, customPropertyFragment(doc, key, value));
}
function removeCustom(doc, key, odf) {
  if (odf) {
    for (const node of doc.findAll(NS.meta, 'user-defined')) {
      if (attrValue(doc, node, 'name', NS.meta) === key) doc.remove(node);
    }
  } else {
    for (const node of doc.findAll(NS.custom, 'property')) {
      if (attrValue(doc, node, 'name') === key) doc.remove(node);
    }
  }
}
function customKeyIsValid(key) {
  return /^[A-Za-z_][\w.-]*(?::[A-Za-z_][\w.-]*)?$/.test(key);
}
export async function write(file, payload, options = {}, report = () => {}) {
  const bytes = await toBytes(file);
  const inspected = await inspectZip(bytes);
  const validated = validatedPackage(inspected);
  const subtype = inferSubtype(validated, inspected, options, file);
  const odf = inspected.odf;
  const targets = FIELD_TARGETS[odf ? 'odf' : 'ooxml'];
  const definitions = fieldsFor(subtype);
  const supported = new Set(Object.keys(targets));
  const set = payload?.set || {};
  const remove = new Set(payload?.remove || []);
  const warnings = [];
  if (inspected.signed) warnings.push(SIGNED_WARNING);
  if (inspected.macros || validated.macro) warnings.push(MACRO_WARNING);
  const parts = new Map();
  const loadPart = (kind) => {
    if (parts.has(kind)) return parts.get(kind);
    const name = PART_NAMES[kind];
    const text = partText(inspected, name);
    const part = text ? { name, doc: parsePart(text, name), rootText: text } : null;
    parts.set(kind, part);
    return part;
  };
  const ensurePart = (kind) => {
    const existing = loadPart(kind);
    if (existing?.doc) return existing;
    const rootText = FRESH_ROOTS[kind];
    const part = { name: PART_NAMES[kind], doc: parsePart(rootText, PART_NAMES[kind]), rootText };
    parts.set(kind, part);
    return part;
  };
  for (const [id, value] of Object.entries(set)) {
    if (!supported.has(id)) {
      warnings.push(`Field "${id}" tidak tersedia untuk format ${subtype.toUpperCase()} dan diabaikan.`);
      continue;
    }
    const values = fieldInput(id, value, odf);
    for (const target of targets[id]) setTargetValues(ensurePart(target.part).doc, target, values);
  }
  for (const id of remove) {
    if (!supported.has(id)) {
      warnings.push(`Field "${id}" tidak tersedia untuk format ${subtype.toUpperCase()} dan diabaikan.`);
      continue;
    }
    for (const target of targets[id]) {
      const part = loadPart(target.part);
      if (part?.doc) for (const node of part.doc.findAll(target.uri, target.local)) part.doc.remove(node);
    }
  }
  const replacements = new Map();
  for (const kind of ['core', 'app', 'meta']) loadPart(kind);
  for (const tag of (payload?.rawRemove || []).map((item) => asString(item).trim()).filter(Boolean)) {
    const entry = inspected.entries.find((item) => item.name === tag);
    if (entry && !OFFICE_METADATA_PARTS.includes(tag) && tag !== 'mimetype' && tag !== '[Content_Types].xml') {
      replacements.set(tag, null);
      continue;
    }
    let matched = false;
    for (const part of parts.values()) {
      if (!part?.doc) continue;
      for (const node of part.doc.nodes) {
        if (node.type === 'element' && node.name.toLowerCase() === tag.toLowerCase()) {
          part.doc.remove(node);
          matched = true;
        }
      }
    }
    if (!matched && !entry) warnings.push(`Tag "${tag}" tidak ditemukan di metadata yang dapat ditulis.`);
  }
  const customRemove = (payload?.customRemove || []).map((item) => asString(item).trim()).filter(Boolean);
  const customSet = (payload?.custom || []).filter((item) => {
    const key = asString(item?.key).trim();
    if (!key || customKeyIsValid(key)) return Boolean(key);
    warnings.push(`Key kustom "${key}" tidak valid dan diabaikan.`);
    return false;
  });
  if (customRemove.length || customSet.length) {
    if (odf) {
      const part = ensurePart('meta');
      for (const key of customRemove) removeCustom(part.doc, key, true);
      for (const item of customSet) {
        const key = asString(item.key).trim();
        const value = asString(item.value);
        const existing = part.doc.findAll(NS.meta, 'user-defined')
          .find((node) => attrValue(part.doc, node, 'name', NS.meta) === key);
        if (existing) {
          part.doc.setValue(existing, value);
        } else {
          part.doc.insertRaw(part.doc.root,
            `<meta:user-defined meta:name="${encodeXml(key)}">${encodeXml(value)}</meta:user-defined>`);
        }
      }
    } else {
      const text = partText(inspected, CUSTOM_PART) || FRESH_ROOTS.custom;
      const doc = parsePart(text, CUSTOM_PART);
      for (const key of customRemove) removeCustom(doc, key, false);
      for (const item of customSet) setValueOnCustom(doc, asString(item.key).trim(), asString(item.value));
      replacements.set(CUSTOM_PART, strToU8(doc.toString()));
      registerPart(inspected, replacements, 'custom');
    }
  }
  for (const [kind, part] of parts) {
    if (part?.doc?.hasEdits()) {
      replacements.set(part.name, strToU8(part.doc.toString()));
      if (!inspected.entries.some((entry) => entry.name === part.name)) {
        if (odf && kind === 'meta') registerOdfPart(inspected, replacements, part.name);
        else if (!odf && kind !== 'meta') registerPart(inspected, replacements, kind);
      }
    }
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
    blob, fields: verified.fields, custom: verified.custom, raw: verified.raw,
    info: verified.info, warnings: finalWarnings,
  };
}
function fieldMatches(id, expected, actual, definitions) {
  const definition = definitions.find((field) => field.id === id);
  if (definition?.type === 'tags') return asArray(expected).join(', ') === asArray(actual).join(', ');
  if (definition?.type === 'date') return toDateInput(expected) === toDateInput(actual);
  return sameValue(expected, actual);
}
export async function dispose() {}
export const fields = [...new Map(
  OFFICE_SUBTYPES.flatMap((subtype) => fieldsFor(subtype)).map((field) => [field.id, field]),
).values()];
export default { meta, sectionsFor, fieldsFor, fields, read, write, dispose };