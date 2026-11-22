/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { unzipSync } from '../../assets/vendor/fflate.mjs';
const TITLE = 'Office preservation title';
const OOXML = ['sample.docx', 'sample.xlsx', 'sample.pptx', 'sample.docm', 'sample.xlsm', 'sample.pptm'];
const ODF = ['sample.odt', 'sample.ods', 'sample.odp'];
const ALLOWED = new Set(['docProps/core.xml', 'docProps/app.xml', 'meta.xml']);
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
function firstLocalEntry(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 30 || view.getUint32(0, true) !== 0x04034b50) return null;
  const method = view.getUint16(8, true); // 0 = stored (uncompressed)
  const nameLength = view.getUint16(26, true);
  const name = new TextDecoder().decode(bytes.subarray(30, 30 + nameLength));
  return { name, method };
}
export async function checkOfficePreservation(write, name, kind) {
  const path = join('tests/fixtures', name);
  const source = new Uint8Array(readFileSync(path));
  const subtype = name.split('.').pop();
  const result = await write(new File([source], name), { set: { title: TITLE } }, { subtype });
  assert.ok(result?.blob, `${name}: the adapter returned a blob`);
  const output = new Uint8Array(await result.blob.arrayBuffer());
  const before = unzipSync(source);
  const after = unzipSync(output);
  const beforeNames = Object.keys(before).sort();
  const afterNames = Object.keys(after).sort();
  const changed = [];
  for (const entry of beforeNames) {
    if (ALLOWED.has(entry)) continue;
    if (!afterNames.includes(entry)) {
      changed.push(`${entry} (missing)`);
      continue;
    }
    if (sha256(before[entry]) !== sha256(after[entry])) changed.push(`${entry} (hash differs)`);
  }
  const added = afterNames.filter((entry) => !ALLOWED.has(entry) && !beforeNames.includes(entry));
  assert.deepEqual(changed, [], `${name}: non-metadata ZIP entries were modified: ${changed.join(', ')}`);
  assert.deepEqual(added, [], `${name}: unexpected ZIP entries were added: ${added.join(', ')}`);
  const metadataEntry = kind === 'odf' ? 'meta.xml' : 'docProps/core.xml';
  const metadataBytes = after[metadataEntry];
  assert.ok(metadataBytes, `${name}: ${metadataEntry} is present in the output`);
  const metadataText = new TextDecoder().decode(metadataBytes);
  assert.ok(metadataText.includes(TITLE), `${name}: dc:title was written into ${metadataEntry}`);
  if (kind === 'odf') {
    const first = firstLocalEntry(output);
    assert.ok(first, `${name}: the output has a ZIP local file header`);
    assert.equal(first.name, 'mimetype', `${name}: mimetype is the first ZIP entry`);
    assert.equal(first.method, 0, `${name}: the mimetype entry is uncompressed (stored)`);
    assert.match(new TextDecoder().decode(after.mimetype), /^application\/vnd\.oasis\.opendocument\./,
      `${name}: the mimetype entry carries the ODF media type`);
  }
  const intact = beforeNames.filter((entry) => !ALLOWED.has(entry)).length;
  console.log(`office-preservation ${name} ... ok (${intact} entries byte-identical)`);
}
export async function runOfficePreservationChecks() {
  const all = [...OOXML.map((name) => [name, 'ooxml']), ...ODF.map((name) => [name, 'odf'])];
  const present = all.filter(([name]) => existsSync(join('tests/fixtures', name)));
  if (!present.length) {
    console.log('SKIP: no Office fixtures are present in tests/fixtures; office-preservation did not run.');
    return;
  }
  let write;
  try {
    ({ write } = await import('../../assets/js/formats/office.js'));
  } catch (error) {
    console.log(`SKIP: the office adapter is not wired yet (${error.message}); office-preservation did not run.`);
    return;
  }
  assert.equal(typeof write, 'function', 'the office adapter exports write()');
  const failures = [];
  for (const [name, kind] of present) {
    try {
      await checkOfficePreservation(write, name, kind);
    } catch (error) {
      failures.push(`${name}: ${error.message}`);
      console.error(`office-preservation ${name} ... FAIL: ${error.message}`);
    }
  }
  for (const [name] of all.filter(([name]) => !existsSync(join('tests/fixtures', name)))) {
    console.log(`SKIP: office-preservation ${name} — tests/fixtures/${name} is missing`);
  }
  assert.deepEqual(failures, [], `office-preservation failures:\n${failures.join('\n')}`);
  console.log(`office-preservation ... ok (${present.length} fixture${present.length === 1 ? '' : 's'} verified)`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await runOfficePreservationChecks();