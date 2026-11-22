/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — MeInsert Source-Available License v1.0 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { confirmNavigation, isConfirmOpen, closeConfirm } from '../../assets/js/ui/confirm.js';
test('confirmNavigation resolves false without DOM', async () => {
  closeConfirm();
  const result = await confirmNavigation({ title: 't', message: 'm' });
  assert.equal(result, false);
  assert.equal(isConfirmOpen(), false);
});
test('confirm module exports stable helpers', async () => {
  const mod = await import('../../assets/js/ui/confirm.js');
  assert.equal(typeof mod.confirmNavigation, 'function');
  assert.equal(typeof mod.closeConfirm, 'function');
  assert.equal(typeof mod.isConfirmOpen, 'function');
});