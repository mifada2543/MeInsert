/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import { detectFile } from '../../assets/js/core/detector.js';
import { adapterForDetection } from '../../assets/js/core/registry.js';
import { MetadataClient } from '../../assets/js/core/worker-client.js';
import { createSnapshot } from '../../assets/js/core/metadata-snapshot.js';
import { buildChangePlan } from '../../assets/js/core/change-plan.js';
import { verifyIntegrity } from '../../assets/js/core/integrity.js';
import { isSupportedCover, mimeOf } from '../../assets/js/core/image-utils.js';

const client = new MetadataClient({ idleTimeout: 0 });
function check(condition, message) { if (!condition) throw new Error(message); }
async function fixture(name) {
  const response = await fetch(`/tests/fixtures/${name}`);
  check(response.ok, `Missing fixture ${name}`);
  return new globalThis.File([await response.arrayBuffer()], name);
}
function signatureHex(bytes) {
  const text = new TextDecoder('latin1').decode(bytes);
  return /\/Contents\s*<([0-9a-f]+)>/i.exec(text)?.[1]?.toLowerCase();
}
function base64(bytes) {
  const data = new Uint8Array(bytes); let text = '';
  for (let offset = 0; offset < data.length; offset += 8192) text += String.fromCharCode(...data.subarray(offset, offset + 8192));
  return btoa(text);
}
export async function runFixture(name, { reject = false, cover = false, signed = false } = {}) {
  const row = { fixture: name, format: '', read: '-', write: '-', reread: '-', invariants: '-', error: '' };
  try {
    const file = await fixture(name);
    const detection = await detectFile(file);
    check(detection, 'Detection failed');
    row.format = detection.subtype;
    const adapter = await adapterForDetection(detection);
    const options = { extension: detection.ext, subtype: detection.subtype, mime: detection.mime };
    const read = (input) => client.read(adapter.meta.engine, adapter.meta.id, input, options);
    const write = (input, payload) => client.write(adapter.meta.engine, adapter.meta.id, input, payload, options);
    if (reject) {
      const errors = [];
      for (const action of [() => read(file), () => write(file, { set: { title: 'Must reject' } })]) {
        try { await action(); errors.push(null); } catch (error) { errors.push(`${error.code}: ${error.message} ${error.detail || ''}`); }
      }
      row.read = errors[0] ? 'rejected' : 'ACCEPTED';
      row.write = errors[1] ? 'rejected' : 'ACCEPTED';
      check(errors.every(Boolean), `Unsupported Ogg must reject read AND write: ${JSON.stringify(errors)}`);
      check(errors.every((e) => /ogg|codec|vorbis|opus|didukung/i.test(e)), 'Rejection lacks a useful codec/container explanation');
      row.reread = 'n/a'; row.invariants = 'ok';
      return row;
    }
    const before = await read(file); row.read = 'ok';
    if (['pattern.jpg', 'pattern.png'].includes(name)) {
      check(before.fields.creator === 'MeInsert fixture', 'Real EXIF Artist was not read');
      check(before.fields.software === 'MeInsert generator', 'Real EXIF Software was not read');
      check(before.fields.dateTaken === '2026-01-02', 'Real EXIF DateTimeOriginal was not read');
      check(before.raw.some((r) => /XPKeywords/.test(r.tag)), 'Real EXIF XPKeywords missing');
      check(before.raw.some((r) => /XPTitle/.test(r.tag)), 'Real EXIF XPTitle missing');
    }
    if (name === 'mislabeled.jpg') check(detection.ext === 'png' && detection.warning, 'Mismatched extension must warn and follow PNG');
    const baseline = createSnapshot({ adapter, detection, readResult: before });
    const title = `Compatibility changed ${detection.subtype}`;
    const plan = buildChangePlan({ adapter, detection, baseline, payload: { set: { ...before.fields, title } }, outputName: `result.${detection.ext}` });
    check(plan.operations.length === 1 && plan.operations[0].id === 'title', 'Only changed title should be planned');
    check(Object.keys(plan.payload.set).join() === 'title', 'Unchanged fields leaked into write payload');
    const written = await write(file, plan.payload); row.write = 'ok';
    const output = new globalThis.File([written.blob], plan.outputName, { type: detection.mime });
    const actualDetection = await detectFile(output);
    check(actualDetection.id === detection.id && actualDetection.subtype === detection.subtype && actualDetection.ext === detection.ext,
      'Output extension/container differs from detected input format');
    const after = await read(output); row.reread = 'ok';
    if (signed || detection.id === 'mp4' || detection.subtype === 'tiff') row.outputBase64 = base64(await output.arrayBuffer());
    check(after.fields.title === title, `Title did not persist: ${JSON.stringify(after.fields.title)}`);
    const integrity = verifyIntegrity(plan, createSnapshot({ adapter, detection, readResult: after }));
    if (cover) {
      check(before.coverBytes?.byteLength > 0, 'Fixture must start with real embedded cover');
      const a = new Uint8Array(before.coverBytes), b = new Uint8Array(after.coverBytes || []);
      check(a.length === b.length && a.every((byte, i) => byte === b[i]), 'Ogg cover bytes changed/lost');
      row.coverBytes = 'preserved';
    }
    if (signed) {
      check(before.info.signed && before.warnings.some((w) => /tanda tangan/i.test(w)), 'Missing signed-PDF read warning');
      check(plan.risks.some((r) => r.code === 'SIGNED_PDF'), 'Missing pre-write signature risk warning');
      const original = signatureHex(await file.arrayBuffer());
      check(original && original === signatureHex(await output.arrayBuffer()), 'PDF signature Contents bytes changed');
      row.signatureContents = 'preserved';
      const oldBytes = new Uint8Array(await file.arrayBuffer()), newBytes = new Uint8Array(await output.arrayBuffer());
      const text = new TextDecoder('latin1').decode(oldBytes);
      const range = /\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/.exec(text).slice(1).map(Number);
      const coveredUnchanged = [0, 2].every((part) => {
        const start = range[part], length = range[part + 1];
        return oldBytes.subarray(start, start + length).every((b, i) => b === newBytes[start + i]);
      });
      row.signedRanges = coveredUnchanged ? 'unchanged' : 'CHANGED (signature invalidated, warned)';
      row.signatureValidity = coveredUnchanged ? 'NOT VERIFIED' : 'NOT PRESERVED';
      // Rewriting a PDF changes signed bytes. This is NOT a signature-validity assertion.
    }
    check(integrity.status !== 'failed', `Integrity: ${integrity.findings.filter((f) => f.severity === 'error').map((f) => `${f.code} ${f.target} (${String(f.before).slice(0, 70)} → ${String(f.after).slice(0, 70)})`).join('; ')}`);
    check(integrity.summary.unverified === 0, 'Integrity verification incomplete');
    row.invariants = 'ok';
    row.notes = integrity.findings.filter((f) => f.severity !== 'error').map((f) => f.code).join(', ');
  } catch (error) {
    row.invariants = 'FAIL'; row.error = `${error.message}${error.detail ? ` (${error.detail})` : ''}`;
  }
  return row;
}

