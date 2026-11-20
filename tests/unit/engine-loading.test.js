/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import {
  createProgressFetch,
  decodeEngineResponse,
  engineRequestUrl,
  engineWasmUrl,
  noteEngineUrl,
} from '../../assets/js/ui/engine-loading.js';
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
  const calls = stubFetch(new Response('ok', { headers: { 'content-type': 'application/wasm' } }));
  const result = await createProgressFetch()('./zeroperl-twnm61dk.wasm');
  const requested = new URL(calls[0].url);
  assert.match(requested.pathname, /\/vendor\/exiftool-wasm\/zeroperl-twnm61dk\.wasm$/);
  assert.ok(['file:', 'http:', 'https:'].includes(requested.protocol));
  assert.equal(result.headers.get('content-type'), 'application/wasm');
});
test('engineWasmUrl points at the vendored WASM asset without an external origin', () => {
  const url = new URL(engineWasmUrl());
  assert.ok(['file:', 'http:', 'https:'].includes(url.protocol));
  assert.match(url.pathname, /\/vendor\/exiftool-wasm\/zeroperl-twnm61dk\.wasm$/);
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
  assert.equal(engineRequestUrl('./zeroperl-twnm61dk.wasm'), './zeroperl-twnm61dk.wasm.gz');
  assert.equal(engineRequestUrl('./zeroperl-twnm61dk.wasm.gz'), './zeroperl-twnm61dk.wasm.gz');
  assert.equal(engineRequestUrl('./another.wasm'), './another.wasm');
});
test('decodeEngineResponse restores the WASM bytes and corrects Content-Length', async () => {
  const original = new Uint8Array([1, 2, 3, 4, 5]);
  const gz = gzipSync(original);
  const response = new Response(gz, { headers: { 'content-length': String(gz.byteLength) } });
  const decoded = await decodeEngineResponse(response, { compressed: true });
  assert.deepEqual([...new Uint8Array(await decoded.arrayBuffer())], [...original]);
  assert.equal(decoded.headers.get('content-length'), String(original.byteLength));
});
test('decodeEngineResponse leaves a host-decoded response untouched', async () => {
  const response = new Response('plain', { headers: { 'content-encoding': 'gzip' } });
  const decoded = await decodeEngineResponse(response, { compressed: true });
  assert.equal(await decoded.text(), 'plain');
});
test('noteEngineUrl records the gzip build so offline prefetch stays compressed', () => {
  noteEngineUrl('./zeroperl-twnm61dk.wasm.gz');
  assert.match(engineWasmUrl(), /zeroperl-twnm61dk\.wasm\.gz$/);
});