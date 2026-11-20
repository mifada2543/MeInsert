/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseXml } from '../../assets/js/core/office-xml.js';
import { inspectZip } from '../../assets/js/core/office-zip.js';
import { zipSync, strToU8 } from '../../assets/vendor/fflate.mjs';
import { validateOfficePackage } from '../../assets/js/core/office-package.js';
import { NS } from '../../assets/js/core/office-xml.js';
for (const xml of ['<p:r/>', '<r a="<"/>', 'oops<r/>', '<r>&unknown;</r>', '<r></r extra>', '<r xmlns:a="u" xmlns:b="u" a:x="1" b:x="2"/>', '<r a="1"b="2"/>', '<r/ >', '<r>]]></r>', '<r><!--a--b--></r>', '<r xmlns:xml="wrong"/>', '<r/>tail', '<r a="&foo;"/>']) {
  test(`reject malformed XML ${xml}`, () => assert.throws(() => parseXml(xml), { code: 'INVALID_XML' }));
}
test('namespace shadowing does not bind newly inserted elements to wrong URI', () => {
  const doc = parseXml('<r xmlns:p="urn:good"><child xmlns:p="urn:bad"/></r>');
  doc.insert(doc.find('', 'child'), { uri: 'urn:good', local: 'title', value: 'test', preferredPrefix: 'p' });
  assert.equal(parseXml(doc.toString()).find('urn:good', 'title').local, 'title');
});
test('main Office part follows relationship and is not subject to preview size cap', async () => {
  const path = 'custom/main.xml';
  const zip = zipSync({
    '[Content_Types].xml': strToU8(`<Types xmlns="${NS.ct}"><Override PartName="/${path}" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`),
    '_rels/.rels': strToU8(`<Relationships xmlns="${NS.rels}"><Relationship Id="r1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="${path}"/></Relationships>`),
    [path]: [strToU8(`<w:document xmlns:w="${NS.w}"><w:body>${' '.repeat(2 * 1024 * 1024 + 1)}</w:body></w:document>`), { level: 0 }],
  });
  const inspected = await inspectZip(zip);
  assert.equal(validateOfficePackage(inspected).packageValid, true);
});
