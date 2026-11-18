/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  QUICK_SAVE_STORAGE_KEY,
  isQuickSaveEligible,
  quickSaveEnabled,
  readQuickSavePreference,
  setQuickSavePreference,
} from '../../assets/js/ui/quick-save.js';

function plan(overrides = {}) {
  return {
    hasOperations: true,
    operations: [{ kind: 'field', action: 'set', id: 'title' }],
    payload: {},
    risks: [],
    ...overrides,
  };
}

function withStorage(run) {
  const store = new Map();
  const fake = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
  };
  const previous = globalThis.localStorage;
  globalThis.localStorage = fake;
  try {
    return run(store);
  } finally {
    if (previous === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previous;
  }
}

test('field-only plans are eligible for quick save', () => {
  assert.equal(isQuickSaveEligible(plan()), true);
  assert.equal(isQuickSaveEligible(plan({
    operations: [
      { kind: 'field', action: 'set', id: 'title' },
      { kind: 'field', action: 'remove', id: 'subject' },
    ],
  })), true);
});

test('cover operations require the full review', () => {
  assert.equal(isQuickSaveEligible(plan({
    operations: [{ kind: 'field', action: 'set', id: 'title' }, { kind: 'cover', action: 'remove' }],
  })), false);
  assert.equal(isQuickSaveEligible(plan({ payload: { cover: { action: 'set' } } })), false);
});

test('raw-tag removals require the full review', () => {
  assert.equal(isQuickSaveEligible(plan({
    operations: [{ kind: 'raw', action: 'remove', tag: 'Exif:Make' }],
  })), false);
  assert.equal(isQuickSaveEligible(plan({ payload: { rawRemove: ['Exif:Make'] } })), false);
});

test('custom-only plans are not eligible', () => {
  assert.equal(isQuickSaveEligible(plan({
    operations: [{ kind: 'custom', action: 'set', key: 'X-Custom' }],
  })), false);
});

test('danger risks such as signed PDF block quick save', () => {
  assert.equal(isQuickSaveEligible(plan({
    risks: [{ code: 'SIGNED_PDF', severity: 'danger', message: 'signed' }],
  })), false);
  assert.equal(isQuickSaveEligible(plan({
    memory: { level: 'block' },
  })), false);
  // Warning-level risks do not block a field-only plan.
  assert.equal(isQuickSaveEligible(plan({
    risks: [{ code: 'MKV_REWRITE', severity: 'warning', message: 'rewritten' }],
  })), true);
});

test('extension mismatches and empty plans require the full review', () => {
  assert.equal(isQuickSaveEligible(plan({ extensionMismatch: { found: true } })), false);
  assert.equal(isQuickSaveEligible(plan({ hasOperations: false })), false);
  assert.equal(isQuickSaveEligible(plan({ operations: [] })), false);
  assert.equal(isQuickSaveEligible(null), false);
});

test('quick save preference defaults off and persists when enabled', () => {
  withStorage((store) => {
    assert.equal(readQuickSavePreference(), false);
    assert.equal(quickSaveEnabled(), false);
    assert.equal(setQuickSavePreference(true), true);
    assert.equal(readQuickSavePreference(), true);
    assert.equal(store.get(QUICK_SAVE_STORAGE_KEY), 'true');
    setQuickSavePreference(false);
    assert.equal(quickSaveEnabled(), false);
  });
});

test('blocked or non-string storage never enables quick save', () => {
  const previous = globalThis.localStorage;
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() { throw new Error('blocked'); },
  });
  try {
    assert.equal(readQuickSavePreference(), false);
    assert.equal(setQuickSavePreference(true), true);
    assert.equal(quickSaveEnabled(), false);
  } finally {
    if (previous === undefined) delete globalThis.localStorage;
    else Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: previous, writable: true });
  }
});
