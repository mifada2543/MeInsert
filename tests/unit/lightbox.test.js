/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { isLightboxOpen, closeLightbox, openLightbox } from '../../assets/js/ui/lightbox.js';
test('lightbox is closed initially', () => {
  assert.equal(isLightboxOpen(), false);
  closeLightbox();
  assert.equal(isLightboxOpen(), false);
});
test('openLightbox without src does not allocate a dialog', () => {
  assert.equal(openLightbox({ src: '' }), null);
  assert.equal(openLightbox({}), null);
  assert.equal(isLightboxOpen(), false);
});
test('lightbox component does not depend on a DOM at import time', async () => {
  const module = await import('../../assets/js/ui/lightbox.js');
  assert.equal(typeof module.openLightbox, 'function');
  assert.equal(typeof module.closeLightbox, 'function');
});