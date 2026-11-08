/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import { el, formatBytes } from './dom.js';
import { icon } from './icons.js';

function integrityCopy(integrity) {
  if (!integrity) {
    return { title: 'Metadata berhasil disimpan', tone: 'ok', note: 'Hasil sudah dibaca ulang dan siap diunduh.' };
  }
  if (integrity.status === 'failed') {
    return {
      title: 'Metadata tersimpan, tetapi perlu diperiksa',
      tone: 'failed',
      note: 'Ada metadata yang berubah atau hilang di luar rencana. Periksa laporan sebelum mengunduh.',
    };
  }
  if (integrity.status === 'warning') {
    return {
      title: 'Metadata tersimpan dengan catatan',
      tone: 'warning',
      note: 'Perubahan yang diminta berhasil, tetapi ada metadata yang tidak dapat diverifikasi sepenuhnya.',
    };
  }
  if (integrity.status === 'unverified') {
    return {
      title: 'Metadata tersimpan, verifikasi belum lengkap',
      tone: 'warning',
      note: 'Hasil tidak bisa dibaca ulang sepenuhnya. Periksa file sebelum digunakan.',
    };
  }
  return {
    title: 'Metadata berhasil disimpan',
    tone: 'ok',
    note: 'Seluruh metadata yang tidak diubah tetap utuh.',
  };
}

function integrityRow(finding) {
  const before = String(finding.before ?? '').trim();
  const after = String(finding.after ?? '').trim();
  return el('li', { className: `result-finding is-${finding.severity || 'warning'}` },
    el('div', { className: 'result-finding-head' },
      el('strong', { textContent: finding.message || finding.code || 'Temuan integritas' }),
      el('span', { className: 'result-finding-target', textContent: finding.target || '' }),
    ),
    before || after
      ? el('p', { className: 'result-finding-values', textContent: `${before || '—'} → ${after || '—'}` })
      : null,
  );
}

function integrityDetails(integrity) {
  if (!integrity) return null;
  const summary = integrity.summary || {};
  const findings = integrity.findings || [];
  const details = el('details', { className: 'result-integrity' },
    el('summary', { className: 'result-integrity-summary' },
      icon('tag'),
      el('span', { textContent: 'Laporan integritas' }),
      el('span', { className: 'result-integrity-badge', textContent: String(findings.length) }),
    ),
    el('div', { className: 'result-integrity-body' },
      el('p', { className: 'result-integrity-counts' },
        `${summary.checked || 0} metadata diperiksa · ${summary.expected || 0} sesuai rencana · ${summary.preserved || 0} tetap`,
      ),
      findings.length
        ? el('ul', { className: 'result-findings' }, ...findings.map(integrityRow))
        : el('p', { className: 'result-integrity-ok', textContent: 'Tidak ada perubahan di luar rencana.' }),
    ),
  );
  return details;
}

export function renderResultCard(result, { onDownload }) {
  const warnings = result.warnings || [];
  const integrity = result.integrity || null;
  const copy = integrityCopy(integrity);
  const buttonLabel = copy.tone === 'failed' ? 'Unduh dengan peringatan' : 'Unduh hasil';
  const button = el('button', {
    className: `button primary result-download${copy.tone === 'failed' ? ' is-warning' : ''}`,
    type: 'button',
    on: {
      click: () => {
        onDownload();
        button.classList.add('is-done');
        button.replaceChildren(icon('check'), document.createTextNode('Terunduh'));
      },
    },
  }, icon('download'), buttonLabel);
  return el('div', { className: `result-card is-${copy.tone}`, role: 'status' },
    el('div', { className: 'result-icon' }, icon(copy.tone === 'ok' ? 'check' : 'alert')),
    el('div', { className: 'result-copy' },
      el('h2', { textContent: copy.title }),
      el('p', { textContent: `${result.filename || 'file'} · ${formatBytes(result.blob?.size || 0)}` }),
      el('p', { className: `result-warnings${copy.tone === 'ok' ? '' : ' is-visible'}`, textContent: copy.note }),
      warnings.length
        ? el('p', { className: 'result-warnings is-visible', textContent: warnings.join(' ') })
        : null,
      integrityDetails(integrity),
    ),
    button,
  );
}
