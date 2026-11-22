/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — MeInsert Source-Available License v1.0 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createEditorState, setSidecar, cloneSidecar } from '../../assets/js/editor/editor-state.js';
import { collectChanges } from '../../assets/js/editor/editor-changes.js';
import { buildChangePlan } from '../../assets/js/core/change-plan.js';
import { beginChange, endChange, undo, redo } from '../../assets/js/core/history.js';
const SAMPLE = {
  lyrics: { lang: 'id', lines: [{ time: 1200, text: 'Baris satu' }] },
  subtitles: { lang: 'id', cues: [{ id: '1', start: 500, end: 1200, text: 'Halo', settings: '' }] },
};
const context = () => ({
  adapter: {
    meta: { id: 'mp3', engine: 'media' },
    fields: [{ id: 'title', type: 'text', native: 'TIT2' }],
    fieldsFor: () => [{ id: 'title', type: 'text', native: 'TIT2' }],
  },
  detection: { id: 'mp3', ext: 'mp3', subtype: null, mime: 'audio/mpeg' },
});
test('setSidecar clones its payload so callers cannot mutate editor state', () => {
  const state = createEditorState();
  setSidecar(state, SAMPLE);
  SAMPLE.lyrics.lines[0].text = 'diubah';
  assert.equal(state.sidecar.lyrics.lines[0].text, 'Baris satu');
  assert.notEqual(state.sidecar, SAMPLE);
});
test('sidecar is included in collectChanges and produces a sidecar operation', () => {
  const state = createEditorState();
  const ctx = context();
  state.adapter = ctx.adapter;
  state.detection = ctx.detection;
  state.values = { title: 'Judul' };
  state.originalValues = { title: 'Judul' };
  setSidecar(state, SAMPLE);
  const changes = collectChanges(state);
  assert.deepEqual(changes.payload.sidecar, SAMPLE);
  assert.ok(changes.count >= 1);
  const plan = buildChangePlan({
    adapter: ctx.adapter,
    detection: ctx.detection,
    baseline: { adapter: ctx.adapter, detection: ctx.detection, values: { title: 'Judul' }, raw: [], custom: [] },
    payload: changes.payload,
    outputName: 'out.mp3',
    source: 'single',
  });
  const sidecarOps = plan.operations.filter((op) => op.kind === 'sidecar');
  assert.equal(sidecarOps.length, 1);
  assert.equal(sidecarOps[0].lyricLines, 1);
  assert.equal(sidecarOps[0].subtitleCues, 1);
  assert.deepEqual(plan.payload.sidecar, SAMPLE);
});
test('no sidecar means no sidecar key in the final payload', () => {
  const state = createEditorState();
  const ctx = context();
  state.adapter = ctx.adapter;
  state.detection = ctx.detection;
  state.values = { title: 'Baru' };
  state.originalValues = { title: 'Lama' };
  const changes = collectChanges(state);
  const plan = buildChangePlan({
    adapter: ctx.adapter,
    detection: ctx.detection,
    baseline: { adapter: ctx.adapter, detection: ctx.detection, values: { title: 'Lama' }, raw: [], custom: [] },
    payload: changes.payload,
    outputName: 'out.mp3',
    source: 'single',
  });
  assert.ok(!Object.hasOwn(plan.payload, 'sidecar'));
});
test('sidecar participates in undo and redo', () => {
  const state = createEditorState();
  beginChange(state.history, 'sidecar');
  setSidecar(state, SAMPLE);
  endChange(state.history);
  assert.deepEqual(state.sidecar, SAMPLE);
  assert.equal(undo(state.history), true);
  assert.equal(state.sidecar, null);
  assert.equal(redo(state.history), true);
  assert.deepEqual(state.sidecar, cloneSidecar(SAMPLE));
});