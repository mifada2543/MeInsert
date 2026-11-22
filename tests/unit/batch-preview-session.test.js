/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — MeInsert Source-Available License v1.0 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { BatchPreview } from '../../assets/js/batch/batch-preview.js';
test('batch cover changes replace only the cover, not the media preview', () => {
  const preview = new BatchPreview();
  preview.els = {};
  let builds = 0;
  let covers = 0;
  const cover = { replaceWith() { covers++; } };
  const node = { querySelector: () => cover };
  preview.buildPreview = () => { builds++; return node; };
  preview.buildPreviewCover = () => ({});
  const item = {
    id: 'audio', file: new Blob(['audio']), detection: { id: 'mp3' },
    readResult: { coverBytes: new Uint8Array([1]), cover: { mimeType: 'image/png' } },
  };
  try {
    assert.equal(preview.ensurePreview(item), node);
    const mediaUrl = preview.previewUrl;
    const coverUrl = preview.previewCoverUrl;
    item.readResult.coverBytes = new Uint8Array([2]);
    assert.equal(preview.ensurePreview(item), node);
    assert.equal(preview.previewUrl, mediaUrl);
    assert.notEqual(preview.previewCoverUrl, coverUrl);
    assert.equal(covers, 1);
    assert.equal(builds, 1);
    preview.ensurePreview(item);
    assert.equal(covers, 1, 'unchanged cover does not rebuild');
    item.readResult.coverBytes = null;
    preview.ensurePreview(item);
    assert.equal(preview.previewCoverUrl, null);
    assert.equal(preview.previewUrl, mediaUrl);
    assert.equal(covers, 2);
    item.file = new Blob(['different media']);
    preview.ensurePreview(item);
    assert.equal(builds, 2, 'replacing the file creates a new media preview');
    assert.notEqual(preview.previewUrl, mediaUrl);
  } finally {
    preview.releasePreview();
  }
});