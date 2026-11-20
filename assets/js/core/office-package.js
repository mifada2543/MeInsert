/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import { AppError } from './errors.js';
import { strFromU8 } from '../../vendor/fflate.mjs';
import { NS, parseXml } from './office-xml.js';
const MAIN_ROOTS = [
  { family: 'word', uri: NS.w, local: 'document' },
  { family: 'word', uri: NS.wStrict, local: 'document' },
  { family: 'excel', uri: NS.s, local: 'workbook' },
  { family: 'excel', uri: NS.sStrict, local: 'workbook' },
  { family: 'powerpoint', uri: NS.p, local: 'presentation' },
  { family: 'powerpoint', uri: NS.pStrict, local: 'presentation' },
];
const CONTENT_PATTERNS = {
  word: /wordprocessingml\.document\.main\+xml$/i,
  excel: /spreadsheetml\.sheet\.main\+xml$/i,
  powerpoint: /presentationml\.presentation\.main\+xml$/i,
};
const MACRO_CONTENT_PATTERNS = {
  word: /word\.document\.macroenabled\.main\+xml$/i,
  excel: /excel\.sheet\.macroenabled\.main\+xml$/i,
  powerpoint: /powerpoint\.presentation\.macroenabled\.main\+xml$/i,
};
const ODF_MIMES = {
  'application/vnd.oasis.opendocument.text': 'odt',
  'application/vnd.oasis.opendocument.spreadsheet': 'ods',
  'application/vnd.oasis.opendocument.presentation': 'odp',
};
const ODF_TEMPLATE_MIMES = new Set([
  'application/vnd.oasis.opendocument.text-template',
  'application/vnd.oasis.opendocument.spreadsheet-template',
  'application/vnd.oasis.opendocument.presentation-template',
]);
const ENCRYPTED_MIMES = /-encrypted$/i;

