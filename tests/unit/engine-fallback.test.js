/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import test, { afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { gunzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { makeEngineFetch, resetEngineFetchStateForTests } from '../../assets/js/engines/exiftool.js';
const fixtureGzip = readFileSync(new URL('../../assets/vendor/exiftool-wasm/zeroperl-twnm61dk.wasm.gz', import.meta.url));
const fixtureWasm = gunzipSync(fixtureGzip);
const sampleWasm = () => fixtureWasm;
const VALID_GZIP = fixtureGzip;
const realFetch = globalThis.fetch;
let calls = [];
beforeEach(() => {
  calls = [];
  resetEngineFetchStateForTests();
});
afterEach(() => {
  globalThis.fetch = realFetch;
});
function stubFetch(handler) {
  globalThis.fetch = async (url) => {
    calls.push(String(url).split('/').pop());
    return handler(String(url));
  };
}
test('a valid gzip response is fetched once and decoded without a raw WASM request', async () => {
  stubFetch(() => new Response(VALID_GZIP));
  const fetchFn = makeEngineFetch();
  const first = await fetchFn('./zeroperl-twnm61dk.wasm');
  const second = await fetchFn('./zeroperl-twnm61dk.wasm');
  assert.ok(Buffer.from(await first.arrayBuffer()).equals(sampleWasm()));
  assert.ok(Buffer.from(await second.arrayBuffer()).equals(sampleWasm()));
  assert.deepEqual(calls, ['zeroperl-twnm61dk.wasm.gz']);
});
test('missing DecompressionStream falls back to fflate with no raw WASM request', async () => {
  const native = globalThis.DecompressionStream;
  stubFetch(() => new Response(VALID_GZIP));
  try {
    delete globalThis.DecompressionStream;
    const result = await makeEngineFetch()('./zeroperl-twnm61dk.wasm');
    assert.ok(Buffer.from(await result.arrayBuffer()).equals(sampleWasm()));
    assert.deepEqual(calls, ['zeroperl-twnm61dk.wasm.gz']);
  } finally {
    globalThis.DecompressionStream = native;
  }
});
test('concurrent requests share one download', async () => {
  stubFetch(() => new Response(VALID_GZIP));
  const fetchFn = makeEngineFetch();
  const results = await Promise.all([
    fetchFn('./zeroperl-twnm61dk.wasm'),
    fetchFn('./zeroperl-twnm61dk.wasm'),
  ]);
  for (const result of results) {
    assert.ok(Buffer.from(await result.arrayBuffer()).equals(sampleWasm()));
  }
  assert.deepEqual(calls, ['zeroperl-twnm61dk.wasm.gz']);
});
test('a failed download is not retried by the same engine fetch', async () => {
  stubFetch(() => new Response('offline', { status: 503 }));
  const fetchFn = makeEngineFetch();
  await assert.rejects(() => fetchFn('./zeroperl-twnm61dk.wasm'));
  await assert.rejects(() => fetchFn('./zeroperl-twnm61dk.wasm'));
  assert.deepEqual(calls, ['zeroperl-twnm61dk.wasm.gz']);
});