/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — MeInsert Source-Available License v1.0 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAdapter } from '../../assets/js/core/registry.js';
import { detectFile } from '../../assets/js/core/detector.js';
import { createSnapshot } from '../../assets/js/core/metadata-snapshot.js';
import { buildChangePlan } from '../../assets/js/core/change-plan.js';
import { verifyIntegrity } from '../../assets/js/core/integrity.js';
import { zipSync, strToU8, strFromU8, unzipSync } from '../../assets/vendor/fflate.mjs';
const root = join(fileURLToPath(new URL('../..', import.meta.url)), 'tests', 'fixtures');
const file = (name, bytes) => new File([bytes ?? readFileSync(join(root, name))], name);
const tasks = [];
const check = (name, fn) => tasks.push((async () => {
  try { return { name, status: 'PASS', detail: String(await fn() || '') }; }
  catch (error) { return { name, status: 'FAIL', detail: `${error.message}${error.detail ? ` | ${error.detail}` : ''}` }; }
})());
for (const name of [
  'sample.docx', 'sample.xlsx', 'sample.pptx', 'sample.docm', 'sample.xlsm', 'sample.pptm',
  'sample.odt', 'sample.ods', 'sample.odp', 'tone.mp3', 'tone.flac', 'tone.ogg',
  'tone.opus', 'clip.mkv', 'clip.webm', 'document.pdf',
]) {
  await check(`roundtrip ${name}`, async () => {
    const f = file(name);
    const d = await detectFile(f);
    const adapter = await getAdapter(d.id);
    const opts = { subtype: d.subtype, extension: d.ext, mime: d.mime };
    const out = await adapter.write(f, { set: { title: 'Audit ulang 2026' } }, opts, () => {});
    const after = await adapter.read(file(name, new Uint8Array(await out.blob.arrayBuffer())), opts);
    if (after.fields.title !== 'Audit ulang 2026') throw new Error(`title mismatch: ${after.fields.title}`);
    return d.subtype;
  });
}
await check('prefix namespace read', async () => {
  const native = unzipSync(readFileSync(join(root, 'sample.docx')));
  const obj = { ...native };
  obj['docProps/core.xml'] = strToU8(strFromU8(native['docProps/core.xml']).replaceAll('dc:', 'd:').replaceAll('xmlns:dc=', 'xmlns:d='));
  const adapter = await getAdapter('office');
  const result = await adapter.read(file('prefix.docx', zipSync(obj)), { subtype: 'docx' });
  if (!String(result.fields.title || '').trim()) throw new Error('title empty after prefix rename');
  return result.fields.title;
});
await check('padded ZIP detection', async () => {
  const native = unzipSync(readFileSync(join(root, 'sample.xlsx')));
  const obj = { 'padding.bin': [new Uint8Array(12000), { level: 0 }], ...native };
  const d = await detectFile(file('wrong.xlsx', zipSync(obj)));
  if (d.id !== 'office' || d.subtype !== 'xlsx') throw new Error(`detected ${JSON.stringify(d)}`);
  return d.subtype;
});
await check('generic ZIP rejected', async () => {
  const bytes = zipSync({ 'test.txt': strToU8('not a document') });
  const d = await detectFile(file('generic.docx', bytes));
  const adapter = await getAdapter('office');
  let readErr = null;
  try { await adapter.read(file('generic.docx', bytes), { subtype: 'docx' }); } catch (e) { readErr = e; }
  if (!readErr) throw new Error(`generic ZIP accepted by read; detection=${JSON.stringify(d)}`);
  return readErr.code || readErr.message;
});
await check('ODF signature detected', async () => {
  const original = unzipSync(readFileSync(join(root, 'sample.odt')));
  const mimetype = original.mimetype;
  delete original.mimetype;
  const odf = { mimetype: [mimetype, { level: 0 }], ...original, 'META-INF/documentsignatures.xml': strToU8('<document-signatures/>') };
  const adapter = await getAdapter('office');
  const result = await adapter.read(file('signed.odt', zipSync(odf)), { subtype: 'odt' });
  if (!result.info.signed) throw new Error('signed=false');
  return 'signed=true';
});
for (const name of ['tone.ogg', 'tone.opus', 'tone.mp3', 'clip.mkv']) {
  await check(`integrity ${name}`, async () => {
    const f = file(name);
    const d = await detectFile(f);
    const adapter = await getAdapter(d.id);
    const opts = { subtype: d.subtype, extension: d.ext, mime: d.mime };
    const before = await adapter.read(f, opts);
    const baseline = createSnapshot({ adapter, detection: d, readResult: before });
    const plan = buildChangePlan({
      adapter, detection: d, baseline,
      payload: { set: { title: 'Audit ulang 2026' } }, outputName: name, source: 'single',
    });
    const result = await adapter.write(f, plan.payload, opts, () => {});
    const after = createSnapshot({ adapter, detection: d, readResult: result });
    const integrity = verifyIntegrity(plan, after);
    const lost = integrity.findings.filter((item) => item.code === 'STRUCTURE_LOST' && /sampleRate|channels/.test(item.target));
    if (lost.length) throw new Error(`STRUCTURE_LOST: ${lost.map((item) => item.target).join(',')}`);
    return `${integrity.status}; ${integrity.findings.map((item) => `${item.severity}:${item.code}`).join(',') || 'no findings'}`;
  });
}
const rows = await Promise.all(tasks);
let fail = 0;
for (const { name, status, detail } of rows) {
  if (status === 'FAIL') fail += 1;
  console.log(`${status} ${name}${detail ? ` — ${detail}` : ''}`);
}
console.log(`${rows.length - fail}/${rows.length} audit cases passed`);
if (fail) process.exitCode = 1;