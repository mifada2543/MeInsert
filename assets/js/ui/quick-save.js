/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import { t, translated } from '../i18n/index.js';
import { el, qs } from './dom.js';

export const QUICK_SAVE_STORAGE_KEY = 'meinsert.quickSave';
const DANGER = 'danger';

export function readQuickSavePreference() {
  try {
    return globalThis.localStorage?.getItem(QUICK_SAVE_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setQuickSavePreference(enabled) {
  const value = Boolean(enabled);
  try {
    globalThis.localStorage?.setItem(QUICK_SAVE_STORAGE_KEY, value ? 'true' : 'false');
  } catch { /* storage is optional */ }
  return value;
}

export function quickSaveEnabled() {
  return readQuickSavePreference();
}

/**
 * Conservative gate for skipping the review dialog. Only ordinary field
 * operations qualify: covers, custom tags, raw tags, extension mismatches and
 * any danger-level risk (signed PDF, blocked memory) always require review.
 * The write path and integrity verification are unchanged for quick saves.
 */
export function isQuickSaveEligible(plan) {
  if (!plan || !plan.hasOperations) return false;
  if (plan.extensionMismatch?.found) return false;
  if (plan.memory?.level === 'block') return false;
  const operations = Array.isArray(plan.operations) ? plan.operations : [];
  if (!operations.length) return false;
  for (const operation of operations) {
    if (!operation || operation.kind !== 'field') return false;
  }
  const payload = plan.payload || {};
  if (payload.cover) return false;
  if (Array.isArray(payload.rawRemove) && payload.rawRemove.length) return false;
  for (const risk of Array.isArray(plan.risks) ? plan.risks : []) {
    if (risk?.severity === DANGER) return false;
  }
  return true;
}

/** Build and mount the single-editor toggle without changing the HTML. */
export function mountQuickSaveToggle({ container, onChange } = {}) {
  if (typeof document === 'undefined') return null;
  const host = container || qs('.action-bar') || qs('.editor-head');
  if (!host) return null;
  const existing = qs('.quick-save-toggle', host);
  if (existing) return existing;
  const input = el('input', {
    type: 'checkbox',
    className: 'quick-save-input',
    id: 'quickSaveToggle',
    checked: readQuickSavePreference(),
    'aria-label': translated(() => t('ui.quickSave')),
    'aria-describedby': 'quickSaveHint',
  });
  const hint = el('span', {
    className: 'quick-save-hint',
    id: 'quickSaveHint',
    textContent: translated(() => t('ui.quickSaveHint')),
  });
  const toggle = el('label', {
    className: 'quick-save-toggle',
    for: 'quickSaveToggle',
    title: translated(() => t('ui.quickSaveHint')),
  },
    input,
    el('span', { className: 'quick-save-copy' },
      el('span', { className: 'quick-save-label', textContent: translated(() => t('ui.quickSave')) }),
      hint,
    ),
  );
  input.addEventListener('change', () => {
    const value = setQuickSavePreference(input.checked);
    if (typeof onChange === 'function') onChange(value);
  });
  host.insertBefore(toggle, qs('.action-buttons', host) || null);
  return toggle;
}
