/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — MeInsert Source-Available License v1.0 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import { AppError } from './errors.js';
export const NS = Object.freeze({
  cp: 'http://schemas.openxmlformats.org/package/2006/metadata/core-properties',
  dc: 'http://purl.org/dc/elements/1.1/',
  dcterms: 'http://purl.org/dc/terms/',
  xsi: 'http://www.w3.org/2001/XMLSchema-instance',
  ep: 'http://schemas.openxmlformats.org/officeDocument/2006/extended-properties',
  custom: 'http://schemas.openxmlformats.org/officeDocument/2006/custom-properties',
  vt: 'http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes',
  rels: 'http://schemas.openxmlformats.org/package/2006/relationships',
  ct: 'http://schemas.openxmlformats.org/package/2006/content-types',
  office: 'urn:oasis:names:tc:opendocument:xmlns:office:1.0',
  meta: 'urn:oasis:names:tc:opendocument:xmlns:meta:1.0',
  text: 'urn:oasis:names:tc:opendocument:xmlns:text:1.0',
  table: 'urn:oasis:names:tc:opendocument:xmlns:table:1.0',
  manifest: 'urn:oasis:names:tc:opendocument:xmlns:manifest:1.0',
  w: 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
  wStrict: 'http://purl.oclc.org/ooxml/wordprocessingml/main',
  s: 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
  sStrict: 'http://purl.oclc.org/ooxml/spreadsheetml/main',
  p: 'http://schemas.openxmlformats.org/presentationml/2006/main',
  pStrict: 'http://purl.oclc.org/ooxml/presentationml/main',
  a: 'http://schemas.openxmlformats.org/drawingml/2006/main',
});
const NAMED_ENTITIES = Object.freeze({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" });
const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const MAX_DEPTH = 128;
const MAX_NODES = 20000;
function invalid(label, message) {
  return new AppError('INVALID_XML', message, label);
}
function isSpace(char) {
  return char === ' ' || char === '\t' || char === '\r' || char === '\n';
}
function skipSpace(source, index, end = source.length) {
  while (index < end && isSpace(source[index])) index += 1;
  return index;
}
function readName(source, index, end = source.length) {
  const match = /^[A-Za-z_][\w.-]*(?::[A-Za-z_][\w.-]*)?/.exec(source.slice(index, end));
  return match ? match[0] : '';
}
function splitName(name) {
  const at = name.indexOf(':');
  return at < 0 ? { prefix: '', local: name } : { prefix: name.slice(0, at), local: name.slice(at + 1) };
}
function validXmlChar(code) {
  return code === 0x9 || code === 0xa || code === 0xd
    || (code >= 0x20 && code <= 0xd7ff)
    || (code >= 0xe000 && code <= 0xfffd)
    || (code >= 0x10000 && code <= 0x10ffff);
}
export function decodeEntities(value, label = 'XML') {
  const source = String(value ?? '');
  let out = '';
  let index = 0;
  while (index < source.length) {
    const at = source.indexOf('&', index);
    if (at < 0) {
      out += source.slice(index);
      break;
    }
    out += source.slice(index, at);
    const semi = source.indexOf(';', at + 1);
    if (semi < 0) throw invalid(label, 'Entitas XML tidak diakhiri titik koma.');
    const entity = source.slice(at + 1, semi);
    if (/^#x[0-9a-fA-F]+$/.test(entity)) {
      const code = Number.parseInt(entity.slice(2), 16);
      if (!validXmlChar(code)) throw invalid(label, 'Referensi karakter XML tidak valid.');
      out += String.fromCodePoint(code);
    } else if (/^#[0-9]+$/.test(entity)) {
      const code = Number.parseInt(entity.slice(1), 10);
      if (!validXmlChar(code)) throw invalid(label, 'Referensi karakter XML tidak valid.');
      out += String.fromCodePoint(code);
    } else if (hasOwn(NAMED_ENTITIES, entity)) {
      out += NAMED_ENTITIES[entity];
    } else {
      throw invalid(label, `Entitas XML "${entity}" tidak dikenali dan tidak boleh diproses.`);
    }
    index = semi + 1;
  }
  return out;
}
export function encodeXml(value, label = 'XML') {
  const source = String(value ?? '');
  let out = '';
  for (const char of source) {
    const code = char.codePointAt(0);
    if (!validXmlChar(code)) throw invalid(label, 'Nilai mengandung karakter yang tidak valid dalam XML.');
    if (char === '&') out += '&amp;';
    else if (char === '<') out += '&lt;';
    else if (char === '>') out += '&gt;';
    else if (char === '"') out += '&quot;';
    else if (char === "'") out += '&apos;';
    else out += char;
  }
  return out;
}
function parseAttributes(source, from, to, label) {
  const attrs = [];
  const seen = new Set();
  let index = from;
  while (index < to) {
    const before = index;
    index = skipSpace(source, index, to);
    if (index >= to) break;
    if (before === index) throw invalid(label, 'Atribut XML harus dipisahkan spasi.');
    const name = readName(source, index, to);
    if (!name) throw invalid(label, 'Atribut XML tidak valid.');
    index += name.length;
    index = skipSpace(source, index, to);
    if (source[index] !== '=') throw invalid(label, `Atribut "${name}" tidak memiliki nilai.`);
    index = skipSpace(source, index + 1, to);
    const quote = source[index];
    if (quote !== '"' && quote !== "'") throw invalid(label, `Nilai atribut "${name}" tidak dikutip.`);
    const valueStart = index + 1;
    const valueEnd = source.indexOf(quote, valueStart);
    if (valueEnd < 0 || valueEnd > to) throw invalid(label, `Nilai atribut "${name}" tidak ditutup.`);
    if (seen.has(name)) throw invalid(label, `Atribut "${name}" duplikat.`);
    seen.add(name);
    const value = source.slice(valueStart, valueEnd);
    if (value.includes('<')) throw invalid(label, 'Karakter ilegal pada atribut.');
    decodeEntities(value, label);
    attrs.push({ name, value, valueStart, valueEnd });
    index = valueEnd + 1;
  }
  return attrs;
}
function findTagEnd(source, from, label) {
  let quote = '';
  for (let index = from; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (char === quote) quote = '';
    } else if (char === '"' || char === "'") quote = char;
    else if (char === '>') return index;
  }
  throw invalid(label, 'Tag XML tidak ditutup.');
}
function textOf(source, start, end, label, cdata = false) {
  const raw = source.slice(start, end);
  if (cdata) return raw;
  return decodeEntities(raw, label);
}
export class XmlDocument {
  constructor(source, root, nodes, label) {
    this.source = source;
    this.root = root;
    this.nodes = nodes;
    this.label = label;
    this.edits = [];
    this.removedNodes = new Set();
  }
  find(uri, local, scope = this.root) {
    return this.nodes.find((node) => node.uri === uri && node.local === local
      && (!scope || node === scope || isDescendant(node, scope)));
  }
  findAll(uri, local, scope = this.root) {
    return this.nodes.filter((node) => node.uri === uri && node.local === local
      && (!scope || node === scope || isDescendant(node, scope)));
  }
  value(node) {
    if (!node) return '';
    if (node.selfClosing) return '';
    return textOf(this.source, node.startTagEnd, node.endTagStart, this.label);
  }
  values(uri, local, scope = this.root) {
    return this.findAll(uri, local, scope).map((node) => this.value(node).trim()).filter(Boolean);
  }
  attribute(node, name) {
    return node?.attrs.find((attr) => attr.name === name)?.value ?? '';
  }
  setValue(node, value) {
    if (!node) throw invalid(this.label, 'Elemen tujuan tidak ditemukan.');
    const encoded = encodeXml(value, this.label);
    if (node.selfClosing) {
      const open = node.openTag.replace(/\/\s*>$/, '>');
      this.edits.push({ start: node.start, end: node.end, text: `${open}${encoded}</${node.name}>` });
    } else {
      this.edits.push({ start: node.startTagEnd, end: node.endTagStart, text: encoded });
    }
    return this;
  }
  remove(node) {
    if (node && !this.removedNodes.has(node)) {
      this.removedNodes.add(node);
      this.edits.push({ start: node.start, end: node.end, text: '' });
    }
    return this;
  }
  prefixFor(node, uri, preferred = '') {
    const scopes = [node.ns];
    if (preferred && node.ns[preferred] === uri) return { prefix: preferred, declared: false };
    const named = pickNamed(scopes, uri);
    if (named !== null) return { prefix: named, declared: false };
    if (!preferred && (node.ns[''] || '') === uri) return { prefix: '', declared: false };
    const base = (preferred || 'ns').replace(/[^A-Za-z0-9_]/g, '') || 'ns';
    let candidate = base;
    let suffix = 1;
    while (scopes.some((scope) => hasOwn(scope, candidate))) candidate = `${base}${suffix += 1}`;
    return { prefix: candidate, declared: true };
  }
  insert(parent, spec) {
    if (!parent) throw invalid(this.label, 'Induk elemen tidak ditemukan.');
    const { uri, local, value = '', attributes = [], preferredPrefix = '' } = spec;
    const chosen = this.prefixFor(parent, uri, preferredPrefix);
    const name = chosen.prefix ? `${chosen.prefix}:${local}` : local;
    let declarations = chosen.declared ? ` xmlns:${chosen.prefix}="${encodeXml(uri, this.label)}"` : '';
    const rendered = [];
    const scope = { ns: { ...parent.ns } };
    if (chosen.declared) scope.ns[chosen.prefix] = uri;
    for (const attr of attributes) {
      let attrName = attr.name;
      if (attr.uri) {
        const found = this.prefixFor(scope, attr.uri, attr.prefix || 'xsi');
        attrName = found.prefix ? `${found.prefix}:${attr.local}` : attr.local;
        if (found.declared) {
          declarations += ` xmlns:${found.prefix}="${encodeXml(attr.uri, this.label)}"`;
          scope.ns[found.prefix] = attr.uri;
        }
      }
      rendered.push(` ${attrName}="${encodeXml(attr.value, this.label)}"`);
    }
    const fragment = `<${name}${declarations}${rendered.join('')}>${encodeXml(value, this.label)}</${name}>`;
    if (parent.selfClosing) {
      const open = parent.openTag.replace(/\/\s*>$/, '>');
      this.edits.push({ start: parent.start, end: parent.end, text: `${open}${fragment}</${parent.name}>` });
    } else {
      this.edits.push({ start: parent.endTagStart, end: parent.endTagStart, text: fragment });
    }
    return this;
  }
  insertRaw(parent, fragment) {
    if (!parent) throw invalid(this.label, 'Induk elemen tidak ditemukan.');
    if (parent.selfClosing) {
      const open = parent.openTag.replace(/\/\s*>$/, '>');
      this.edits.push({ start: parent.start, end: parent.end, text: `${open}${fragment}</${parent.name}>` });
    } else {
      this.edits.push({ start: parent.endTagStart, end: parent.endTagStart, text: fragment });
    }
    return this;
  }
  hasEdits() {
    return this.edits.length > 0;
  }
  toString() {
    let out = this.source;
    const ordered = [...this.edits].sort((a, b) => b.start - a.start || b.end - a.end);
    let previous = null;
    for (const edit of ordered) {
      if (previous && edit.end > previous.start) throw invalid(this.label, 'Perubahan XML saling tumpang tindih.');
      out = `${out.slice(0, edit.start)}${edit.text}${out.slice(edit.end)}`;
      previous = edit;
    }
    parseXml(out, this.label);
    return out;
  }
}
function pickNamed(scopes, uri) {
  for (const scope of scopes) {
    for (const [prefix, bound] of Object.entries(scope)) {
      if (prefix && bound === uri) return prefix;
    }
  }
  return null;
}
function isDescendant(node, ancestor) {
  let cursor = node.parent;
  while (cursor) {
    if (cursor === ancestor) return true;
    cursor = cursor.parent;
  }
  return false;
}
export function parseXml(source, label = 'XML') {
  const text = String(source ?? '');
  for (const char of text) if (!validXmlChar(char.codePointAt(0))) throw invalid(label, 'Karakter XML ilegal.');
  if (text.includes('\u0000')) throw invalid(label, 'XML mengandung byte NUL.');
  if (/<!DOCTYPE\b/i.test(text) || /<!ENTITY\b/i.test(text)) {
    throw invalid(label, 'DTD dan entitas eksternal tidak didukung dan ditolak.');
  }
  const nodes = [];
  const stack = [];
  let root = null;
  let index = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  const documentStart = index;
  let count = 0;
  while (index < text.length) {
    if (text[index] !== '<') {
      const next = text.indexOf('<', index);
      const end = next < 0 ? text.length : next;
      const parent = stack[stack.length - 1] || null;
      const raw = text.slice(index, end);
      if (!parent && [...raw].some((char) => !isSpace(char))) throw invalid(label, 'Teks di luar akar XML.');
      if (raw.includes(']]>')) throw invalid(label, 'Delimiter CDATA ilegal.');
      decodeEntities(raw, label);
      if (parent) parent.children.push({ type: 'text', start: index, end, text: raw });
      index = end;
      continue;
    }
    if (text.startsWith('<!--', index)) {
      const end = text.indexOf('-->', index + 4);
      if (end < 0) throw invalid(label, 'Komentar XML tidak ditutup.');
      const comment = text.slice(index + 4, end);
      if (comment.includes('--') || comment.endsWith('-')) throw invalid(label, 'Komentar XML ilegal.');
      index = end + 3;
      continue;
    }
    if (text.startsWith('<![CDATA[', index)) {
      const end = text.indexOf(']]>', index + 9);
      if (end < 0) throw invalid(label, 'CDATA tidak ditutup.');
      const parent = stack[stack.length - 1] || null;
      if (!parent) throw invalid(label, 'CDATA di luar akar XML.');
      if (parent) parent.children.push({ type: 'cdata', start: index, end: end + 3, text: text.slice(index + 9, end) });
      index = end + 3;
      continue;
    }
    if (text.startsWith('<?', index)) {
      const end = text.indexOf('?>', index + 2);
      if (end < 0) throw invalid(label, 'Instruksi pemrosesan tidak ditutup.');
      const target = readName(text, index + 2, end);
      if (!target || (index + 2 + target.length < end && !isSpace(text[index + 2 + target.length]))) throw invalid(label, 'Instruksi pemrosesan ilegal.');
      if (/^xml$/i.test(target)) {
        if (target !== 'xml' || index !== documentStart || !/^xml\s+version\s*=\s*(['"])1\.0\1(?:\s+encoding\s*=\s*(['"])[A-Za-z][A-Za-z0-9._-]*\2)?(?:\s+standalone\s*=\s*(['"])(?:yes|no)\3)?\s*$/.test(text.slice(index + 2, end))) throw invalid(label, 'Deklarasi XML ilegal.');
      }
      index = end + 2;
      continue;
    }
    if (text.startsWith('<!', index)) throw invalid(label, 'Deklarasi XML tidak didukung.');
    if (text.startsWith('</', index)) {
      const name = readName(text, index + 2);
      if (!name) throw invalid(label, 'Tag penutup tidak valid.');
      const closeEnd = text.indexOf('>', index + 2 + name.length);
      if (closeEnd < 0) throw invalid(label, 'Tag penutup tidak ditutup.');
      if (skipSpace(text, index + 2 + name.length, closeEnd) !== closeEnd) throw invalid(label, 'Tag penutup ilegal.');
      const node = stack.pop();
      if (!node || node.name !== name) throw invalid(label, `Tag penutup "${name}" tidak cocok.`);
      node.endTagStart = index;
      node.end = closeEnd + 1;
      index = closeEnd + 1;
      continue;
    }
    const name = readName(text, index + 1);
    if (!name) throw invalid(label, 'Tag pembuka tidak valid.');
    const tagEnd = findTagEnd(text, index + 1 + name.length, label);
    let last = tagEnd - 1;
    while (last > index && isSpace(text[last])) last -= 1;
    const selfClosing = text[last] === '/';
    if (selfClosing && last !== tagEnd - 1) throw invalid(label, 'Tag kosong ilegal.');
    const attrEnd = selfClosing ? last : tagEnd;
    const attrs = parseAttributes(text, index + 1 + name.length, attrEnd, label);
    const parent = stack[stack.length - 1] || null;
    if (!parent && root) throw invalid(label, 'XML memiliki lebih dari satu elemen akar.');
    if (stack.length >= MAX_DEPTH) throw invalid(label, 'XML terlalu dalam.');
    count += 1;
    if (count > MAX_NODES) throw invalid(label, 'XML memiliki terlalu banyak elemen.');
    const xmlUri = 'http://www.w3.org/XML/1998/namespace';
    const xmlnsUri = 'http://www.w3.org/2000/xmlns/';
    const ns = Object.assign(Object.create(null), { xml: xmlUri }, parent?.ns || {});
    for (const attr of attrs) {
      if (attr.name !== 'xmlns' && !attr.name.startsWith('xmlns:')) continue;
      const key = attr.name === 'xmlns' ? '' : attr.name.slice(6);
      const bound = decodeEntities(attr.value, label);
      if (key === 'xmlns' || bound === xmlnsUri || (key === 'xml') !== (bound === xmlUri) || (key && !bound)) throw invalid(label, 'Deklarasi namespace ilegal.');
      ns[key] = bound;
    }
    const { prefix, local } = splitName(name);
    if (prefix && (!ns[prefix] || prefix === 'xmlns')) throw invalid(label, 'Prefix elemen tidak terdaftar.');
    const uri = ns[prefix] || '';
    const expanded = new Set();
    for (const attr of attrs) {
      if (attr.name === 'xmlns' || attr.name.startsWith('xmlns:')) continue;
      const parts = splitName(attr.name);
      if (parts.prefix && !ns[parts.prefix]) throw invalid(label, 'Prefix atribut tidak terdaftar.');
      const key = `${parts.prefix ? ns[parts.prefix] : ''}\u0000${parts.local}`;
      if (expanded.has(key)) throw invalid(label, 'Atribut namespace duplikat.');
      expanded.add(key);
    }
    const node = {
      type: 'element', name, prefix, local, uri, attrs, ns,
      start: index,
      startTagEnd: tagEnd + 1,
      endTagStart: selfClosing ? -1 : -1,
      end: selfClosing ? tagEnd + 1 : -1,
      selfClosing,
      openTag: text.slice(index, tagEnd + 1),
      parent,
      children: [],
    };
    if (selfClosing) node.endTagStart = node.startTagEnd;
    if (parent) parent.children.push(node);
    else root = node;
    nodes.push(node);
    if (!selfClosing) stack.push(node);
    index = tagEnd + 1;
  }
  if (stack.length) throw invalid(label, 'Elemen XML tidak ditutup.');
  if (!root) throw invalid(label, 'XML tidak memiliki elemen akar.');
  return new XmlDocument(text, root, nodes, label);
}
export function xmlText(node, label = 'XML') {
  if (!node) return '';
  if (node.selfClosing) return '';
  return textOf(node.source, node.startTagEnd, node.endTagStart, label);
}
export default { NS, parseXml, encodeXml, decodeEntities, XmlDocument, xmlText };