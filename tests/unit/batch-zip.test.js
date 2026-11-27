/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — MeInsert Source-Available License v1.0 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { strFromU8, unzipSync } from '../../assets/vendor/fflate.mjs';
import { saveZipStreaming } from '../../assets/js/batch/batch-zip.js';

function setWindow(t, value) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, 'window', previous);
    else delete globalThis.window;
  });
}

function entriesAsText(bytes) {
  return Object.fromEntries(Object.entries(unzipSync(bytes)).map(([name, value]) => [name, strFromU8(value)]));
}

test('Batch ZIP waits for disk writes and preserves all entries and the report', async (t) => {
  const parts = ['first chunk', 'second chunk', 'third chunk'];
  const file = new File(parts, 'Audio.txt');
  let reads = 0;
  file.stream = () => new ReadableStream({
    pull(controller) {
      if (reads === parts.length) controller.close();
      else controller.enqueue(new TextEncoder().encode(parts[reads++]));
    },
  }, { highWaterMark: 0 });
  const chunks = [];
  let closed = false;
  const stream = new WritableStream({
    async write(chunk) {
      const readsAtWrite = reads;
      await new Promise((resolve) => setImmediate(resolve));
      assert.equal(reads, readsAtWrite, 'the producer must pause while a write is pending');
      chunks.push(chunk);
    },
    close() { closed = true; },
  });
  let pickerOptions;
  setWindow(t, {
    async showSaveFilePicker(options) {
      pickerOptions = options;
      return { createWritable: async () => stream };
    },
  });
  const second = new File(['second file'], 'audio.txt');
  const result = await saveZipStreaming([
    { file, outputName: 'Audio-meinsert.txt', outputFile: file },
    { file: second, outputName: 'audio-meinsert.txt', outputFile: second },
  ], {
    suggestedName: 'batch.zip',
    reportJson: '{"count":2}',
    onProgress({ pct }) {
      if (pct === 100) assert.equal(closed, true);
    },
  });
  assert.deepEqual(result, { streaming: true });
  assert.equal(pickerOptions.suggestedName, 'batch.zip');
  assert.equal(closed, true);
  assert.equal(stream.locked, false);
  assert.deepEqual(entriesAsText(new Uint8Array(await new Blob(chunks).arrayBuffer())), {
    'outputs/Audio-meinsert.txt': parts.join(''),
    'outputs/audio-meinsert (2).txt': 'second file',
    'laporan-meinsert.json': '{"count":2}',
  });
});

test('Batch ZIP returns a valid Blob when the picker is unavailable', async (t) => {
  setWindow(t, {});
  const file = new File([], 'empty.txt');
  const result = await saveZipStreaming([{ file, outputName: 'empty.txt', outputFile: file }], { reportJson: '{}' });
  assert.equal(result.streaming, false);
  assert.equal(result.blob.type, 'application/zip');
  assert.deepEqual(entriesAsText(new Uint8Array(await result.blob.arrayBuffer())), {
    'outputs/empty.txt': '',
    'laporan-meinsert.json': '{}',
  });
});

test('cancelling the ZIP picker preserves the cancellation code and never reads input', async (t) => {
  const cancelled = new DOMException('Picker closed', 'AbortError');
  setWindow(t, {
    async showSaveFilePicker() { throw cancelled; },
  });
  const file = new File(['untouched'], 'a.txt');
  const read = t.mock.method(file, 'stream');
  await assert.rejects(
    saveZipStreaming([{ file, outputFile: file }]),
    { code: 'SAVE_CANCELLED', cancelled: true, cause: cancelled },
  );
  assert.equal(read.mock.callCount(), 0);
});

test('a disk write failure cancels the source and releases both stream locks', async (t) => {
  const failure = new Error('Disk full');
  let cancelledWith;
  const source = new ReadableStream({
    pull(controller) { controller.enqueue(Uint8Array.of(1)); },
    cancel(error) { cancelledWith = error; },
  });
  const file = new File(['payload'], 'a.txt');
  file.stream = () => source;
  let closed = false;
  const stream = new WritableStream({
    write() { throw failure; },
    close() { closed = true; },
  });
  setWindow(t, {
    showSaveFilePicker: async () => ({ createWritable: async () => stream }),
  });
  await assert.rejects(saveZipStreaming([{ file, outputFile: file }]), (error) => error === failure);
  assert.equal(cancelledWith, failure);
  assert.equal(closed, false);
  assert.equal(source.locked, false);
  assert.equal(stream.locked, false);
});
