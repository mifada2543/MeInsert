/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createEditorState, setTrim } from '../../assets/js/editor/editor-state.js';
import { collectChanges } from '../../assets/js/editor/editor-changes.js';
import { buildChangePlan } from '../../assets/js/core/change-plan.js';
import { createSnapshot } from '../../assets/js/core/metadata-snapshot.js';
const adapter = {
  meta: { id: 'mp3', engine: 'media', label: 'MP3' },
  fields: [{ id: 'title', label: 'Judul', type: 'text', native: 'TIT2' }],
  fieldsFor: () => [{ id: 'title', label: 'Judul', type: 'text', native: 'TIT2' }],
};
const detection = { id: 'mp3', ext: 'mp3', subtype: 'mp3', mime: 'audio/mpeg', label: 'MP3' };
function makeState(trim, id = 'mp3') {
  const localAdapter = { ...adapter, meta: { ...adapter.meta, id } };
  const localDetection = { ...detection, id };
  const state = createEditorState();
  state.adapter = localAdapter;
  state.detection = localDetection;
  state.values = { title: 'Judul' };
  state.originalValues = { title: 'Judul' };
  if (trim) setTrim(state, trim);
  return { state, localAdapter, localDetection };
}
function makePlan(trim, id = 'mp3') {
  const { state, localAdapter, localDetection } = makeState(trim, id);
  const changes = collectChanges(state);
  const baseline = createSnapshot({
    adapter: localAdapter,
    detection: localDetection,
    readResult: { fields: { title: 'Judul' }, raw: [], custom: [], info: { duration: 120 } },
  });
  const plan = buildChangePlan({
    adapter: localAdapter,
    detection: localDetection,
    baseline,
    payload: changes.payload,
    outputName: 'out.mp3',
    source: 'single',
  });
  return { changes, plan };
}
test('collectChanges reports a trim as one change and clones the range', () => {
  const { state } = makeState({ start: 2, end: 5, mode: 'copy' });
  const changes = collectChanges(state);
  assert.equal(changes.count, 1);
  assert.deepEqual(changes.payload.trim, { start: 2, end: 5, mode: 'copy' });
  assert.notEqual(changes.payload.trim, state.trim);
});
test('no trim leaves no trim key in the payload', () => {
  const { state } = makeState(null);
  const changes = collectChanges(state);
  assert.equal(changes.count, 0);
  assert.equal(Object.hasOwn(changes.payload, 'trim'), false);
});
test('buildChangePlan creates a trim operation with a local mm:ss.mmm label', () => {
  const { plan } = makePlan({ start: 2.5, end: 10, mode: 'copy' });
  const op = plan.operations.find((item) => item.kind === 'trim');
  assert.ok(op, 'trim operation must exist');
  assert.equal(op.action, 'apply');
  assert.equal(op.before, 120);
  assert.equal(op.after, 7.5);
  assert.match(op.label, /00:02\.500/);
  assert.match(op.label, /00:10\.000/);
  assert.match(op.label, /00:07\.500/);
  assert.equal(op.source, 'single');
  assert.deepEqual(plan.payload.trim, { start: 2.5, end: 10, mode: 'copy' });
  assert.equal(plan.hasOperations, true);
});
test('trim risks are warnings and depend on mode and format', () => {
  const copy = makePlan({ start: 0, end: 5, mode: 'copy' }).plan;
  const copyCodes = copy.risks.map((risk) => risk.code);
  assert.ok(copyCodes.includes('CUT_REWRITE'));
  assert.ok(!copyCodes.includes('CUT_TRANSCODE'));
  assert.ok(copyCodes.includes('CUT_CHAPTERS'));
  assert.ok(copyCodes.includes('CUT_XING')); // Xing source header must be dropped even for a cut from zero
  assert.ok(copy.risks.filter((risk) => risk.code.startsWith('CUT_')).every((risk) => risk.severity === 'warning'));
  const precise = makePlan({ start: 2, end: 5, mode: 'precise' }).plan;
  const preciseCodes = precise.risks.map((risk) => risk.code);
  assert.ok(preciseCodes.includes('CUT_TRANSCODE'));
  assert.ok(preciseCodes.includes('CUT_XING'));
  const mkv = makePlan({ start: 0, end: 5, mode: 'copy' }, 'mkv').plan;
  assert.ok(mkv.risks.some((risk) => risk.code === 'CUT_CHAPTERS'));
  const mp4 = makePlan({ start: 0, end: 5, mode: 'precise' }, 'mp4').plan;
  assert.ok(!mp4.risks.some((risk) => risk.code === 'CUT_CHAPTERS'));
});