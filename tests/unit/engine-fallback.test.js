/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — MeInsert Source-Available License v1.0 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import { exiftoolBuild } from '../../assets/js/core/image-engine-build.js';
import test, { afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { brotliDecompressSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { makeEngineFetch, resetEngineFetchStateForTests } from '../../assets/js/engines/exiftool.js';
const fixtureBrotli = readFileSync(new URL(`../../assets/vendor/exiftool-wasm/${exiftoolBuild.name}.br`, import.meta.url));
const fixtureWasm = brotliDecompressSync(fixtureBrotli);
const sampleWasm = () => fixtureWasm;
const VALID_BROTLI = fixtureBrotli;
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
test('a valid Brotli response is fetched once and decoded without a raw WASM request', async () => {
  stubFetch(() => new Response(VALID_BROTLI));
  const fetchFn = makeEngineFetch();
  const first = await fetchFn(`./${exiftoolBuild.name}`);
  const second = await fetchFn(`./${exiftoolBuild.name}`);
  assert.ok(Buffer.from(await first.arrayBuffer()).equals(sampleWasm()));
  assert.ok(Buffer.from(await second.arrayBuffer()).equals(sampleWasm()));
  assert.deepEqual(calls, [`${exiftoolBuild.name}.br`]);
});
test('concurrent requests share one Brotli download', async () => {
  stubFetch(() => new Response(VALID_BROTLI));
  const fetchFn = makeEngineFetch();
  const results = await Promise.all([
    fetchFn(`./${exiftoolBuild.name}`),
    fetchFn(`./${exiftoolBuild.name}`),
  ]);
  for (const result of results) {
    assert.ok(Buffer.from(await result.arrayBuffer()).equals(sampleWasm()));
  }
  assert.deepEqual(calls, [`${exiftoolBuild.name}.br`]);
});
test('missing DecompressionStream falls back to the JS decoder with no raw WASM request', async () => {
  const native = globalThis.DecompressionStream;
  stubFetch(() => new Response(VALID_BROTLI));
  try {
    delete globalThis.DecompressionStream;
    const result = await makeEngineFetch()(`./${exiftoolBuild.name}`);
    assert.ok(Buffer.from(await result.arrayBuffer()).equals(sampleWasm()));
    assert.deepEqual(calls, [`${exiftoolBuild.name}.br`]);
  } finally {
    globalThis.DecompressionStream = native;
  }
});
test('a failed download is not retried by the same engine fetch', async () => {
  stubFetch(() => new Response('offline', { status: 503 }));
  const fetchFn = makeEngineFetch();
  await assert.rejects(() => fetchFn(`./${exiftoolBuild.name}`));
  await assert.rejects(() => fetchFn(`./${exiftoolBuild.name}`));
  assert.deepEqual(calls, [`${exiftoolBuild.name}.br`]);
});
for (const [label, response] of [
  ['a 404 Brotli asset', () => new Response('missing', { status: 404 })],
  ['a corrupt Brotli asset', () => new Response(Uint8Array.from([1, 2, 3, 4]))],
]) {
  test(`${label} is rejected without any gzip request`, async () => {
    stubFetch(response);
    const fetchFn = makeEngineFetch();
    await assert.rejects(() => fetchFn(`./${exiftoolBuild.name}`));
    await assert.rejects(() => fetchFn(`./${exiftoolBuild.name}`));
    assert.deepEqual(calls, [`${exiftoolBuild.name}.br`]);
    assert.ok(calls.every((name) => name.endsWith('.br')));
  });
}
