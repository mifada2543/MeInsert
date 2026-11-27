/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — MeInsert Source-Available License v1.0 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import { downloadBlob, el } from './dom.js';
import { t, translated } from '../i18n/index.js';
import { labeledInput, toolButton } from './presets.js';

export function renderRawDiff(diff) {
  if (!diff) return null;
  const unchanged = el('input', { type: 'checkbox' });
  const table = el('div', { className: 'raw-diff-table' });
  const text = (key) => translated(() => t(key));
  const refresh = () => {
    const rows = unchanged.checked ? diff : diff.filter(({ status }) => status !== 'unchanged');
    const entries = rows.slice(0, 250).map(({ group, tag, status, before, after }) => el('tr', {},
      el('th', { scope: 'row' }, [group, tag].filter(Boolean).join(' / ')),
      el('td', {}, text(`rawDiff.${status}`)),
      el('td', {}, before ?? '—'),
      el('td', {}, after ?? '—'),
    ));
    table.replaceChildren(rows.length ? el('table', {},
      el('thead', {}, el('tr', {}, ...['batchTools.field', 'rawDiff.status', 'rawDiff.before', 'rawDiff.after']
        .map((key) => el('th', { scope: 'col' }, text(key))))),
      el('tbody', {}, ...entries),
    ) : el('p', {}, text('rawDiff.empty')));
    if (rows.length > entries.length) table.append(el('p', {}, text('rawDiff.truncated')));
  };
  unchanged.addEventListener('change', refresh);
  const details = el('details', { className: 'result-integrity' }, el('summary', {}, text('rawDiff.title')),
    labeledInput('rawDiff.showUnchanged', unchanged),
    toolButton('rawDiff.export', () => downloadBlob(new Blob([JSON.stringify(diff, null, 2)], { type: 'application/json' }), 'meinsert-raw-diff.json')),
    table);
  details.addEventListener('toggle', () => { if (details.open && !table.childNodes.length) refresh(); });
  return details;
}
