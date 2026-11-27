/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — MeInsert Source-Available License v1.0 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import { t } from '../i18n/index.js';
import { AppError } from '../core/errors.js';
import { parseXml, NS } from '../core/office-xml.js';
import { crc32, patchZip } from '../core/office-zip.js';
import { inflateSync } from '../../vendor/fflate.mjs';
import { readZipDirectory } from '../core/zip-directory.js';

const mime = 'application/epub+zip';
const container = 'META-INF/container.xml';
const containerNs = 'urn:oasis:names:tc:opendocument:xmlns:container';
const opfNs = 'http://www.idpf.org/2007/opf';
const names = { title: 'Judul', creator: 'Pembuat', subject: 'Subjek', description: 'Deskripsi',
  publisher: 'Penerbit', language: 'Bahasa', rights: 'Hak cipta', date: 'Tanggal dibuat' };
const mandatory = new Set(['title', 'language']);
const decoder = new TextDecoder('utf-8', { fatal: true });
const encoder = new TextEncoder();
export const meta = { id: 'epub', engine: 'document', customTags: false, label: 'EPUB', extensions: ['epub'], mime };
export const sections = [{ id: 'umum', title: 'EPUB' }];
export const fields = Object.entries(names).map(([id, label]) => ({
  id, label, section: 'umum', native: `dc:${id}`, type: id === 'description' ? 'textarea' : 'text', maxLength: 2000,
}));

function getPart(entries, name) {
  const part = entries.find((entry) => entry.name === name);
  if (!part || (part.flags & 1) || ![0, 8].includes(part.method)
    || part.uncompressedSize === 0 || part.uncompressedSize > 4 * 1024 * 1024
    || part.uncompressedSize / Math.max(1, part.compressedSize) > 200) {
    throw new AppError('CORRUPT_FILE', `EPUB: ${name}`);
  }
  const data = part.method === 0 ? part.compressedData : inflateSync(part.compressedData, {
    out: new Uint8Array(part.uncompressedSize + 1),
  });
  if (data.length !== part.uncompressedSize || crc32(data) !== part.crc32) {
    throw new AppError('CORRUPT_FILE', `EPUB: ${name}`);
  }
  return parseXml(decoder.decode(data), name);
}

function inspect(bytes) {
  const zip = readZipDirectory(bytes);
  const entries = zip.entries;
  const first = entries[0];
  const localExtra = first?.localBytes?.[28] | (first?.localBytes?.[29] << 8);
  if (first?.name !== 'mimetype' || first.localOffsetAbs !== 0 || first.method !== 0
    || (first.flags & 1) || localExtra || first.uncompressedSize !== mime.length
    || decoder.decode(first.compressedData) !== mime) {
    throw new AppError('CORRUPT_FILE', t('documents.epubMime'));
  }
  const root = getPart(entries, container);
  const rootfiles = root.findAll(containerNs, 'rootfile');
  const path = root.attribute(rootfiles[0], 'full-path');
  if (!path || !entries.some((entry) => entry.name === path)) throw new AppError('CORRUPT_FILE', t('documents.epubMissing'));
  const document = getPart(entries, path);
  const metadata = document.find(opfNs, 'metadata');
  if (document.root.uri !== opfNs || document.root.local !== 'package' || !metadata) {
    throw new AppError('CORRUPT_FILE', t('documents.epubInvalid'));
  }
  return { document, metadata, path, entries, signed: entries.some(({ name }) => /^(META-INF\/signatures\.xml)$/i.test(name)), renditions: rootfiles.length };
}

function canRemoveField(document, id, nodes) {
  return !mandatory.has(id) && nodes.length === 1 && !document.attribute(nodes[0], 'id');
}

function metadataResult({ document, metadata, signed, renditions }) {
  const raw = [];
  const values = {};
  const removableFields = [];
  for (const field of fields) {
    const nodes = document.findAll(NS.dc, field.id, metadata);
    values[field.id] = document.value(nodes[0]).trim();
    if (!signed && renditions === 1 && canRemoveField(document, field.id, nodes)) removableFields.push(field.id);
    for (const node of nodes) raw.push({ group: 'Dublin Core', tag: field.native, value: document.value(node).trim() });
  }
  return { fields: values, raw, custom: [], removableFields, info: { format: 'EPUB', signed } };
}

export async function read(file) {
  return metadataResult(inspect(new Uint8Array(await file.arrayBuffer())));
}

export async function write(file, payload, _options, report = () => {}) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const original = inspect(bytes);
  const { document, metadata, path } = original;
  if (original.signed || original.renditions !== 1) throw new AppError('UNSUPPORTED', t('documents.epubReadOnly'));
  const removals = new Set(payload.remove || []);
  const unsupported = payload.rawRemove?.length || payload.custom?.length || payload.customRemove?.length;
  if (unsupported) throw new AppError('UNSUPPORTED', t('documents.fieldsOnly'));
  for (const field of fields) {
    const { id } = field;
    const node = document.find(NS.dc, id, metadata);
    if (removals.has(id)) {
      if ((node || mandatory.has(id)) && !canRemoveField(document, id, document.findAll(NS.dc, id, metadata))) {
        throw new AppError('UNSUPPORTED', t('documents.epubRequired'));
      }
      document.remove(node);
    } else if (Object.hasOwn(payload.set || {}, id)) {
      if (node?.children.some((child) => child.type === 'element')) throw new AppError('UNSUPPORTED', t('documents.epubStructured'));
      if (node) document.setValue(node, payload.set[id]);
      else document.insert(metadata, { uri: NS.dc, local: id, preferredPrefix: 'dc', value: payload.set[id] });
    }
  }
  report({ stage: t('documents.epubVerify'), pct: 75 });
  const blob = await patchZip(file, { [path]: encoder.encode(document.toString()) });
  const after = inspect(new Uint8Array(await blob.arrayBuffer()));
  const beforeEntries = original.entries;
  if (after.path !== path || beforeEntries.length !== after.entries.length || beforeEntries.some((entry, i) => {
    const next = after.entries[i];
    return entry.name !== next.name || (entry.name !== path
      && (entry.localBytes.length !== next.localBytes.length || entry.localBytes.some((byte, index) => byte !== next.localBytes[index])));
  })) throw new AppError('WRITE_FAILED', t('documents.epubPreservation'));
  return { ...metadataResult(after), blob };
}

export default { meta, sections, fields, read, write };
