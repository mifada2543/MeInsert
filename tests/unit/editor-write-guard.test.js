/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — MeInsert Source-Available License v1.0 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { preserveFailedWrite, allowResultDownload, isCommittedResult } from '../../assets/js/core/write-guard.js';
test('failed integrity preserves original file, baseline, edited fields, and removal operations', () => {
  const original = new File(['original'], 'source.txt');
  const baseline = { fields: { title: 'original' } };
  const state = {
    file: original,
    baselineSnapshot: baseline,
    values: { title: 'edited' },
    removedFields: new Set(['author']),
    result: null,
  };
  const result = { blob: new Blob(['changed']), filename: 'output.txt', integrity: { status: 'failed' } };
  assert.equal(preserveFailedWrite(state, result), true);
  assert.equal(state.file, original);
  assert.equal(state.baselineSnapshot, baseline);
  assert.deepEqual(state.values, { title: 'edited' });
  assert.equal(state.removedFields.has('author'), true);
  assert.equal(state.result, result);
});
test('passing results proceed through normal commit path', () => {
  const state = { file: 'original', result: null };
  assert.equal(preserveFailedWrite(state, { integrity: { status: 'ok' } }), false);
  assert.equal(state.result, null);
});
test('download guard denies a failed result without consent', () => {
  const result = { blob: new Blob(['unsafe']), integrity: { status: 'failed' } };
  let prompts = 0;
  assert.equal(allowResultDownload(result, () => { prompts++; return false; }), false);
  assert.equal(prompts, 1);
  assert.equal(allowResultDownload(result, () => true), true);
});
test('download guard allows safe output, rejects empty output', () => {
  assert.equal(allowResultDownload({ blob: new Blob(['safe']), integrity: { status: 'ok' } }, () => { throw Error('unexpected prompt'); }), true);
  assert.equal(allowResultDownload({ integrity: { status: 'ok' } }, () => true), false);
});
test('failed results must not trigger post-save cleanup of pending removals', () => {
  assert.equal(isCommittedResult({ integrity: { status: 'failed' } }), false);
  assert.equal(isCommittedResult({ integrity: { status: 'ok' } }), true);
  assert.equal(isCommittedResult(null), false);
});