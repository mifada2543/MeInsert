/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — MeInsert Source-Available License v1.0 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSnapshot } from '../../assets/js/core/metadata-snapshot.js';
import { buildChangePlan } from '../../assets/js/core/change-plan.js';
import { verifyIntegrity } from '../../assets/js/core/integrity.js';
const adapter = { meta: { id: 'mp3', label: 'MP3' }, fields: [] };
const detection = { id: 'mp3', subtype: 'mp3', label: 'MP3' };
const regions = [{ length: 2, hash: 'a'.repeat(64) }];
const proof = { valid: true, algorithm: 'av-range-v1', regions };
function makePlan(trim, { trimProof = null, chapterCount = 0, attachmentCount = 0 } = {}) {
  const baseline = createSnapshot({
    adapter,
    detection,
    readResult: {
      fields: {},
      raw: [],
      custom: [],
      info: { chapterCount, attachmentCount },
      mediaProof: { valid: true, kind: 'av-v1', algorithm: 'sha256-chunks-v1', regions: [{ length: 100, hash: 'a'.repeat(64) }] },
    },
  });
  const plan = buildChangePlan({
    adapter,
    detection,
    baseline,
    payload: { trim },
    outputName: 'out.mp3',
    source: 'single',
  });
  if (trimProof) plan.trimProof = trimProof;
  return plan;
}
function makeAfter({ rangeRegions = regions, duration = 5, chapterCount = 0, attachmentCount = 0 } = {}) {
  return createSnapshot({
    adapter,
    detection,
    readResult: {
      fields: {},
      raw: [],
      custom: [],
      info: { duration, chapterCount, attachmentCount },
      rangeProof: { valid: true, algorithm: 'av-range-v1', regions: rangeRegions },
      mediaProof: { valid: true, kind: 'av-v1', algorithm: 'sha256-chunks-v1', regions: [{ length: 100, hash: 'b'.repeat(64) }] },
    },
  });
}
test('a trim proof suppresses MEDIA_PAYLOAD_CHANGED for the rewritten payload', () => {
  const after = makeAfter();
  const withoutProof = verifyIntegrity(makePlan({ start: 0, end: 5, mode: 'copy' }), after);
  assert.ok(withoutProof.findings.some((finding) => finding.code === 'MEDIA_PAYLOAD_CHANGED'));
  const withProof = verifyIntegrity(makePlan({ start: 0, end: 5, mode: 'copy' }, { trimProof: proof }), after);
  assert.equal(withProof.findings.some((finding) => finding.code === 'MEDIA_PAYLOAD_CHANGED'), false);
  assert.equal(withProof.findings.some((finding) => finding.code === 'CUT_RANGE_MISMATCH'), false);
  assert.equal(withProof.findings.some((finding) => finding.code === 'CUT_DURATION_MISMATCH'), false);
});
test('a changed range proof raises CUT_RANGE_MISMATCH as an error', () => {
  const plan = makePlan({ start: 0, end: 5, mode: 'copy' }, { trimProof: proof });
  const after = makeAfter({ rangeRegions: [{ length: 3, hash: 'c'.repeat(64) }] });
  const finding = verifyIntegrity(plan, after).findings.find((item) => item.code === 'CUT_RANGE_MISMATCH');
  assert.ok(finding);
  assert.equal(finding.severity, 'error');
});
test('a cut duration outside the 0.25s tolerance raises CUT_DURATION_MISMATCH', () => {
  const plan = makePlan({ start: 0, end: 5, mode: 'copy' }, { trimProof: proof });
  const off = verifyIntegrity(plan, makeAfter({ duration: 6 }));
  const finding = off.findings.find((item) => item.code === 'CUT_DURATION_MISMATCH');
  assert.ok(finding);
  assert.equal(finding.severity, 'error');
  const ok = verifyIntegrity(plan, makeAfter({ duration: 5.1 }));
  assert.equal(ok.findings.some((item) => item.code === 'CUT_DURATION_MISMATCH'), false);
});
test('trim records chapters and attachments as known loss', () => {
  const plan = makePlan({ start: 0, end: 5, mode: 'copy' }, { trimProof: proof, chapterCount: 2, attachmentCount: 1 });
  const after = makeAfter({ chapterCount: 2, attachmentCount: 1 });
  const report = verifyIntegrity(plan, after);
  assert.ok(report.knownLoss.some((item) => item.code === 'CUT_CHAPTERS_LOST'));
  assert.ok(report.knownLoss.some((item) => item.code === 'CUT_ATTACHMENTS_LOST'));
});
test('container-derived MP4 metadata changed by a cut is a known change, not an error', () => {
  const mp4 = { meta: { id: 'mp4', label: 'MP4' }, fields: [{ id: 'date', label: 'Tanggal' }] };
  const mp4Detection = { id: 'mp4', subtype: 'mp4', label: 'MP4' };
  const baseline = createSnapshot({
    adapter: mp4,
    detection: mp4Detection,
    readResult: {
      fields: { date: '' },
      raw: [
        { group: 'QuickTime', tag: 'Duration', value: '20.00 s' },
        { group: 'QuickTime', tag: 'TimeScale', value: '1000' },
      ],
      custom: [],
      info: {},
      mediaProof: { valid: true, kind: 'av-v1', algorithm: 'sha256-chunks-v1', regions: [{ length: 100, hash: 'a'.repeat(64) }] },
    },
  });
  const plan = buildChangePlan({
    adapter: mp4,
    detection: mp4Detection,
    baseline,
    payload: { trim: { start: 0, end: 1, mode: 'copy' } },
    outputName: 'out.mp4',
    source: 'single',
  });
  plan.trimProof = proof;
  const after = createSnapshot({
    adapter: mp4,
    detection: mp4Detection,
    readResult: {
      fields: { date: '2026:11:21' },
      raw: [
        { group: 'QuickTime', tag: 'Duration', value: '1.00 s' },
        { group: 'QuickTime', tag: 'TimeScale', value: '57600' },
      ],
      custom: [],
      info: { duration: 1 },
      rangeProof: proof,
      mediaProof: { valid: true, kind: 'av-v1', algorithm: 'sha256-chunks-v1', regions: [{ length: 100, hash: 'b'.repeat(64) }] },
    },
  });
  const report = verifyIntegrity(plan, after);
  assert.equal(report.findings.some((finding) => finding.severity === 'error'), false,
    JSON.stringify(report.findings.filter((finding) => finding.severity === 'error')));
  assert.ok(report.knownLoss.some((item) => item.code === 'CUT_CONTAINER_METADATA'));
});
test('cut rejects an invalid or mismatched proof even if both region arrays are empty', () => {
  const plan = makePlan({ start: 0, end: 5, mode: 'copy' }, {
    trimProof: { valid: false, algorithm: 'mp3-frames-v1', regions: [] },
  });
  const after = makeAfter();
  after.rangeProof = { valid: false, algorithm: 'mp3-frames-v1', regions: [] };
  assert.ok(verifyIntegrity(plan, after).findings.some((finding) => finding.code === 'CUT_RANGE_MISMATCH'));
  plan.trimProof = { valid: true, algorithm: 'mp3-frames-v1', regions };
  after.rangeProof = { valid: true, algorithm: 'av-range-v1', regions };
  assert.ok(verifyIntegrity(plan, after).findings.some((finding) => finding.code === 'CUT_RANGE_MISMATCH'));
});