export async function coverPolicy({ names = ['tone.mp3', 'tone.flac', 'tone.opus', 'tone.ogg', 'clip.mkv'], mp4Policy = true } = {}) {
  const rows = [];
  for (const ext of ['gif', 'bmp']) {
    const image = await fixture(`cover.${ext}`);
    const bytes = new Uint8Array(await image.arrayBuffer());
    if (mp4Policy) {
      check(!isSupportedCover(bytes, 'mp4'), `MP4 covr must reject ${ext}`);
      rows.push({ fixture: `MP4 ${ext} policy`, invariants: 'ok' });
    }
    for (const name of names) {
      const row = { fixture: `${name} + ${ext}`, invariants: 'FAIL', error: '' };
      try {
        const file = await fixture(name), detection = await detectFile(file);
        check(isSupportedCover(bytes, detection.id), `${detection.id} should accept ${ext}`);
        const adapter = await adapterForDetection(detection);
        const options = { extension: detection.ext, subtype: detection.subtype, mime: detection.mime };
        const written = await client.write(adapter.meta.engine, adapter.meta.id, file,
          { cover: { action: 'set', data: bytes, mimeType: mimeOf(bytes), name: image.name, kind: 'coverFront' } }, options);
        const result = await client.read(adapter.meta.engine, adapter.meta.id,
          new globalThis.File([written.blob], `cover.${detection.ext}`), options);
        const actual = new Uint8Array(result.coverBytes || []);
        check(bytes.length === actual.length && bytes.every((b, i) => b === actual[i]), 'Cover did not round-trip byte-exactly');
        row.invariants = 'ok';
      } catch (error) { row.error = `${error.message} ${error.detail || ''}`; }
      rows.push(row);
    }
  }
  return rows;
}
export function dispose() { client.dispose(); }
