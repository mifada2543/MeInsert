import { el, formatBytes } from './dom.js';
import { icon } from './icons.js';

export function renderResultCard(result, { onDownload }) {
  const warnings = result.warnings || [];
  const button = el('button', {
    className: 'button primary result-download',
    type: 'button',
    on: {
      click: () => {
        onDownload();
        button.classList.add('is-done');
        button.replaceChildren(icon('check'), document.createTextNode('Terunduh'));
      },
    },
  }, icon('download'), 'Unduh hasil');
  return el('div', { className: 'result-card', role: 'status' },
    el('div', { className: 'result-icon' }, icon('check')),
    el('div', { className: 'result-copy' },
      el('h2', { textContent: 'Metadata berhasil disimpan' }),
      el('p', { textContent: `${result.filename || 'file'} · ${formatBytes(result.blob?.size || 0)}` }),
      warnings.length
        ? el('div', { className: 'result-warnings', textContent: warnings.join(' ') })
        : el('p', { className: 'result-warnings', textContent: 'Hasil sudah dibaca ulang dan siap diunduh.' }),
    ),
    button,
  );
}
