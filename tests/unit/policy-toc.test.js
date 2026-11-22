/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — MeInsert Source-Available License v1.0 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { activeSectionIndex } from '../../assets/js/ui/policy-toc.js';
test('policy scrollspy follows the reading line, defaults to first, and reaches short final sections', () => {
  assert.equal(activeSectionIndex([], 100), -1);
  assert.equal(activeSectionIndex([300, 700, 900], 100), 0);
  assert.equal(activeSectionIndex([-200, 100, 800], 100), 1);
  assert.equal(activeSectionIndex([-900, -200, 90], 100), 2);
  assert.equal(activeSectionIndex([-900, -200, 500], 100, true), 2);
});