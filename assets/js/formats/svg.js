/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — MeInsert Source-Available License v1.0 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import { t } from '../i18n/index.js';
import { AppError } from '../core/errors.js';
import { parseXml, NS, encodeXml } from '../core/office-xml.js';

const uri = 'http://www.w3.org/2000/svg';
const rdf = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
const mime = 'image/svg+xml';
const maxBytes = 8 * 1024 * 1024;
const decoder = new TextDecoder('utf-8', { fatal: true });
export const meta = { id: 'svg', engine: 'document', customTags: false, label: 'SVG', extensions: ['svg'], mime };
export const sections = [{ id: 'umum', title: 'SVG' }];
const definitions = [
  ['title', 'Judul', uri, 'title'],
  ['description', 'Deskripsi', uri, 'desc'],
  ['creator', 'Pembuat', NS.dc, 'creator'],
  ['rights', 'Hak cipta', NS.dc, 'rights'],
];
export const fields = definitions.map(([id, label, namespace, local]) => ({
  id, label, type: id === 'description' ? 'textarea' : 'text', section: 'umum',
  native: namespace === uri ? local : `dc:${local}`, maxLength: 2000,
}));

function inspect(source) {
  const doc = parseXml(source, 'SVG');
  if (doc.root.uri !== uri || doc.root.local !== 'svg') throw new AppError('CORRUPT_FILE', t('documents.svgRoot'));
  return doc;
}

function svgNode(doc, local) {
  return doc.findAll(uri, local).find((node) => node.parent === doc.root);
}
function descriptionNode(doc) {
  const metadata = svgNode(doc, 'metadata');
  return metadata ? doc.find(rdf, 'Description', metadata) : null;
}
function findField(doc, namespace, local) {
  if (namespace === uri) return svgNode(doc, local);
  const parent = descriptionNode(doc);
  return parent ? doc.find(namespace, local, parent) : null;
}

function resultFor(doc) {
  const values = {};
  const raw = [];
  const removableFields = [];
  for (const [id, , namespace, local] of definitions) {
    const node = findField(doc, namespace, local);
    const value = node && !node.children.some((child) => child.type === 'element') ? doc.value(node).trim() : '';
    values[id] = value;
    const candidates = doc.findAll(namespace, local);
    if (value && candidates.length === 1) removableFields.push(id);
    if (value) raw.push({ group: namespace === uri ? 'SVG' : 'Dublin Core', tag: namespace === uri ? local : `dc:${local}`, value });
  }
  return { fields: values, raw, custom: [], removableFields, info: { format: 'SVG' } };
}

async function readDocument(file) {
  if (file.size > maxBytes) throw new AppError('UNSUPPORTED', t('documents.svgLimit'));
  return inspect(decoder.decode(await file.arrayBuffer()));
}

export async function read(file) {
  return resultFor(await readDocument(file));
}

export async function write(file, payload, _options, report = () => {}) {
  if (payload.rawRemove?.length || payload.custom?.length || payload.customRemove?.length) {
    throw new AppError('UNSUPPORTED', t('documents.fieldsOnly'));
  }
  const doc = await readDocument(file);
  const remove = new Set(payload.remove || []);
  const rdfAdds = [];
  const rootAdds = [];
  for (const [id, , namespace, local] of definitions) {
    const set = Object.hasOwn(payload.set || {}, id);
    if (!set && !remove.has(id)) continue;
    const node = findField(doc, namespace, local);
    if (node?.children.some((child) => child.type === 'element')) throw new AppError('UNSUPPORTED', t('documents.svgStructured'));
    if (remove.has(id)) doc.remove(node);
    else if (node) doc.setValue(node, payload.set[id]);
    else if (namespace === uri) rootAdds.push(`<${local} xmlns="${uri}">${encodeXml(payload.set[id], 'SVG')}</${local}>`);
    else rdfAdds.push([local, payload.set[id]]);
  }
  if (rdfAdds.length) {
    const parent = descriptionNode(doc);
    const tags = rdfAdds.map(([local, value]) =>
      `<dc:${local} xmlns:dc="${NS.dc}">${encodeXml(value, 'SVG')}</dc:${local}>`).join('');
    if (parent) doc.insertRaw(parent, tags);
    else {
      const fragment = `<rdf:RDF xmlns:rdf="${rdf}"><rdf:Description>${tags}</rdf:Description></rdf:RDF>`;
      const metadata = svgNode(doc, 'metadata');
      if (metadata) doc.insertRaw(metadata, fragment);
      else rootAdds.push(`<metadata xmlns="${uri}">${fragment}</metadata>`);
    }
  }
  if (rootAdds.length) doc.insertRaw(doc.root, rootAdds.join(''));
  const output = doc.toString();
  const blob = new Blob([output], { type: mime });
  report({ stage: t('documents.svgVerify'), pct: 80 });
  return { ...await read(blob), blob };
}

export default { meta, sections, fields, read, write };
