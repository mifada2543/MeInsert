/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import { exiftoolBuild } from '../../assets/js/core/image-engine-build.js';
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync, gunzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import {
  createProgressFetch,
  decodeEngineBytes,
  decodeEngineResponse,
  engineRequestUrl,
  engineWasmUrl,
  isGzipBinary,
  isWasmBinary,
  noteEngineUrl,
} from '../../assets/js/ui/engine-loading.js';
const fixtureGzip = readFileSync(new URL(`../../assets/vendor/exiftool-wasm/${exiftoolBuild.name}.gz`, import.meta.url));
const fixtureWasm = gunzipSync(fixtureGzip);
const sampleWasm = () => fixtureWasm;
import { friendlyMemoryError, isMemoryError } from '../../assets/js/core/worker-client.js';

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});
function stubFetch(response) {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return response;
  };
  return calls;
}
function chunkedResponse(chunks, total) {
  const headers = total === null ? new Headers() : new Headers({ 'content-length': String(total) });
  return {
    status: 200,
    headers,
    body: new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(new Uint8Array(chunk));
        controller.close();
      },
    }),
  };
}
test('createProgressFetch reports cumulative progress with a known Content-Length', async () => {
  stubFetch(new Response('hello', { headers: { 'content-length': '5' } }));
  const seen = [];
  const result = await createProgressFetch({ onProgress: (progress) => seen.push(progress) })('./wasm');
  assert.ok(result instanceof Response);
  assert.equal(await result.text(), 'hello');
  assert.ok(seen.length >= 1);
  assert.deepEqual(seen.at(-1), { loaded: 5, total: 5 });
});
test('createProgressFetch does not throw without Content-Length and reports loaded only', async () => {
  stubFetch(new Response('hello'));
  const seen = [];
  const result = await createProgressFetch({ onProgress: (progress) => seen.push(progress) })('./wasm');
  assert.ok(result instanceof Response);
  assert.equal(await result.text(), 'hello');
  assert.deepEqual(seen.at(-1), { loaded: 5, total: null });
});
test('createProgressFetch aggregates streamed chunks into intact bytes', async () => {
  stubFetch(chunkedResponse([[1, 2], [3], [4, 5]], 5));
  const seen = [];
  const result = await createProgressFetch({ onProgress: (progress) => seen.push(progress) })('./wasm');
  assert.ok(result instanceof Response);
  assert.deepEqual([...new Uint8Array(await result.arrayBuffer())], [1, 2, 3, 4, 5]);
  assert.deepEqual(seen, [
    { loaded: 2, total: 5 },
    { loaded: 3, total: 5 },
    { loaded: 5, total: 5 },
  ]);
});
test('createProgressFetch reports once and returns the original response when streaming is unavailable', async () => {
  const original = { status: 200, headers: new Headers({ 'content-length': '5' }), body: null };
  stubFetch(original);
  const seen = [];
  const result = await createProgressFetch({ onProgress: (progress) => seen.push(progress) })('./wasm');
  assert.equal(result, original);
  assert.deepEqual(seen, [{ loaded: 5, total: 5 }]);
});
test('createProgressFetch resolves the vendor-relative URL to the same-origin WASM asset', async () => {
  const calls = stubFetch(new Response('ok', { headers: { 'content-type': 'application/gzip' } }));
  const result = await createProgressFetch()(`./${exiftoolBuild.name}.gz`);
  const requested = new URL(calls[0].url);
  assert.ok(requested.pathname.endsWith(`/vendor/exiftool-wasm/${exiftoolBuild.name}.gz`));
  assert.ok(['file:', 'http:', 'https:'].includes(requested.protocol));
  assert.equal(result.headers.get('content-type'), 'application/gzip');
});
test('engineWasmUrl points at the gzip WASM asset without an external origin', () => {
  const url = new URL(engineWasmUrl());
  assert.ok(['file:', 'http:', 'https:'].includes(url.protocol));
  assert.ok(url.pathname.endsWith(`/vendor/exiftool-wasm/${exiftoolBuild.name}.gz`));
});
test('friendlyMemoryError marks RangeError with both friendly keys and preserves code/detail', () => {
  const source = new RangeError('Invalid array length');
  source.code = 'WORKER_CRASH';
  source.detail = 'at wasm://exiftool';
  const mapped = friendlyMemoryError(source);
  assert.notEqual(mapped, source);
  assert.equal(mapped.code, 'WORKER_CRASH');
  assert.equal(mapped.detail, 'at wasm://exiftool');
  assert.equal(mapped.originalMessage, 'Invalid array length');
  assert.deepEqual(mapped.friendlyKeys, ['ui.memoryLimitFriendly', 'ui.memoryLimitAdvice']);
  assert.equal(mapped.isMemoryLimit, true);
  assert.match(mapped.message, /\S/);
});
test('friendlyMemoryError leaves ordinary errors untouched', () => {
  const source = new Error('File tidak bisa dibaca.');
  source.code = 'READ_FAILED';
  assert.equal(isMemoryError(source), false);
  assert.equal(friendlyMemoryError(source), source);
});
test('engineRequestUrl maps only the vendored WASM to its gzip build', () => {
  assert.equal(engineRequestUrl(`./${exiftoolBuild.name}`), `./${exiftoolBuild.name}.gz`);
  assert.equal(engineRequestUrl(`./${exiftoolBuild.name}.gz`), `./${exiftoolBuild.name}.gz`);
  assert.equal(engineRequestUrl('./another.wasm'), './another.wasm');
});
test('magic-byte helpers recognise WASM and gzip binaries', () => {
  const wasm = sampleWasm();
  assert.equal(isWasmBinary(wasm), true);
  assert.equal(isGzipBinary(fixtureGzip), true);
  assert.equal(isWasmBinary(fixtureGzip), false);
  assert.equal(isWasmBinary(Uint8Array.from([0, 0x61, 0x73, 0x6d, 2, 0, 0, 0])), false);
  assert.equal(isWasmBinary(Uint8Array.from([1, 2, 3])), false);
});
test('decodeEngineResponse detects gzip by magic bytes and validates the WASM result', async () => {
  const wasm = sampleWasm();
  const gz = fixtureGzip;
  const response = new Response(gz, { headers: { 'content-type': 'application/octet-stream' } });
  const decoded = await decodeEngineResponse(response);
  assert.ok(Buffer.from(await decoded.arrayBuffer()).equals(wasm));
  assert.equal(decoded.headers.get('content-length'), String(wasm.byteLength));
  assert.equal(decoded.headers.get('content-type'), 'application/wasm');
});
test('decodeEngineResponse passes a cached raw WASM through despite a misleading Content-Encoding', async () => {
  const wasm = sampleWasm();
  const response = new Response(wasm, { headers: { 'content-encoding': 'gzip' } });
  const decoded = await decodeEngineResponse(response);
  assert.ok(Buffer.from(await decoded.arrayBuffer()).equals(wasm));
});
test('decodeEngineResponse unwraps double-compressed gzip', async () => {
  const wasm = sampleWasm();
  const double = gzipSync(fixtureGzip);
  const decoded = await decodeEngineResponse(new Response(double));
  assert.ok(Buffer.from(await decoded.arrayBuffer()).equals(wasm));
});
test('decodeEngineResponse rejects non-WASM bytes after decompression', async () => {
  const response = new Response(gzipSync(Uint8Array.from([1, 2, 3, 4])));
  await assert.rejects(() => decodeEngineResponse(response), /WASM/i);
});
test('decodeEngineResponse uses fflate when DecompressionStream is absent', async () => {
  const wasm = sampleWasm();
  const native = globalThis.DecompressionStream;
  try {
    delete globalThis.DecompressionStream;
    const decoded = await decodeEngineResponse(new Response(fixtureGzip));
    assert.ok(Buffer.from(await decoded.arrayBuffer()).equals(wasm));
  } finally {
    globalThis.DecompressionStream = native;
  }
});
test('integrity verification is skipped safely without Web Crypto', async () => {
  const cryptoGlobal = globalThis.crypto;
  try {
    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });
    const wasm = sampleWasm();
    const decoded = await decodeEngineBytes(fixtureGzip);
    assert.ok(Buffer.from(decoded).equals(wasm));
  } finally {
    Object.defineProperty(globalThis, 'crypto', { value: cryptoGlobal, configurable: true });
  }
});
test('decodeEngineBytes refuses more than two gzip layers', async () => {
  const triple = gzipSync(gzipSync(fixtureGzip));
  await assert.rejects(() => decodeEngineBytes(triple), /gzip|WASM/i);
});
test('noteEngineUrl records the gzip build so offline prefetch stays compressed', () => {
  noteEngineUrl(`./${exiftoolBuild.name}.gz`);
  assert.ok(engineWasmUrl().endsWith(`/${exiftoolBuild.name}.gz`));
});
test('rejects a valid WASM header with an incorrect binary size', async () => {
  await assert.rejects(() => decodeEngineBytes(Uint8Array.of(0, 97, 115, 109, 1, 0, 0, 0, 255)), /size mismatch/i);
});
test('rejects same-length corrupted WASM via pinned SHA-256', async () => {
  const corrupted = new Uint8Array(fixtureWasm);
  corrupted[corrupted.length - 1] ^= 1;
  await assert.rejects(() => decodeEngineBytes(corrupted), /integrity mismatch/i);
});