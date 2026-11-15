/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const root = new URL('../../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
test('public site links use the custom domain while source links remain on GitHub', async () => {
  assert.equal((await read('CNAME')).trim(), 'meinsert.my.id');
  for (const [file, path] of [['index.html', ''], ['single.html', 'single.html'], ['batch.html', 'batch.html'], ['privacy.html', 'privacy.html'], ['Terms.html', 'Terms.html']]) {
    const html = await read(file), expected = `https://meinsert.my.id/${path}`;
    assert.equal(html.match(/<link rel="canonical" href="([^"]+)"/)?.[1], expected);
    assert.doesNotMatch(html, /mifada2543\.github\.io/i);
    const og = html.match(/<meta property="og:url" content="([^"]+)"/)?.[1];
    if (og) assert.equal(og, expected);
    for (const match of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      assert.equal(JSON.parse(match[1]).url, expected);
    }
    assert.match(html, /https:\/\/github\.com\/mifada2543\/meinsert/);
  }
  for (const file of ['README.md', 'README-en.md', 'NOTICE.md', 'NOTICE-en.md']) {
    const text = await read(file);
    assert.doesNotMatch(text, /mifada2543\.github\.io/i);
    assert.ok(text.includes('https://meinsert.my.id/'));
  }
});
