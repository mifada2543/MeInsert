/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — MeInsert Source-Available License v1.0 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const root = new URL('../../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const FILES = ['README.md', 'README-en.md'];
const withoutFences = (text) => text.replace(/```[\s\S]*?```/g, '');
function headingLevels(text) {
  return withoutFences(text)
    .split('\n')
    .filter((line) => /^#{1,6}\s/.test(line))
    .map((line) => line.match(/^#+/)[0].length);
}
function docsLinks(text) {
  const found = new Set();
  const urls = [
    ...[...withoutFences(text).matchAll(/\]\(\s*<?([^\s)]+)>?/g)].map((m) => m[1]),
    ...[...withoutFences(text).matchAll(/href\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1]),
  ];
  for (const url of urls) {
    const path = url.split(/[#?]/)[0].replace(/^\.\//, '');
    if (path.includes('docs/') && path.endsWith('.md')) found.add(path);
  }
  return [...found].sort();
}
test('both READMEs exist and keep the same heading-level sequence', async () => {
  const levels = await Promise.all(FILES.map(async (file) => headingLevels(await read(file))));
  assert.ok(levels[0].length > 0, 'README.md has no Markdown headings');
  assert.deepEqual(levels[0], levels[1], 'README.md and README-en.md must share the same sequence of heading levels');
});
test('docs links referenced in one README are referenced in the other', async () => {
  const links = await Promise.all(FILES.map(async (file) => docsLinks(await read(file))));
  assert.deepEqual(links[0], links[1], 'docs/*.md links must be mirrored across both READMEs');
});
test('both READMEs use the custom domain and never the old GitHub Pages host', async () => {
  for (const file of FILES) {
    const text = await read(file);
    assert.doesNotMatch(text, /mifada2543\.github\.io/i);
    assert.ok(text.includes('https://meinsert.my.id/'));
  }
});
test('both READMEs describe shipped features as available, not upcoming', async () => {
  for (const file of FILES) {
    const text = await read(file);
    assert.doesNotMatch(text, /\bcoming\b|\bplanned\b|direncanakan|fase\s*3/i,
      `${file} still describes a shipped feature as upcoming`);
    for (const marker of ['?clean=1', 'about.html', 'test:e2e:all', 'test:fast', 'test:preview']) {
      assert.ok(text.includes(marker), `${file} must mention ${marker}`);
    }
  }
});
test('version badge in both READMEs matches package.json', async () => {
  const { version } = JSON.parse(await read('package.json'));
  for (const file of FILES) {
    const text = await read(file);
    assert.ok(text.includes(`version-v${version}-`), `${file} badge must show v${version}`);
  }
});