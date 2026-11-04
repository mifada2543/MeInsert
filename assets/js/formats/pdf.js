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
      // Fall through to text decoding.
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

function buildXmp(existing, values) {
  let xml = existing && /<x:xmpmeta[\s>]/i.test(existing)
    ? existing
    : freshXmp();

  const fields = [
    ['dc', 'title'],
    ['dc', 'creator'],
    ['dc', 'description'],
    ['dc', 'subject'],
    ['pdf', 'Keywords'],
    ['pdf', 'Producer'],
    ['xmp', 'CreatorTool'],
    ['xmp', 'CreateDate'],
    ['xmp', 'ModifyDate'],
  ];
  for (const [prefix, local] of fields) xml = removeField(xml, prefix, local);

  const fragment = [
    altField('dc', 'title', values.title),
    listField('dc', 'creator', 'Seq', values.author ? [values.author] : []),
    altField('dc', 'description', values.subject),
    listField('dc', 'subject', 'Bag', values.keywords),
    textField('pdf', 'Keywords', (values.keywords || []).join(', ')),
    textField('pdf', 'Producer', values.producer),
    textField('xmp', 'CreatorTool', values.creator),
    textField('xmp', 'CreateDate', values.creationDate ? xmpDate(values.creationDate) : ''),
    textField('xmp', 'ModifyDate', values.modDate ? xmpDate(values.modDate) : ''),
  ].filter(Boolean).join('');

  const openMatch = xml.match(/<rdf:Description\b[^>]*>/i);
  if (!openMatch) {
    // A malformed XMP packet is replaced with a clean packet rather than
    // risking a broken metadata stream.
    return buildXmp('', values);
  }
  let openTag = openMatch[0];
  let selfClosing = /\/\s*>$/.test(openTag);
  if (selfClosing) {
    openTag = openTag.replace(/\/\s*>$/, '>');
    xml = xml.replace(openMatch[0], `${openTag}</rdf:Description>`);
  } else {
    xml = xml.replace(openTag, openTag);
  }
  let enhanced = openTag;
  enhanced = addNamespace(enhanced, 'dc', DC);
  enhanced = addNamespace(enhanced, 'pdf', PDF_NS);
  enhanced = addNamespace(enhanced, 'xmp', XMP_NS);
  enhanced = addNamespace(enhanced, 'rdf', RDF);
  xml = xml.replace(openTag, enhanced);
  const closeIndex = xml.indexOf('</rdf:Description>', xml.indexOf(enhanced));
  if (closeIndex < 0) return buildXmp('', values);
  xml = `${xml.slice(0, closeIndex)}${fragment}${xml.slice(closeIndex)}`;
  if (!/<\?xpacket/i.test(xml)) {
    xml = `<?xpacket begin="\ufeff" id="W5M0MpCehiHzreSzNTczkc9d"?>\n${xml}\n<?xpacket end="w"?>`;
  }
  return xml;
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
  const xmp = buildXmp(existingXmp, finalValues);
  const xmpStream = doc.context.stream(new TextEncoder().encode(xmp), {
    Type: 'Metadata',
    Subtype: 'XML',
  });
  doc.catalog.set(PDFName.of('Metadata'), doc.context.register(xmpStream));

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
