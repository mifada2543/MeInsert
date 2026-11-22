/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — MeInsert Source-Available License v1.0 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import { exiftoolBuild } from '../../assets/js/core/image-engine-build.js';
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { brotliCompressSync, brotliDecompressSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import {
  createProgressFetch,
  decodeEngineBytes,
  decodeEngineResponse,
  engineRequestUrl,
  engineWasmUrl,
  isWasmBinary,
  noteEngineUrl,
  readEngineResponse,
} from '../../assets/js/ui/engine-loading.js';
const fixtureBrotli = readFileSync(new URL(`../../assets/vendor/exiftool-wasm/${exiftoolBuild.name}.br`, import.meta.url));
const fixtureWasm = brotliDecompressSync(fixtureBrotli);
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
test('createProgressFetch resolves the vendor-relative URL to the same-origin Brotli asset', async () => {
  const calls = stubFetch(new Response('ok', { headers: { 'content-type': 'application/octet-stream' } }));
  const result = await createProgressFetch()(`./${exiftoolBuild.name}.br`);
  const requested = new URL(calls[0].url);
  assert.ok(requested.pathname.endsWith(`/vendor/exiftool-wasm/${exiftoolBuild.name}.br`));
  assert.ok(['file:', 'http:', 'https:'].includes(requested.protocol));
  assert.equal(result.headers.get('content-type'), 'application/octet-stream');
});
test('engineWasmUrl points at the Brotli WASM asset without an external origin', () => {
  const url = new URL(engineWasmUrl());
  assert.ok(['file:', 'http:', 'https:'].includes(url.protocol));
  assert.ok(url.pathname.endsWith(`/vendor/exiftool-wasm/${exiftoolBuild.name}.br`));
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
test('engineRequestUrl maps only the vendored WASM to its Brotli build', () => {
  assert.equal(engineRequestUrl(`./${exiftoolBuild.name}`), `./${exiftoolBuild.name}.br`);
  assert.equal(engineRequestUrl(`./${exiftoolBuild.name}.br`), `./${exiftoolBuild.name}.br`);
  assert.equal(engineRequestUrl('./another.wasm'), './another.wasm');
});
test('magic-byte helper recognises WASM binaries', () => {
  const wasm = sampleWasm();
  assert.equal(isWasmBinary(wasm), true);
  assert.equal(isWasmBinary(fixtureBrotli), false);
  assert.equal(isWasmBinary(Uint8Array.from([0, 0x61, 0x73, 0x6d, 2, 0, 0, 0])), false);
  assert.equal(isWasmBinary(Uint8Array.from([1, 2, 3])), false);
});
test('decodeEngineResponse decompresses raw Brotli and validates the WASM result', async () => {
  const wasm = sampleWasm();
  const response = new Response(fixtureBrotli, { headers: { 'content-type': 'application/octet-stream' } });
  const decoded = await decodeEngineResponse(response);
  assert.ok(Buffer.from(await decoded.arrayBuffer()).equals(wasm));
  assert.equal(decoded.headers.get('content-length'), String(wasm.byteLength));
  assert.equal(decoded.headers.get('content-type'), 'application/wasm');
  assert.equal(decoded.headers.get('content-encoding'), null);
});
test('decodeEngineResponse passes a cached raw WASM through and removes a misleading Content-Encoding', async () => {
  const wasm = sampleWasm();
  const response = new Response(wasm, { headers: { 'content-encoding': 'br' } });
  const decoded = await decodeEngineResponse(response);
  assert.ok(Buffer.from(await decoded.arrayBuffer()).equals(wasm));
  assert.equal(decoded.headers.get('content-encoding'), null);
});
test('decodeEngineResponse rejects non-WASM bytes after decompression', async () => {
  const response = new Response(brotliCompressSync(Uint8Array.from([1, 2, 3, 4])));
  await assert.rejects(() => decodeEngineResponse(response), /WASM|verify/i);
});
test('readEngineResponse uses the JS Brotli decoder when DecompressionStream is absent', async () => {
  const native = globalThis.DecompressionStream;
  try {
    delete globalThis.DecompressionStream;
    const decoded = await readEngineResponse(new Response(fixtureBrotli));
    assert.ok(Buffer.from(decoded).equals(sampleWasm()));
  } finally {
    globalThis.DecompressionStream = native;
  }
});
test('readEngineResponse uses native Brotli decompression when available', async () => {
  const native = globalThis.DecompressionStream;
  let format = null;
  globalThis.DecompressionStream = class {
    constructor(requestedFormat) {
      format = requestedFormat;
      const stream = new TransformStream({
        transform(chunk, controller) { controller.enqueue(brotliDecompressSync(chunk)); },
      });
      this.readable = stream.readable;
      this.writable = stream.writable;
    }
  };
  try {
    const decoded = await readEngineResponse(new Response(fixtureBrotli));
    assert.equal(format, 'brotli');
    assert.ok(Buffer.from(decoded).equals(sampleWasm()));
  } finally {
    globalThis.DecompressionStream = native;
  }
});
test('readEngineResponse rejects corrupted Brotli bytes', async () => {
  const corrupted = Uint8Array.from(fixtureBrotli.subarray(0, 64));
  await assert.rejects(() => readEngineResponse(new Response(corrupted)), /verify|WASM|integrity/i);
});
test('integrity verification is skipped safely without Web Crypto', async () => {
  const cryptoGlobal = globalThis.crypto;
  try {
    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });
    const decoded = await decodeEngineBytes(sampleWasm());
    assert.ok(Buffer.from(decoded).equals(sampleWasm()));
  } finally {
    Object.defineProperty(globalThis, 'crypto', { value: cryptoGlobal, configurable: true });
  }
});
test('noteEngineUrl records the Brotli build so offline prefetch stays compressed', () => {
  noteEngineUrl(`./${exiftoolBuild.name}.br`);
  assert.ok(engineWasmUrl().endsWith(`/${exiftoolBuild.name}.br`));
});
test('rejects a valid WASM header with an incorrect binary size', async () => {
  await assert.rejects(() => decodeEngineBytes(Uint8Array.of(0, 97, 115, 109, 1, 0, 0, 0, 255)), /size mismatch/i);
});
test('rejects same-length corrupted WASM via pinned SHA-256', async () => {
  const corrupted = new Uint8Array(fixtureWasm);
  corrupted[corrupted.length - 1] ^= 1;
  await assert.rejects(() => decodeEngineBytes(corrupted), /integrity mismatch/i);
});
