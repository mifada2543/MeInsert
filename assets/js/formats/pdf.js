/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import { asArray, asString, sameValue, toDateInput, toIsoDate } from '../core/tag-utils.js';
import { AppError } from '../core/errors.js';
export const meta = {
  id: 'pdf',
  engine: 'pdf',
  label: 'PDF',
  description: 'Dokumen PDF',
  extensions: ['pdf'],
  mime: 'application/pdf',
};
export const sections = [
  {
    id: 'umum',
    title: 'Metadata PDF',
    description: 'Ditulis ke Info dictionary dan XMP agar konsisten di pembaca modern.',
  },
];
export const fields = [
  {
    id: 'title',
    section: 'umum',
    label: 'Judul',
    type: 'text',
    native: 'Info /Title + XMP dc:title',
    placeholder: 'Judul dokumen',
    maxLength: 256,
  },
  {
    id: 'author',
    section: 'umum',
    label: 'Penulis',
    type: 'text',
    native: 'Info /Author + XMP dc:creator',
    placeholder: 'Nama penulis atau organisasi',
    maxLength: 200,
  },
  {
    id: 'subject',
    section: 'umum',
    label: 'Subjek',
    type: 'textarea',
    native: 'Info /Subject + XMP dc:description',
    placeholder: 'Ringkasan isi dokumen…',
    maxLength: 2000,
  },
  {
    id: 'keywords',
    section: 'umum',
    label: 'Kata kunci',
    type: 'tags',
    native: 'Info /Keywords + XMP dc:subject',
    placeholder: 'laporan, keuangan, 2026',
    helper: 'Pisahkan dengan koma.',
    maxLength: 1000,
  },
  {
    id: 'creator',
    section: 'umum',
    label: 'Creator',
    type: 'text',
    native: 'Info /Creator + XMP pdf:CreatorTool',
    placeholder: 'Aplikasi yang membuat dokumen',
    maxLength: 200,
  },
  {
    id: 'producer',
    section: 'umum',
    label: 'Producer',
    type: 'text',
    native: 'Info /Producer + XMP pdf:Producer',
    placeholder: 'Aplikasi yang menghasilkan PDF',
    maxLength: 200,
  },
  {
    id: 'creationDate',
    section: 'umum',
    label: 'Tanggal dibuat',
    type: 'date',
    native: 'Info /CreationDate + XMP xmp:CreateDate',
  },
  {
    id: 'modDate',
    section: 'umum',
    label: 'Tanggal diubah',
    type: 'date',
    native: 'Info /ModDate + XMP xmp:ModifyDate',
  },
];
const INFO_KEYS = {
  title: 'Title',
  author: 'Author',
  subject: 'Subject',
  keywords: 'Keywords',
  creator: 'Creator',
  producer: 'Producer',
  creationDate: 'CreationDate',
  modDate: 'ModDate',
};
const STANDARD_INFO = new Set([
  'Title', 'Author', 'Subject', 'Keywords', 'Creator', 'Producer',
  'CreationDate', 'ModDate', 'Trapped', 'Metadata',
]);
const RDF = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
const DC = 'http://purl.org/dc/elements/1.1/';
const PDF_NS = 'http://ns.adobe.com/pdf/1.3/';
const XMP_NS = 'http://ns.adobe.com/xap/1.0/';
const XML_NS = 'http://www.w3.org/XML/1998/namespace';
function pdfString(value) {
  const s = String(value ?? '');
  return s;
}
function pdfObjectToString(obj) {
  if (!obj) return '';
  if (typeof obj.decodeDate === 'function') {
    try {
      return toDateInput(obj.decodeDate());
    } catch {
    }
  }
  if (typeof obj.decodeText === 'function') return obj.decodeText();
  if (typeof obj.decodeDate === 'function') {
    try {
      return toDateInput(obj.decodeDate());
    } catch {
      return '';
    }
  }
  if (typeof obj.asNumber === 'function') return String(obj.asNumber());
  if (typeof obj.asBoolean === 'function') return String(obj.asBoolean());
  if (typeof obj.asString === 'function') return obj.asString();
  if (typeof obj.asBytes === 'function') return '[data biner]';
  return String(obj).replace(/^\(|\)$/g, '');
}
async function getLib() {
  return import('../../vendor/pdf-lib.esm.js');
}
function signedWarning(bytes) {
  const text = new TextDecoder('latin1').decode(bytes.slice(0, Math.min(bytes.length, 8 * 1024 * 1024)));
  return /\/ByteRange\s*\[/i.test(text) && /\/Type\s*\/Sig\b/i.test(text);
}
export async function read(file) {
  const { PDFDocument, PDFName } = await getLib();
  const bytes = new Uint8Array(await file.arrayBuffer());
  let doc;
  try {
    doc = await PDFDocument.load(bytes, { updateMetadata: false });
  } catch (error) {
    const message = String(error?.message || error);
    if (/encrypted/i.test(message)) {
      throw new AppError('ENCRYPTED_PDF', 'PDF ini terenkripsi. Hapus proteksi terlebih dahulu, lalu coba lagi.', message);
    }
    throw new AppError('CORRUPT_FILE', 'PDF tidak bisa dibaca. File mungkin rusak atau formatnya tidak didukung.', message);
  }
  const infoRef = doc.context.trailerInfo.Info;
  const info = infoRef ? doc.context.lookup(infoRef) : null;
  const get = (key) => (info && typeof info.get === 'function' ? info.get(PDFName.of(key)) : undefined);
  const fields = {
    title: pdfObjectToString(get('Title')),
    author: pdfObjectToString(get('Author')),
    subject: pdfObjectToString(get('Subject')),
    keywords: asArray(pdfObjectToString(get('Keywords'))),
    creator: pdfObjectToString(get('Creator')),
    producer: pdfObjectToString(get('Producer')),
    creationDate: pdfObjectToString(get('CreationDate')),
    modDate: pdfObjectToString(get('ModDate')),
  };
  const custom = [];
  if (info && typeof info.entries === 'function') {
    for (const [keyObj, value] of info.entries()) {
      const key = typeof keyObj.decodeText === 'function'
        ? keyObj.decodeText()
        : String(keyObj.asString()).replace(/^\//, '');
      if (STANDARD_INFO.has(key)) continue;
      custom.push({ key, value: pdfObjectToString(value), originalKey: key });
    }
  }
  const raw = [
    ...Object.entries(fields).map(([key, value]) => ({
      group: 'Info',
      tag: `/${INFO_KEYS[key] || key}`,
      value: Array.isArray(value) ? value.join(', ') : value,
    })),
    ...custom.map((row) => ({ group: 'Custom', tag: row.key, value: row.value })),
  ].filter((row) => row.value !== '');
  const warnings = [];
  if (signedWarning(bytes)) {
    warnings.push('PDF ini memiliki tanda tangan digital. Menulis metadata akan membuat tanda tangan tidak valid.');
  }
  return {
    fields,
    custom,
    raw,
    info: { pages: doc.getPageCount(), signed: signedWarning(bytes) },
    warnings,
  };
}
function ensureInfo(doc, PDFName) {
  let ref = doc.context.trailerInfo.Info;
  let info = ref ? doc.context.lookup(ref) : undefined;
  if (!info || typeof info.set !== 'function') {
    info = doc.context.obj({});
    ref = doc.context.register(info);
    doc.context.trailerInfo.Info = ref;
  }
  return info;
}
function dateString(value) {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}
function xmpDate(value) {
  return toIsoDate(value);
}
function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
function removeField(xml, prefix, local) {
  const element = new RegExp(`<${prefix}:${local}\\b[^>]*\\/>|<${prefix}:${local}\\b[^>]*>[\\s\\S]*?<\\/${prefix}:${local}>`, 'gi');
  const attribute = new RegExp(`\\s+${prefix}:${local}\\s*=\\s*(?:"[^"]*"|'[^']*')`, 'gi');
  return xml.replace(element, '').replace(attribute, '');
}
function addNamespace(openTag, prefix, ns) {
  if (new RegExp(`xmlns:${prefix}\\s*=`, 'i').test(openTag)) return openTag;
  return openTag.replace(/>$/, ` xmlns:${prefix}="${ns}">`);
}
function altField(prefix, local, value) {
  if (!value) return '';
  return `<${prefix}:${local}><rdf:Alt><rdf:li xml:lang="x-default">${escapeXml(value)}</rdf:li></rdf:Alt></${prefix}:${local}>`;
}
function listField(prefix, local, tag, values) {
  const list = (values || []).map(escapeXml).filter(Boolean);
  if (!list.length) return '';
  return `<${prefix}:${local}><rdf:${tag}>${list.map((value) => `<rdf:li>${value}</rdf:li>`).join('')}</rdf:${tag}></${prefix}:${local}>`;
}
function textField(prefix, local, value) {
  if (!value) return '';
  return `<${prefix}:${local}>${escapeXml(value)}</${prefix}:${local}>`;
}
function freshXmp() {
  return `<?xpacket begin="\ufeff" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
 <rdf:RDF xmlns:rdf="${RDF}">
  <rdf:Description rdf:about="" xmlns:dc="${DC}" xmlns:pdf="${PDF_NS}" xmlns:xmp="${XMP_NS}"/>
 </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}
const XMP_FIELDS = {
  title: [['dc', 'title']],
  author: [['dc', 'creator']],
  subject: [['dc', 'description']],
  keywords: [['dc', 'subject'], ['pdf', 'Keywords']],
  creator: [['xmp', 'CreatorTool']],
  producer: [['pdf', 'Producer']],
  creationDate: [['xmp', 'CreateDate']],
  modDate: [['xmp', 'ModifyDate']],
};
const XMP_FIELD_IDS = Object.keys(XMP_FIELDS);
function tagEnd(xml, start) {
  let quote = '';
  for (let i = start + 1; i < xml.length; i += 1) {
    const ch = xml[i];
    if (quote) {
      if (ch === quote) quote = '';
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === '>') {
      return i;
    }
  }
  return -1;
}
function attributesOf(tag) {
  const out = [];
  const body = tag.replace(/^<\s*\/?\s*[^\s/>]+/, '').replace(/\/?\s*>$/, '');
  const re = /([A-Za-z_][\w.-]*:[\w.-]+|[A-Za-z_][\w.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let match;
  while ((match = re.exec(body))) {
    out.push({ name: match[1], value: match[2] ?? match[3] ?? '' });
  }
  return out;
}
function decodeXml(value) {
  return String(value || '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}
export function parseXmp(xml) {
  const source = typeof xml === 'string' ? xml : '';
  const namespaces = {};
  const descriptions = [];
  const properties = [];
  const stack = [];
  let current = null;
  let ok = true;
  let error = '';
  let i = 0;
  const fail = (message) => { ok = false; error = message; };
  if (!source.trim()) return { ok: false, error: 'XMP kosong.', namespaces, descriptions, properties };
  while (i < source.length) {
    const lt = source.indexOf('<', i);
    if (lt < 0) break;

    if (source.startsWith('<!--', lt)) {
      const end = source.indexOf('-->', lt + 4);
      if (end < 0) { fail('Komentar XML tidak tertutup.'); break; }
      i = end + 3;
      continue;
    }
    if (source.startsWith('<![CDATA[', lt)) {
      const end = source.indexOf(']]>', lt + 9);
      if (end < 0) { fail('CDATA tidak tertutup.'); break; }
      i = end + 3;
      continue;
    }
    if (source.startsWith('<?', lt)) {
      const end = source.indexOf('?>', lt + 2);
      if (end < 0) { fail('Processing instruction tidak tertutup.'); break; }
      i = end + 2;
      continue;
    }
    if (source.startsWith('<!', lt)) {
      const end = tagEnd(source, lt);
      if (end < 0) { fail('Deklarasi XML tidak tertutup.'); break; }
      i = end + 1;
      continue;
    }
    const end = tagEnd(source, lt);
    if (end < 0) { fail('Tag XML tidak tertutup.'); break; }
    const raw = source.slice(lt, end + 1);
    const closing = /^<\//.test(raw);
    const selfClosing = /\/\s*>$/.test(raw);
    const nameMatch = raw.match(/^<\s*\/?\s*([A-Za-z_][\w.-]*(?::[\w.-]+)?)/);
    if (!nameMatch) { fail('Nama tag XML tidak valid.'); break; }
    const name = nameMatch[1];
    if (closing) {
      const top = stack.pop();
      if (!top || top.name !== name) { fail(`Tag penutup ${name} tidak cocok.`); break; }
      if (name === 'rdf:Description' && current) {
        current.end = end + 1;
        descriptions.push(current);
        current = null;
      }
      i = end + 1;
      continue;
    }
    const attrs = attributesOf(raw);
    for (const attr of attrs) {
      if (attr.name.startsWith('xmlns:')) namespaces[attr.name.slice(6)] = attr.value;
    }
    if (name === 'rdf:Description') {
      current = {
        start: lt,
        end: -1,
        openTag: raw,
        selfClosing,
        properties: [],
        namespaces: { ...namespaces },
      };
      for (const attr of attrs) {
        if (attr.name === 'xmlns' || attr.name.startsWith('xmlns:') || attr.name.startsWith('rdf:')) continue;
        const prop = attr.name.match(/^([\w.-]+):([\w.-]+)$/);
        if (!prop) continue;
        const entry = { prefix: prop[1], local: prop[2], qualified: attr.name, form: 'attribute', value: decodeXml(attr.value) };
        current.properties.push(entry);
        properties.push({ ...entry, description: descriptions.length });
      }
      if (selfClosing) {
        current.end = end + 1;
        descriptions.push(current);
        current = null;
      } else {
        stack.push({ name, start: lt });
      }
    } else {
      const parent = stack[stack.length - 1];
      if (current && parent?.name === 'rdf:Description') {
        const prop = name.match(/^([\w.-]+):([\w.-]+)$/);
        if (prop) {
          const entry = { prefix: prop[1], local: prop[2], qualified: name, form: 'element', value: '' };
          current.properties.push(entry);
          properties.push({ ...entry, description: descriptions.length });
        }
      }
      if (!selfClosing) stack.push({ name, start: lt });
    }
    i = end + 1;
  }
  if (ok && stack.length) fail(`Tag ${stack[stack.length - 1].name} tidak tertutup.`);
  if (ok && !descriptions.length) fail('Tidak ada rdf:Description.');
  if (ok && !/<(?:x:xmpmeta|rdf:RDF)[\s>]/i.test(source)) fail('Paket XMP tidak dikenali.');
  return { ok, error, namespaces, descriptions, properties };
}
function targetDescriptionIndex(parsed, ids) {
  for (const id of ids) {
    for (const [prefix, local] of XMP_FIELDS[id] || []) {
      const found = parsed.properties.find((prop) => prop.prefix === prefix && prop.local === local);
      if (found) return found.description;
    }
  }
  return 0;
}
export function buildXmp(existing, values, ids = XMP_FIELD_IDS) {
  const changed = new Set(ids.filter((id) => XMP_FIELDS[id]));
  let xml = typeof existing === 'string' ? existing : '';
  let fallback = false;
  let targetIndex = 0;
  let before = null;
  if (!xml.trim() || !/<(?:x:xmpmeta|rdf:RDF)[\s>]/i.test(xml)) {
    if (changed.size) xml = freshXmp();
  } else {
    before = parseXmp(xml);
    if (!before.ok) {
      fallback = true;
      xml = freshXmp();
      for (const id of XMP_FIELD_IDS) changed.add(id);
    } else {
      targetIndex = targetDescriptionIndex(before, changed);
    }
  }
  if (!changed.size) return { xml, fallback };

  for (const id of changed) {
    for (const [prefix, local] of XMP_FIELDS[id]) xml = removeField(xml, prefix, local);
  }
  const fragment = [
    changed.has('title') ? altField('dc', 'title', values.title) : '',
    changed.has('author') ? listField('dc', 'creator', 'Seq', values.author ? [values.author] : []) : '',
    changed.has('subject') ? altField('dc', 'description', values.subject) : '',
    changed.has('keywords') ? listField('dc', 'subject', 'Bag', values.keywords) : '',
    changed.has('keywords') ? textField('pdf', 'Keywords', (values.keywords || []).join(', ')) : '',
    changed.has('creator') ? textField('xmp', 'CreatorTool', values.creator) : '',
    changed.has('producer') ? textField('pdf', 'Producer', values.producer) : '',
    changed.has('creationDate') ? textField('xmp', 'CreateDate', values.creationDate ? xmpDate(values.creationDate) : '') : '',
    changed.has('modDate') ? textField('xmp', 'ModifyDate', values.modDate ? xmpDate(values.modDate) : '') : '',
  ].filter(Boolean).join('');
  if (!fragment) return { xml, fallback };
  const parsed = parseXmp(xml);
  if (!parsed.ok || !parsed.descriptions.length) {
    return { xml: buildXmp('', values, XMP_FIELD_IDS).xml, fallback: true };
  }
  const target = parsed.descriptions[Math.min(targetIndex, parsed.descriptions.length - 1)];
  let openTag = target.openTag;
  if (target.selfClosing) openTag = openTag.replace(/\/\s*>$/, '>');
  let enhanced = openTag;
  enhanced = addNamespace(enhanced, 'dc', DC);
  enhanced = addNamespace(enhanced, 'pdf', PDF_NS);
  enhanced = addNamespace(enhanced, 'xmp', XMP_NS);
  enhanced = addNamespace(enhanced, 'rdf', RDF);
  const tail = target.selfClosing ? `</rdf:Description>${xml.slice(target.start + target.openTag.length)}` : xml.slice(target.start + target.openTag.length);
  xml = `${xml.slice(0, target.start)}${enhanced}${tail}`;
  const insertAt = target.start + enhanced.length;
  xml = `${xml.slice(0, insertAt)}${fragment}${xml.slice(insertAt)}`;
  if (!/<\?xpacket/i.test(xml)) {
    xml = `<?xpacket begin="\ufeff" id="W5M0MpCehiHzreSzNTczkc9d"?>\n${xml}\n<?xpacket end="w"?>`;
  }
  return { xml, fallback };
}
export async function write(file, payload, options = {}, report = () => {}) {
  const { PDFDocument, PDFName, PDFString } = await getLib();
  const bytes = new Uint8Array(await file.arrayBuffer());
  let doc;
  try {
    doc = await PDFDocument.load(bytes, { updateMetadata: false });
  } catch (error) {
    const message = String(error?.message || error);
    if (/encrypted/i.test(message)) {
      throw new AppError('ENCRYPTED_PDF', 'PDF ini terenkripsi. Hapus proteksi terlebih dahulu, lalu coba lagi.', message);
    }
    throw new AppError('CORRUPT_FILE', 'PDF tidak bisa dibuka untuk ditulis.', message);
  }
  const info = ensureInfo(doc, PDFName);
  const set = payload?.set || {};
  const remove = new Set(payload?.remove || []);
  const warnings = [];
  const customRemove = [...(payload?.customRemove || [])];
  for (const item of payload?.rawRemove || []) {
    const key = asString(item).trim();
    if (!key) continue;
    const normalized = key.replace(/^\//, '');
    const standardId = Object.entries(INFO_KEYS)
      .find(([, value]) => value.toLowerCase() === normalized.toLowerCase())?.[0];
    if (standardId) {
      remove.add(standardId);
      continue;
    }
    if (STANDARD_INFO.has(normalized)) {
      info.delete(PDFName.of(normalized));
      continue;
    }
    customRemove.push(normalized);
  }
  for (const [id, key] of Object.entries(INFO_KEYS)) {
    if (remove.has(id)) {
      info.delete(PDFName.of(key));
      continue;
    }
    if (!(id in set)) continue;
    const value = set[id];
    if (id === 'creationDate' || id === 'modDate') {
      const date = new Date(`${value}T00:00:00Z`);
      if (!Number.isNaN(date.getTime())) {
        info.set(PDFName.of(key), PDFString.fromDate(date));
      }
    } else if (id === 'keywords') {
      info.set(PDFName.of(key), PDFString.of(asArray(value).join(', ')));
    } else {
      info.set(PDFName.of(key), PDFString.of(asString(value)));
    }
  }
  for (const item of payload?.custom || []) {
    const key = asString(item?.key).trim();
    if (!key) continue;
    if (STANDARD_INFO.has(key)) {
      throw new AppError('INVALID_KEY', `Key "${key}" adalah metadata standar PDF. Gunakan field yang tersedia.`);
    }
    info.set(PDFName.of(key), PDFString.of(asString(item?.value)));
  }
  for (const key of customRemove) {
    if (key && !STANDARD_INFO.has(key)) info.delete(PDFName.of(key));
  }
  const finalValues = {
    title: pdfObjectToString(info.get(PDFName.of('Title'))),
    author: pdfObjectToString(info.get(PDFName.of('Author'))),
    subject: pdfObjectToString(info.get(PDFName.of('Subject'))),
    keywords: asArray(pdfObjectToString(info.get(PDFName.of('Keywords')))),
    creator: pdfObjectToString(info.get(PDFName.of('Creator'))),
    producer: pdfObjectToString(info.get(PDFName.of('Producer'))),
    creationDate: pdfObjectToString(info.get(PDFName.of('CreationDate'))),
    modDate: pdfObjectToString(info.get(PDFName.of('ModDate'))),
  };
  let existingXmp = '';
  try {
    const metaRef = doc.catalog.get(PDFName.of('Metadata'));
    if (metaRef) {
      const stream = doc.context.lookup(metaRef);
      if (stream && typeof stream.getContents === 'function') {
        existingXmp = new TextDecoder().decode(stream.getContents());
      }
    }
  } catch {
    existingXmp = '';
  }
  report({ stage: 'Menulis metadata dan XMP…', pct: 45 });
  const changedXmp = new Set([...Object.keys(set), ...remove].filter((id) => XMP_FIELDS[id]));
  if (changedXmp.size) {
    const built = buildXmp(existingXmp, finalValues, [...changedXmp]);
    if (built.fallback) {
      warnings.push('XMP lama tidak bisa dibaca dengan aman. Metadata XMP ditulis ulang; properti asing mungkin hilang.');
    }
    const xmpStream = doc.context.stream(new TextEncoder().encode(built.xml), {
      Type: 'Metadata',
      Subtype: 'XML',
    });
    doc.catalog.set(PDFName.of('Metadata'), doc.context.register(xmpStream));
  }
  let out;
  try {
    out = await doc.save({
      useObjectStreams: false,
      addDefaultPage: false,
      updateFieldAppearances: false,
    });
  } catch (error) {
    throw new AppError('WRITE_FAILED', 'Gagal menyimpan PDF.', error.message || String(error));
  }
  report({ stage: 'Memverifikasi hasil…', pct: 80 });
  const blob = new Blob([out], { type: 'application/pdf' });
  let verifyDoc;
  try {
    verifyDoc = await PDFDocument.load(new Uint8Array(out), { updateMetadata: false });
  } catch (error) {
    throw new AppError('VERIFY_FAILED', 'PDF hasil tidak bisa dibuka kembali.', error.message || String(error));
  }
  if (verifyDoc.getPageCount() !== doc.getPageCount()) {
    warnings.push('Jumlah halaman PDF berubah. Periksa kembali file hasil.');
  }
  const verifyInfoRef = verifyDoc.context.trailerInfo.Info;
  const verifyInfo = verifyInfoRef ? verifyDoc.context.lookup(verifyInfoRef) : null;
  const verifyFields = {
    title: pdfObjectToString(verifyInfo?.get(PDFName.of('Title'))),
    author: pdfObjectToString(verifyInfo?.get(PDFName.of('Author'))),
    subject: pdfObjectToString(verifyInfo?.get(PDFName.of('Subject'))),
    keywords: asArray(pdfObjectToString(verifyInfo?.get(PDFName.of('Keywords')))),
    creator: pdfObjectToString(verifyInfo?.get(PDFName.of('Creator'))),
    producer: pdfObjectToString(verifyInfo?.get(PDFName.of('Producer'))),
    creationDate: pdfObjectToString(verifyInfo?.get(PDFName.of('CreationDate'))),
    modDate: pdfObjectToString(verifyInfo?.get(PDFName.of('ModDate'))),
  };
  for (const [id, value] of Object.entries(set)) {
    if (id in verifyFields && !sameValue(value, verifyFields[id])) {
      warnings.push(`Field "${id}" tidak terbaca kembali persis seperti yang diminta.`);
    }
  }
  return {
    blob,
    fields: verifyFields,
    raw: [],
    info: { pages: verifyDoc.getPageCount(), signed: false },
    warnings,
  };
}
export default { meta, sections, fields, read, write };
