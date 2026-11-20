/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, PDFName } from '../../assets/vendor/pdf-lib.esm.js';
import { buildXmp, fields, meta, parseXmp, read, write, xmpInventory } from '../../assets/js/formats/pdf.js';
import { createSnapshot } from '../../assets/js/core/metadata-snapshot.js';
import { buildChangePlan } from '../../assets/js/core/change-plan.js';
import { verifyIntegrity } from '../../assets/js/core/integrity.js';
const XMP = `<?xpacket begin="\ufeff" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:xmp="http://ns.adobe.com/xap/1.0/" xmlns:xmpMM="http://ns.adobe.com/xap/1.0/mm/" xmp:CreatorTool="Aplikasi lama">
   <dc:title><rdf:Alt><rdf:li xml:lang="x-default">Judul lama</rdf:li></rdf:Alt></dc:title>
   <xmpMM:DocumentID>uuid:1234</xmpMM:DocumentID>
  </rdf:Description>
  <rdf:Description rdf:about="" xmlns:photoshop="http://ns.adobe.com/photoshop/1.0/" xmlns:pdf="http://ns.adobe.com/pdf/1.3/">
   <photoshop:ColorMode>RGB</photoshop:ColorMode>
   <pdf:Producer>Producer lama</pdf:Producer>
  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
async function pdfWithXmp(xmp) {
  const doc = await PDFDocument.create();
  doc.addPage();
  const stream = doc.context.stream(new TextEncoder().encode(xmp), { Type: 'Metadata', Subtype: 'XML' });
  doc.catalog.set(PDFName.of('Metadata'), doc.context.register(stream));
  return new File([await doc.save()], 'input.pdf', { type: 'application/pdf' });
}
async function xmpOf(blob) {
  const doc = await PDFDocument.load(new Uint8Array(await blob.arrayBuffer()), { updateMetadata: false });
  const ref = doc.catalog.get(PDFName.of('Metadata'));
  const stream = doc.context.lookup(ref);
  return new TextDecoder().decode(stream.getContents());
}
test('parseXmp finds namespaces, descriptions, and attribute properties', () => {
  const result = parseXmp(XMP);
  assert.equal(result.ok, true);
  assert.equal(result.descriptions.length, 2);
  assert.equal(result.namespaces.dc, 'http://purl.org/dc/elements/1.1/');
  assert.ok(result.properties.some((prop) => prop.qualified === 'xmp:CreatorTool' && prop.form === 'attribute'));
  assert.ok(result.properties.some((prop) => prop.qualified === 'photoshop:ColorMode' && prop.form === 'element'));
});
test('xmpInventory extracts element, list, and attribute values', () => {
  const inventory = xmpInventory(XMP);
  assert.equal(inventory.ok, true);
  assert.equal(inventory.properties.find((property) => property.qualified === 'dc:title').value, 'Judul lama');
  assert.equal(inventory.properties.find((property) => property.qualified === 'xmp:CreatorTool').value, 'Aplikasi lama');
  assert.equal(inventory.properties.find((property) => property.qualified === 'photoshop:ColorMode').value, 'RGB');
});
test('read exposes the PDF XMP inventory', async () => {
  const file = await pdfWithXmp(XMP);
  const result = await read(file);
  assert.equal(result.xmp.ok, true);
  assert.ok(result.xmp.properties.some((property) => property.qualified === 'xmpMM:DocumentID' && property.value === 'uuid:1234'));
});
test('parseXmp rejects unbalanced packets', () => {
  const result = parseXmp('<x:xmpmeta><rdf:Description></x:xmpmeta>');
  assert.equal(result.ok, false);
  assert.match(result.error, /tidak cocok|tidak tertutup/);
});
test('buildXmp updates only the changed fields and preserves foreign nodes', () => {
  const result = buildXmp(XMP, { title: 'Judul baru', creator: 'MeInsert' }, ['title', 'creator']);
  assert.equal(result.fallback, false);
  assert.match(result.xml, /Judul baru/);
  assert.match(result.xml, /MeInsert/);
  assert.match(result.xml, /uuid:1234/);
  assert.match(result.xml, /photoshop:ColorMode>RGB/);
  assert.match(result.xml, /Producer lama/);
  assert.equal(parseXmp(result.xml).ok, true);
});
test('buildXmp keeps unrelated mapped fields when they are not changed', () => {
  const result = buildXmp(XMP, { title: 'Baru', producer: 'Jangan ditulis' }, ['title']);
  assert.match(result.xml, /Producer lama/);
  assert.doesNotMatch(result.xml, /Jangan ditulis/);
});
test('buildXmp removes a mapped field without touching the second description', () => {
  const result = buildXmp(XMP, {}, ['title']);
  assert.doesNotMatch(result.xml, /<dc:title/);
  assert.match(result.xml, /photoshop:ColorMode>RGB/);
  assert.equal(parseXmp(result.xml).ok, true);
});
test('buildXmp reports fallback for malformed XMP', () => {
  const result = buildXmp('<x:xmpmeta><rdf:Description></x:xmpmeta>', { title: 'X' }, ['title']);
  assert.equal(result.fallback, true);
  assert.equal(parseXmp(result.xml).ok, true);
});
test('write warns and recovers when the XMP packet is malformed', async () => {
  const file = await pdfWithXmp('<x:xmpmeta><rdf:Description></x:xmpmeta>');
  const out = await write(file, { set: { title: 'Pulih' }, remove: [] });
  assert.match(out.warnings.join(' '), /XMP lama tidak bisa dibaca/);
  const xmp = await xmpOf(out.blob);
  assert.match(xmp, /Pulih/);
  assert.equal(parseXmp(xmp).ok, true);
});
test('write preserves unknown XMP in a real PDF', async () => {
  const file = await pdfWithXmp(XMP);
  const out = await write(file, { set: { title: 'Judul PDF baru' }, remove: [] });
  const xmp = await xmpOf(out.blob);
  assert.match(xmp, /Judul PDF baru/);
  assert.match(xmp, /uuid:1234/);
  assert.match(xmp, /photoshop:ColorMode>RGB/);
  assert.match(xmp, /Producer lama/);
  assert.equal(out.xmp.ok, true);
  assert.ok(out.xmp.properties.some((property) => property.qualified === 'xmpMM:DocumentID'));
});
function snapshotWithXmp(xml, title = 'Judul lama') {
  return createSnapshot({
    adapter: { meta, fields },
    detection: { id: 'pdf', subtype: 'pdf', label: 'PDF' },
    readResult: {
      fields: { title },
      custom: [],
      raw: [{ group: 'Info', tag: '/Title', value: title }],
      info: { pages: 1 },
      xmp: xmpInventory(xml),
    },
  });
}
function pdfPlan(baseline) {
  return buildChangePlan({
    adapter: { meta, fields },
    detection: { id: 'pdf', subtype: 'pdf', label: 'PDF' },
    baseline,
    payload: { set: { title: 'Judul baru' } },
    outputName: 'doc-meinsert.pdf',
  });
}
test('verifyIntegrity fails when a foreign XMP property disappears', () => {
  const plan = pdfPlan(snapshotWithXmp(XMP));
  const after = snapshotWithXmp(XMP.replace(/\s*<xmpMM:DocumentID>uuid:1234<\/xmpMM:DocumentID>/, ''), 'Judul baru');
  const result = verifyIntegrity(plan, after);
  assert.equal(result.status, 'failed');
  assert.ok(result.findings.some((finding) => finding.code === 'XMP_LOST' && finding.target === 'xmp:xmpMM:DocumentID'));
});
test('verifyIntegrity fails when a foreign XMP property changes', () => {
  const plan = pdfPlan(snapshotWithXmp(XMP));
  const after = snapshotWithXmp(XMP.replace('uuid:1234', 'uuid:berubah'), 'Judul baru');
  const result = verifyIntegrity(plan, after);
  assert.equal(result.status, 'failed');
  assert.ok(result.findings.some((finding) => finding.code === 'XMP_CHANGED_UNEXPECTED' && finding.target === 'xmp:xmpMM:DocumentID'));
});
test('verifyIntegrity ignores XMP properties changed by the requested field', () => {
  const plan = pdfPlan(snapshotWithXmp(XMP));
  const after = snapshotWithXmp(XMP.replace('Judul lama', 'Judul baru'), 'Judul baru');
  const result = verifyIntegrity(plan, after);
  assert.equal(result.status, 'ok');
  assert.equal(result.findings.length, 0);
});
test('real PDF round-trip keeps XMP integrity ok', async () => {
  const file = await pdfWithXmp(XMP);
  const detection = { id: 'pdf', subtype: 'pdf', label: 'PDF' };
  const adapter = { meta, fields };
  const before = await read(file);
  const baseline = createSnapshot({ adapter, detection, readResult: before });
  const plan = buildChangePlan({
    adapter,
    detection,
    baseline,
    payload: { set: { title: 'Judul PDF baru' } },
    outputName: 'doc-meinsert.pdf',
  });
  const out = await write(file, plan.payload, { extension: 'pdf', mime: 'application/pdf' });
  const after = createSnapshot({ adapter, detection, readResult: out });
  const result = verifyIntegrity(plan, after);
  assert.equal(result.status, 'ok');
  assert.equal(result.findings.length, 0);
  assert.equal(after.xmp.properties.find((property) => property.qualified === 'xmpMM:DocumentID').value, 'uuid:1234');
});