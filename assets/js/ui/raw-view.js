/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import { el, clear } from './dom.js';
import { icon } from './icons.js';
export function renderRaw(container, { raw = [], query = '' }) {
  clear(container);
  if (!raw.length) {
    container.append(el('div', { className: 'empty-state' },
      el('div', { className: 'empty-icon' }, icon('tag')),
      el('h2', { textContent: 'Belum ada tag terbaca' }),
      el('p', { textContent: 'File ini belum memiliki metadata yang bisa ditampilkan, atau formatnya menyimpan metadata di tempat yang tidak diekspos.' }),
    ));
    return;
  }
  const count = el('span', { className: 'raw-count', textContent: `${raw.length} tag` });
  const search = el('input', {
    type: 'search',
    placeholder: 'Cari nama tag atau nilai…',
    value: query,
    autocomplete: 'off',
    'aria-label': 'Cari tag mentah',
  });
  const tbody = el('tbody');
  const rows = raw.map((row) => {
    const tr = el('tr', {},
      el('td', { className: 'raw-name' },
        el('div', { className: 'raw-tag', textContent: row.tag }),
        el('div', { className: 'raw-group', textContent: row.group || '' }),
      ),
      el('td', { className: 'raw-value', textContent: row.value }),
    );
    tr.dataset.search = `${row.tag} ${row.group} ${row.value}`.toLowerCase();
    tbody.append(tr);
    return tr;
  });
  search.addEventListener('input', () => {
    const q = search.value.trim().toLowerCase();
    let visible = 0;
    for (const row of rows) {
      const match = !q || row.dataset.search.includes(q);
      row.hidden = !match;
      if (match) visible += 1;
    }
    count.textContent = q ? `${visible} dari ${raw.length} tag` : `${raw.length} tag`;
  });
  container.append(
    el('div', { className: 'raw-toolbar' },
      el('div', { className: 'search-wrap' }, icon('search'), search),
      count,
    ),
    el('div', { className: 'raw-table-wrap' },
      el('table', { className: 'raw-table' },
        el('thead', {}, el('tr', {},
          el('th', { textContent: 'Tag' }),
          el('th', { textContent: 'Nilai' }),
        )),
        tbody,
      ),
    ),
  );
}
