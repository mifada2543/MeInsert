/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import { exiftoolBuild } from '../../assets/js/core/image-engine-build.js';
import test, { afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { gunzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { makeEngineFetch, resetEngineFetchStateForTests } from '../../assets/js/engines/exiftool.js';
const fixtureGzip = readFileSync(new URL(`../../assets/vendor/exiftool-wasm/${exiftoolBuild.name}.gz`, import.meta.url));
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
  const first = await fetchFn(`./${exiftoolBuild.name}`);
  const second = await fetchFn(`./${exiftoolBuild.name}`);
  assert.ok(Buffer.from(await first.arrayBuffer()).equals(sampleWasm()));
  assert.ok(Buffer.from(await second.arrayBuffer()).equals(sampleWasm()));
  assert.deepEqual(calls, [`${exiftoolBuild.name}.gz`]);
});
test('missing DecompressionStream falls back to fflate with no raw WASM request', async () => {
  const native = globalThis.DecompressionStream;
  stubFetch(() => new Response(VALID_GZIP));
  try {
    delete globalThis.DecompressionStream;
    const result = await makeEngineFetch()(`./${exiftoolBuild.name}`);
    assert.ok(Buffer.from(await result.arrayBuffer()).equals(sampleWasm()));
    assert.deepEqual(calls, [`${exiftoolBuild.name}.gz`]);
  } finally {
    globalThis.DecompressionStream = native;
  }
});
test('concurrent requests share one download', async () => {
  stubFetch(() => new Response(VALID_GZIP));
  const fetchFn = makeEngineFetch();
  const results = await Promise.all([
    fetchFn(`./${exiftoolBuild.name}`),
    fetchFn(`./${exiftoolBuild.name}`),
  ]);
  for (const result of results) {
    assert.ok(Buffer.from(await result.arrayBuffer()).equals(sampleWasm()));
  }
  assert.deepEqual(calls, [`${exiftoolBuild.name}.gz`]);
});
test('a failed download is not retried by the same engine fetch', async () => {
  stubFetch(() => new Response('offline', { status: 503 }));
  const fetchFn = makeEngineFetch();
  await assert.rejects(() => fetchFn(`./${exiftoolBuild.name}`));
  await assert.rejects(() => fetchFn(`./${exiftoolBuild.name}`));
  assert.deepEqual(calls, [`${exiftoolBuild.name}.gz`]);
});
test('Brotli verifies to the same bytes and never fetches gzip when it succeeds', async () => {
  const brotli = readFileSync(new URL(`../../assets/vendor/exiftool-wasm/${exiftoolBuild.name}.br`, import.meta.url));
  stubFetch(() => new Response(brotli));
  const native = globalThis.DecompressionStream;
  try {
    delete globalThis.DecompressionStream;
    const result = await makeEngineFetch({ preferBrotli: true })(`./${exiftoolBuild.name}`);
    assert.ok(Buffer.from(await result.arrayBuffer()).equals(sampleWasm()));
    assert.deepEqual(calls, [`${exiftoolBuild.name}.br`]);
  } finally {
    globalThis.DecompressionStream = native;
  }
});

test('a missing or corrupt Brotli asset retries gzip once', async () => {
  for (const failedBrotli of [() => new Response('missing', { status: 404 }), () => new Response('corrupt')]) {
    calls = [];
    resetEngineFetchStateForTests();
    stubFetch((url) => url.endsWith('.br') ? failedBrotli() : new Response(VALID_GZIP));
    const result = await makeEngineFetch({ preferBrotli: true })(`./${exiftoolBuild.name}`);
    assert.ok(Buffer.from(await result.arrayBuffer()).equals(sampleWasm()));
    assert.deepEqual(calls, [`${exiftoolBuild.name}.br`, `${exiftoolBuild.name}.gz`]);
  }
});
