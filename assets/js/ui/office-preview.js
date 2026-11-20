/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
/* Card ringkas yang membantu pengguna mengenali dokumen Office yang dipilih. */
import { t, translated } from '../i18n/index.js';
import { el, formatBytes } from './dom.js';
import { icon } from './icons.js';
function stat(key, value) {
  if (!value || !Number(value)) return null;
  return el('span', { className: 'office-preview-stat' },
    el('strong', { textContent: String(value) }),
    el('span', { textContent: translated(() => ` ${t(key)}`) }),
  );
}
function chip(key, tone = '') {
  return el('span', { className: `office-chip${tone ? ` office-chip--${tone}` : ''}`, textContent: translated(() => t(key)) });
}
export function buildOfficePreview({ file, detection, readResult }) {
  const info = readResult?.info || {};
  const title = String(info.title || '').trim();
  const creator = String(info.creator || '').trim();
  const subtitle = creator
    ? el('p', { className: 'office-preview-byline' },
        el('span', { textContent: translated(() => `${t('ui.officePreviewBy')} `) }),
        el('strong', { textContent: creator }),
      )
    : null;
  const stats = el('p', { className: 'office-preview-stats' },
    ...[
      stat('ui.officePreviewPages', info.pages),
      stat('ui.officePreviewSlides', info.slides),
      stat('ui.officePreviewSheets', info.sheets),
      stat('ui.officePreviewWords', info.words),
    ].filter(Boolean),
    el('span', { className: 'office-preview-stat', textContent: formatBytes(file?.size || 0) }),
  );
  const status = el('div', { className: 'office-preview-status' },
    ...(info.signed ? [chip('ui.officePreviewSigned', 'warn')] : []),
    ...(info.macros ? [chip('ui.officePreviewMacro', 'warn')] : []),
    ...(info.valid === false ? [chip('ui.officePreviewInvalid', 'bad')] : [chip('ui.officePreviewValid')]),
  );
  return el('div', {
    className: 'office-preview',
    role: 'group',
    'aria-label': translated(() => t('ui.officePreviewSummary')),
  },
    el('div', { className: 'office-preview-head' },
      icon('file'),
      el('span', { className: 'office-preview-format', textContent: String(detection?.subtype || detection?.label || 'Office').toUpperCase() }),
      el('span', { className: 'office-preview-kind', textContent: translated(() => t('ui.officePreviewSummary')) }),
    ),
    title
      ? el('p', { className: 'office-preview-title', textContent: title })
      : el('p', { className: 'office-preview-title office-preview-title--empty', textContent: translated(() => t('ui.officePreviewUntitled')) }),
    subtitle,
    stats,
    status,
    el('p', { className: 'office-preview-hint', textContent: translated(() => t('ui.officePreviewHint')) }),
  );
}