function entryText(inspected, name) {
  const entry = inspected.entries.find((item) => item.name === name);
  return entry ? strFromU8(entry.data) : '';
}
function hasEntry(inspected, name) {
  return inspected.entries.some((item) => item.name === name);
}
function safeParse(text, label, findings) {
  try {
    return parseXml(text, label);
  } catch (error) {
    findings.push(`${label}: XML tidak valid (${error.message || error}).`);
    return null;
  }
}
function normalizePart(target) {
  const value = String(target || '').trim();
  if (!value || /^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith('//')
      || value.includes('\\') || value.includes('?') || value.includes('#')
      || value.includes('\u0000')) return null;
  const out = [];
  for (const segment of value.split('/')) {
    if (!segment || segment === '.') continue;
    if (segment === '..') {
      if (!out.length) return null;
      out.pop();
      continue;
    }
    out.push(segment);
  }
  return out.join('/') || null;
}
function nsAttr(doc, node, local, uri) {
  const attr = node?.attrs.find((item) => {
    const at = item.name.indexOf(':');
    const prefix = at < 0 ? '' : item.name.slice(0, at);
    return item.name.slice(at + 1) === local && (node.ns[prefix] || '') === uri;
  });
  return attr ? attr.value.trim() : '';
}
function contentTypesFor(doc) {
  const defaults = new Map();
  const overrides = new Map();
  for (const node of doc.findAll(NS.ct, 'Default')) {
    const extension = nsAttr(doc, node, 'Extension', '') || node.attrs.find((a) => a.name === 'Extension')?.value;
    const type = nsAttr(doc, node, 'ContentType', '') || node.attrs.find((a) => a.name === 'ContentType')?.value;
    if (extension) defaults.set(extension.toLowerCase(), String(type || '').trim());
  }
  for (const node of doc.findAll(NS.ct, 'Override')) {
    const part = nsAttr(doc, node, 'PartName', '') || node.attrs.find((a) => a.name === 'PartName')?.value;
    const type = nsAttr(doc, node, 'ContentType', '') || node.attrs.find((a) => a.name === 'ContentType')?.value;
    if (part) overrides.set(normalizePart(part) || String(part), String(type || '').trim());
  }
  return { defaults, overrides };
}
function contentTypeOf(types, name) {
  if (types.overrides.has(name)) return types.overrides.get(name);
  const extension = name.split('.').pop()?.toLowerCase();
  return types.defaults.get(extension) || '';
}
function validateRelationships(doc, label, findings) {
  const relationships = [];
  const ids = new Set();
  if (!doc || doc.root.local !== 'Relationships' || doc.root.uri !== NS.rels) {
    findings.push(`${label}: akar Relationships tidak ditemukan atau namespace salah.`);
    return relationships;
  }
  for (const node of doc.findAll(NS.rels, 'Relationship', doc.root)) {
    const id = nsAttr(doc, node, 'Id', '') || node.attrs.find((a) => a.name === 'Id')?.value || '';
    const type = nsAttr(doc, node, 'Type', '') || node.attrs.find((a) => a.name === 'Type')?.value || '';
    const target = nsAttr(doc, node, 'Target', '') || node.attrs.find((a) => a.name === 'Target')?.value || '';
    const mode = nsAttr(doc, node, 'TargetMode', '') || node.attrs.find((a) => a.name === 'TargetMode')?.value || '';
    if (!id || ids.has(id)) findings.push(`${label}: Id relationship duplikat atau kosong (${id || '-'}).`);
    ids.add(id);
    if (/^external$/i.test(mode)) {
      findings.push(`${label}: relationship eksternal tidak diizinkan (${id || '-'}).`);
      continue;
    }
    const normalized = normalizePart(target);
    if (!normalized) findings.push(`${label}: target relationship tidak aman (${target || '-'}).`);
    relationships.push({ id, type, target, normalized });
  }
  return relationships;
}
function validateOoxml(inspected, findings) {
  const typesDoc = safeParse(entryText(inspected, '[Content_Types].xml'), '[Content_Types].xml', findings);
  if (typesDoc && (typesDoc.root.local !== 'Types' || typesDoc.root.uri !== NS.ct)) {
    findings.push('[Content_Types].xml: akar Types tidak ditemukan atau namespace salah.');
  }
  const relsDoc = safeParse(entryText(inspected, '_rels/.rels'), '_rels/.rels', findings);
  const relationships = validateRelationships(relsDoc, '_rels/.rels', findings);
  const types = typesDoc && typesDoc.root.local === 'Types' ? contentTypesFor(typesDoc) : { defaults: new Map(), overrides: new Map() };
  for (const [part, type] of types.overrides) {
    if (!normalizePart(part)) findings.push(`[Content_Types].xml: PartName tidak aman (${part}).`);
    if (!type) findings.push(`[Content_Types].xml: ContentType kosong untuk ${part}.`);
  }
  const officeRels = relationships.filter((rel) => /\/officeDocument$/i.test(rel.type));
  if (officeRels.length !== 1) {
    findings.push(officeRels.length ? 'OOXML: lebih dari satu relationship officeDocument.' : 'OOXML: relationship officeDocument tidak ditemukan.');
    return { subtype: null, macro: inspected.macros, mainPart: null };
  }
  const mainPart = officeRels[0].normalized;
  if (!mainPart || !hasEntry(inspected, mainPart)) {
    findings.push(`OOXML: part dokumen utama tidak ditemukan (${officeRels[0].target || '-'}).`);
    return { subtype: null, macro: inspected.macros, mainPart };
  }
  const mainDoc = safeParse(entryText(inspected, mainPart), mainPart, findings);
  if (!mainDoc) return { subtype: null, macro: inspected.macros, mainPart };
  const root = MAIN_ROOTS.find((item) => item.uri === mainDoc.root.uri && item.local === mainDoc.root.local);
  if (!root) {
    findings.push(`${mainPart}: akar dokumen tidak dikenali (${mainDoc.root.name}, NS ${mainDoc.root.uri || 'kosong'}).`);
    return { subtype: null, macro: inspected.macros, mainPart };
  }
  const declaredType = contentTypeOf(types, mainPart);
  const macro = inspected.macros || /macroenabled/i.test(declaredType)
    || /macroenabled/i.test(officeRels[0].type)
    || inspected.entries.some((entry) => /(^|\/)vbaProject\.bin$/i.test(entry.name));
  const typeMatches = CONTENT_PATTERNS[root.family].test(declaredType)
    || (macro && MACRO_CONTENT_PATTERNS[root.family].test(declaredType));
  if (!typeMatches) {
    findings.push(`${mainPart}: content type tidak sesuai (${declaredType || 'tidak ada'}).`);
  }
  const subtype = root.family === 'word' ? (macro ? 'docm' : 'docx')
    : root.family === 'excel' ? (macro ? 'xlsm' : 'xlsx')
      : (macro ? 'pptm' : 'pptx');
  // A relationship without its part, or a part without its relationship, is an
  // ambiguous package: never accept it just because a filename matches.
  for (const rel of relationships) {
    if (/\/metadata\/core-properties$/i.test(rel.type) || /\/extended-properties$/i.test(rel.type)
        || /\/custom-properties$/i.test(rel.type)) {
      if (rel.normalized && !hasEntry(inspected, rel.normalized)) {
        findings.push(`OOXML: relationship "${rel.id}" menunjuk ke part yang tidak ada (${rel.target}).`);
      }
    }
  }
  return { subtype, macro, mainPart, root: root.family };
}
function validateOdf(inspected, findings) {
  const mimetype = String(inspected.mimetype || '').trim();
  if (ENCRYPTED_MIMES.test(mimetype)) {
    throw new AppError('ENCRYPTED_OFFICE', 'Dokumen ODF terenkripsi. Hapus proteksi terlebih dahulu, lalu coba lagi.');
  }
  const manifestDoc = safeParse(entryText(inspected, 'META-INF/manifest.xml'), 'META-INF/manifest.xml', findings);
  if (manifestDoc && (manifestDoc.root.local !== 'manifest' || manifestDoc.root.uri !== NS.manifest)) {
    findings.push('META-INF/manifest.xml: akar manifest tidak ditemukan atau namespace salah.');
  }
  if (manifestDoc) {
    if (manifestDoc.nodes.some((node) => node.local === 'encryption-data')) {
      throw new AppError('ENCRYPTED_OFFICE', 'Dokumen ODF terenkripsi. Hapus proteksi terlebih dahulu, lalu coba lagi.');
    }
    const entries = manifestDoc.findAll(NS.manifest, 'file-entry');
    const rootEntry = entries.find((node) => nsAttr(manifestDoc, node, 'full-path', NS.manifest) === '/');
    if (!rootEntry) findings.push('ODF: file-entry untuk "/" tidak ditemukan di manifest.');
    else {
      const declared = nsAttr(manifestDoc, rootEntry, 'media-type', NS.manifest);
      if (declared && declared !== mimetype) {
        findings.push(`ODF: media-type manifest (${declared}) tidak cocok dengan mimetype (${mimetype}).`);
      }
    }
    const names = new Set(inspected.entries.map((entry) => entry.name));
    for (const node of entries) {
      const path = nsAttr(manifestDoc, node, 'full-path', NS.manifest);
      if (!path || path === '/' || path.endsWith('/')) continue;
      const normalized = normalizePart(path);
      if (!normalized || !names.has(normalized)) {
        findings.push(`ODF: manifest menyebut part yang tidak ada (${path}).`);
      }
    }
  }
  if (!hasEntry(inspected, 'content.xml')) findings.push('ODF: content.xml tidak ditemukan.');
  const contentDoc = safeParse(entryText(inspected, 'content.xml'), 'content.xml', findings);
  if (contentDoc && (contentDoc.root.local !== 'document-content' || contentDoc.root.uri !== NS.office)) {
    findings.push('ODF: content.xml memiliki akar atau namespace yang tidak dikenali.');
  }
  const declared = contentDoc ? nsAttr(contentDoc, contentDoc.root, 'mimetype', NS.office) : '';
  if (declared && declared !== mimetype) findings.push('ODF: atribut office:mimetype tidak cocok dengan entri mimetype.');
  const subtype = ODF_MIMES[mimetype]
    || (ODF_TEMPLATE_MIMES.has(mimetype)
      ? (/spreadsheet/.test(mimetype) ? 'ods' : /presentation/.test(mimetype) ? 'odp' : 'odt')
      : null);
  if (!subtype) findings.push(`ODF: mimetype tidak dikenali (${mimetype || 'kosong'}).`);
  return { subtype, macro: false, mainPart: 'content.xml' };
}

/**
 * Return a validated subtype plus findings. Callers must convert findings into
 * a hard failure; a package with findings is never an editable Office file.
 */
export function validateOfficePackage(inspected) {
  const findings = [];
  if (!inspected) return { subtype: null, findings: ['Paket tidak terbaca.'], packageValid: false };
  if (inspected.zip64) findings.push('ZIP64 tidak didukung untuk dokumen Office.');
  if (inspected.prefix && inspected.prefix > 0 && !inspected.odf) {
    // A prefixed OOXML archive is legal (self-extracting wrappers exist); the
    // central directory already resolved it, so this is informational only.
  }
  const skipped = new Set(inspected.previewSkipped || []);
  if (inspected.findings?.length) findings.push(...inspected.findings.filter((item) => !skipped.has(item)));
  for (const name of ['docProps/core.xml', 'docProps/app.xml', 'docProps/custom.xml', 'meta.xml']) {
    if (hasEntry(inspected, name)) safeParse(entryText(inspected, name), name, findings);
  }
  const result = inspected.odf ? validateOdf(inspected, findings) : validateOoxml(inspected, findings);
  return {
    ...result,
    findings,
    packageValid: findings.length === 0,
  };
}
export { normalizePart };
export default { validateOfficePackage, normalizePart };
