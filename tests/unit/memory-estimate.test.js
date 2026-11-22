/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — MeInsert Source-Available License v1.0 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MEMORY_WARN_MB,
  MEMORY_BLOCK_MB,
  estimateMemory,
  estimateForSingle,
  estimateForCut,
  estimateForBatch,
  canProceedWithMemory,
} from '../../assets/js/core/memory-estimate.js';
test('estimateMemory keeps the original thresholds', () => {
  assert.equal(MEMORY_WARN_MB, 350);
  assert.equal(MEMORY_BLOCK_MB, 900);
  assert.equal(estimateMemory({ inputSizes: [64 * 1024 * 1024] }).level, 'ok');
  assert.equal(estimateMemory({ inputSizes: [1024 * 1024 * 1024] }).level, 'block');
});
test('observed peak raises the risk level without changing the rough inputs', () => {
  const rough = estimateMemory({ inputSizes: [10 * 1024 * 1024] });
  const observed = estimateMemory({ inputSizes: [10 * 1024 * 1024], observedPeakMb: 500 });
  assert.equal(rough.level, 'ok');
  assert.equal(observed.level, 'warn');
  assert.ok(observed.estimatedMb >= 500);
  assert.equal(observed.breakdown.observedPeakMb, 500);
  assert.equal(observed.breakdown.inputs, rough.breakdown.inputs);
});
test('canProceedWithMemory enforces the same policy on every save path', () => {
  assert.deepEqual(canProceedWithMemory(null), { allowed: true, reason: 'ok' });
  assert.deepEqual(canProceedWithMemory({ level: 'ok' }), { allowed: true, reason: 'ok' });
  assert.deepEqual(canProceedWithMemory({ level: 'warn' }), { allowed: true, reason: 'warn' });
  assert.deepEqual(canProceedWithMemory({ level: 'block' }), { allowed: false, reason: 'blocked' });
  assert.deepEqual(canProceedWithMemory({ level: 'block' }, { lowMemory: true }), { allowed: true, reason: 'acknowledged' });
  assert.deepEqual(canProceedWithMemory({ level: 'block' }, { memoryOverride: true }), { allowed: true, reason: 'acknowledged' });
});
test('estimateForCut holds two buffers when an intermediate file is involved', () => {
  const direct = estimateForCut({ fileSize: 100 * 1024 * 1024 });
  const intermediate = estimateForCut({ fileSize: 100 * 1024 * 1024, intermediate: true, observedPeakMb: 400 });
  assert.equal(direct.breakdown.held, 100 * 1024 * 1024);
  assert.equal(intermediate.breakdown.held, 200 * 1024 * 1024);
  assert.equal(intermediate.breakdown.copyFactor, 1.5);
  assert.equal(intermediate.breakdown.observedPeakMb, 400);
  assert.ok(intermediate.estimatedMb > direct.estimatedMb);
});
test('single and batch helpers forward the observed peak', () => {
  const single = estimateForSingle({ fileSize: 1024, observedPeakMb: 400 });
  const batch = estimateForBatch([{ file: { size: 1024 } }], { observedPeakMb: 950 });
  assert.equal(single.level, 'warn');
  assert.equal(batch.level, 'block');
  assert.equal(single.breakdown.observedPeakMb, 400);
  assert.equal(batch.breakdown.observedPeakMb, 950);
});