/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — MeInsert Source-Available License v1.0 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { strFromU8, strToU8, unzipSync, zipSync } from '../../assets/vendor/fflate.mjs';
import { NS, parseXml } from '../../assets/js/core/office-xml.js';
import { verifyZipPreserved } from '../../assets/js/core/office-zip.js';
import { write } from '../../assets/js/formats/office.js';
function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (random, list) => list[Math.floor(random() * list.length)];
const DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const CT = `${DECL}<Types xmlns="${NS.ct}">`
  + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
  + '<Default Extension="xml" ContentType="application/xml"/>'
  + '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
  + '</Types>';
const RELS = `${DECL}<Relationships xmlns="${NS.rels}">`
  + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
  + '</Relationships>';
const DOC = `${DECL}<w:document xmlns:w="${NS.w}"><w:body><w:p><w:r><w:t>Isi</w:t></w:r></w:p></w:body></w:document>`;
const VALUES = [
  'Sederhana', 'A & B < C > D', 'Quote " dan \'', 'Unicode \u00e9 \u{1f600}',
  'Baris\tbaru', '&#64; literal escaped', '',
];
const hasXmllint = spawnSync('xmllint', ['--version'], { stdio: 'ignore' }).status === 0;
test('seeded namespace/prefix fuzz produces well-formed, namespace-valid XML', async () => {
  const random = rng(20261120);
  for (let index = 0; index < 30; index += 1) {
    const prefix = pick(random, ['d', 'dc', 'x', 'ns1', 'p_2']);
    const hasTitle = random() > 0.4;
    const rootAttrs = prefix === 'dc'
      ? `xmlns:cp="${NS.cp}" xmlns:dc="${NS.dc}"`
      : (random() > 0.5
        ? `xmlns:cp="${NS.cp}" xmlns:${prefix}="${NS.dc}"`
        : `xmlns:cp="${NS.cp}" xmlns:dc="${NS.dc}" xmlns:${prefix}="${NS.dc}"`);
    const value = pick(random, VALUES);
    if (!value && !hasTitle) continue;
    const core = `${DECL}<cp:coreProperties ${rootAttrs}>`
      + (hasTitle ? `<${prefix}:title>Seed</${prefix}:title>` : '')
      + '</cp:coreProperties>';
    const source = zipSync({
      '[Content_Types].xml': strToU8(CT),
      '_rels/.rels': strToU8(RELS),
      'word/document.xml': strToU8(DOC),
      'docProps/core.xml': strToU8(core),
    });
    const result = await write(new File([source], 'fuzz.docx'), { set: { title: value } }, { subtype: 'docx' });
    const parts = unzipSync(new Uint8Array(await result.blob.arrayBuffer()));
    const xml = strFromU8(parts['docProps/core.xml']);
    const parsed = parseXml(xml, 'core');
    const found = parsed.findAll(NS.dc, 'title');
    if (!value.trim()) {
      assert.equal(found.length, 0, `iteration ${index}: empty value must remove the field`);
    } else {
      assert.equal(found.length, 1, `iteration ${index}: expected exactly one dc title`);
      assert.equal(parsed.value(found[0]).trim(), value.trim(), `iteration ${index}: value mismatch`);
    }
    if (hasXmllint && index < 6) {
      const check = spawnSync('xmllint', ['--noout', '-'], { input: parts['docProps/core.xml'], stdio: ['pipe', 'ignore', 'pipe'] });
      assert.equal(check.status, 0, `iteration ${index}: ${check.stderr.toString()}`);
    }
  }
});
test('seeded ZIP entry ordering and comments preserve every non-target entry', async () => {
  const random = rng(4711);
  for (let index = 0; index < 12; index += 1) {
    const entries = new Map([
      ['[Content_Types].xml', strToU8(CT)],
      ['_rels/.rels', strToU8(RELS)],
      ['word/document.xml', strToU8(DOC)],
      ['docProps/core.xml', strToU8(`${DECL}<cp:coreProperties xmlns:cp="${NS.cp}"/>`)],
    ]);
    for (let item = 0; item < 6; item += 1) {
      const media = new Uint8Array(32);
      for (let byte = 0; byte < media.length; byte += 1) media[byte] = Math.floor(random() * 256);
      entries.set(`word/media/image${item}.bin`, media);
    }
    const shuffled = [...entries.entries()].sort(() => random() - 0.5);
    const source = zipSync(Object.fromEntries(shuffled));
    const result = await write(new File([source], 'order.docx'), { set: { title: 'Order' } }, { subtype: 'docx' });
    const after = new Uint8Array(await result.blob.arrayBuffer());
    const preserved = await verifyZipPreserved(source, after, ['docProps/core.xml']);
    assert.equal(preserved.ok, true, `iteration ${index}: ${preserved.changed.join(', ')}`);
  }
});