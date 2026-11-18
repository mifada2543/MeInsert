/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_DROP_DEPTH,
  MAX_DROP_FILES,
  collectDroppedFiles,
} from '../../assets/js/batch/batch-folder-drop.js';

const fakeFile = (name) => ({ name, size: name.length });

function fileEntry(name) {
  return {
    isFile: true,
    isDirectory: false,
    file(ok) { ok(fakeFile(name)); },
  };
}

function dirEntry(children, batchSize = 2) {
  return {
    isFile: false,
    isDirectory: true,
    createReader() {
      let index = 0;
      return {
        readEntries(ok) {
          const chunk = children.slice(index, index + batchSize);
          index += batchSize;
          ok(chunk);
        },
      };
    },
  };
}

function drop(...entries) {
  return {
    items: entries.map((entry) => ({ webkitGetAsEntry: () => entry })),
    files: [],
  };
}

test('collects nested folders into a flat list across reader batches', async () => {
  const tree = dirEntry([
    fileEntry('a.jpg'),
    dirEntry([
      fileEntry('b.mp3'),
      dirEntry([fileEntry('c.pdf'), fileEntry('d.png')], 1),
    ], 1),
  ], 2);
  const files = await collectDroppedFiles(drop(tree));
  assert.deepEqual(files.map((file) => file.name), ['a.jpg', 'b.mp3', 'c.pdf', 'd.png']);
});

test('falls back to dataTransfer.files when entries are unavailable', async () => {
  const files = [fakeFile('one.jpg'), fakeFile('two.png')];
  const result = await collectDroppedFiles({ items: [{ webkitGetAsEntry: () => null }], files });
  assert.deepEqual(result.map((file) => file.name), ['one.jpg', 'two.png']);
});

test('falls back when the drop has no items', async () => {
  const files = [fakeFile('plain.pdf')];
  const result = await collectDroppedFiles({ files });
  assert.deepEqual(result.map((file) => file.name), ['plain.pdf']);
});

test('reader and file errors are skipped without breaking the walk', async () => {
  const broken = dirEntry([
    {
      isFile: true,
      isDirectory: false,
      file(_ok, fail) { fail(new Error('unreadable')); },
    },
    fileEntry('still-here.jpg'),
  ]);
  const result = await collectDroppedFiles(drop(broken));
  assert.deepEqual(result.map((file) => file.name), ['still-here.jpg']);
});

test('directory traversal stops at the depth limit', async () => {
  let node = fileEntry('deepest');
  for (let level = MAX_DROP_DEPTH + 2; level >= 1; level -= 1) {
    node = dirEntry([node, fileEntry(`level-${level}`)], 1);
  }
  const result = await collectDroppedFiles(drop(node));
  assert.equal(result.length, MAX_DROP_DEPTH);
  assert.equal(result.some((file) => file.name === 'deepest'), false);
});

test('collection is capped at the maximum file count', async () => {
  const many = Array.from({ length: MAX_DROP_FILES + 25 }, (_, index) => fileEntry(`f-${index}`));
  const result = await collectDroppedFiles(drop(dirEntry(many, 7)));
  assert.equal(result.length, MAX_DROP_FILES);
});

test('empty drops produce no files', async () => {
  assert.deepEqual(await collectDroppedFiles({}), []);
  assert.deepEqual(await collectDroppedFiles({ items: [], files: [] }), []);
});
