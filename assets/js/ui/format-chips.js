/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnSlnnQ6bWlmYWRhMjU0MzoyMDI2 */
import { OFFICE_NOTE_KEY, statusSummary, visibleChips } from '../core/format-capabilities.js';
import { bindTranslation, t, translated } from '../i18n/index.js';
import { clear, el } from './dom.js';
export function initFormatChips() {
  if (typeof document === 'undefined') return;
  const root = document.getElementById('formatChips');
  if (!root) return;
  clear(root);
  for (const chip of visibleChips()) {
    root.append(
      el('span', { className: 'chip' },
        el('span', { className: `chip-dot ${chip.group}`, 'aria-hidden': 'true' }),
        chip.label),
    );
  }
  root.append(
    el('p', { className: 'format-chips__note' }, translated(() => t(OFFICE_NOTE_KEY))),
  );
  const strip = el('div', {
    className: 'format-status',
    role: 'group',
    'aria-label': translated(() => t('ui.supportedFormats')),
  });
  for (const summary of statusSummary()) {
    const explanation = () => `${t(summary.key)}: ${summary.count}`;
    const label = el('span', { className: 'format-status__label' }, translated(() => t(summary.key)));
    const item = el('span', { className: 'format-status__item' },
      el('span', { className: `format-status__dot format-status__dot--${summary.status}`, 'aria-hidden': 'true' }),
      label,
      el('span', { className: 'format-status__count' }, String(summary.count)),
    );
    bindTranslation(item, 'title', explanation);
    bindTranslation(item, 'aria-label', explanation);
    strip.append(item);
  }
  root.append(strip);
}