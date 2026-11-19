/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  POLICY_ACK_KEY,
  POLICY_ACK_DAYS,
  isAcknowledged,
  acknowledge,
} from '../../assets/js/ui/policy-notice.js';

const DAY = 86400000;
const NOW = 1_700_000_000_000;

/** Map-backed localStorage stand-in; `seed` is stored verbatim under the key. */
function memoryStorage(seed) {
  const map = new Map();
  if (seed !== undefined) map.set(POLICY_ACK_KEY, seed);
  return {
    getItem(key) { return map.has(key) ? map.get(key) : null; },
    setItem(key, value) { map.set(key, value); },
  };
}

test('exports the documented storage key and validity window', () => {
  assert.equal(POLICY_ACK_KEY, 'meinsert.policyAck');
  assert.equal(POLICY_ACK_DAYS, 30);
});

test('a fresh acknowledgement is valid through just under 30 days', () => {
  assert.equal(isAcknowledged(memoryStorage(String(NOW)), NOW), true);
  assert.equal(isAcknowledged(memoryStorage(String(NOW)), NOW + 30 * DAY - 1), true);
});

test('an acknowledgement expires at 30 days and stays expired at 31', () => {
  assert.equal(isAcknowledged(memoryStorage(String(NOW)), NOW + 30 * DAY), false);
  assert.equal(isAcknowledged(memoryStorage(String(NOW)), NOW + 31 * DAY), false);
});

test('missing, non-numeric and empty values are not acknowledged', () => {
  assert.equal(isAcknowledged(memoryStorage(), NOW), false);
  assert.equal(isAcknowledged(memoryStorage('not-a-number'), NOW), false);
  assert.equal(isAcknowledged(memoryStorage(''), NOW), false);
});

test('a future timestamp counts as acknowledged to tolerate clock skew', () => {
  assert.equal(isAcknowledged(memoryStorage(String(NOW + DAY)), NOW), true);
});

test('a throwing getItem is treated as not acknowledged', () => {
  const storage = { getItem() { throw new Error('blocked'); } };
  assert.equal(isAcknowledged(storage, NOW), false);
});

test('acknowledge never throws when setItem fails and reports false', () => {
  const storage = {
    getItem() { return null; },
    setItem() { throw new Error('quota exceeded'); },
  };
  assert.equal(acknowledge(storage, NOW), false);
  assert.doesNotThrow(() => acknowledge(storage, NOW));
});

test('acknowledge writes a numeric string under the exact key and is then valid', () => {
  const writes = [];
  const storage = {
    getItem(key) { return writes.find(([written]) => written === key)?.[1] ?? null; },
    setItem(key, value) { writes.push([key, value]); },
  };
  assert.equal(acknowledge(storage, NOW), true);
  assert.deepEqual(writes, [[POLICY_ACK_KEY, String(NOW)]]);
  assert.equal(typeof writes[0][1], 'string');
  assert.equal(isAcknowledged(storage, NOW), true);
});
