/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — MeInsert Source-Available License v1.0 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import { renderRawDiff } from './raw-diff.js';
import { t, translated, translatedNode, translateSource } from '../i18n/index.js';
import { el, formatBytes } from './dom.js';
import { icon } from './icons.js';
function integrityCopy(integrity) {
  if (!integrity) {
    return { title: 'Metadata berhasil disimpan', tone: 'ok', note: 'Hasil sudah dibaca ulang dan siap diunduh.' };
  }
  if (integrity.status === 'failed') {
    return {
      title: 'Integritas gagal — file asli dipertahankan',
      tone: 'failed',
      note: 'Hasil tidak dijadikan file kerja. Periksa laporan; unduhan berisiko memerlukan konfirmasi.',
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
      el('strong', { textContent: translated(() => (finding.message || finding.code || t('ui.integrityFindings'))) }),
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
      el('span', { textContent: translated(() => (t('ui.integrityReport'))) }),
      el('span', { className: 'result-integrity-badge', textContent: translated(() => (String(findings.length))) }),
    ),
    el('div', { className: 'result-integrity-body' },
      el('p', { className: 'result-integrity-counts' },
        translated(() => (t('ui.metadataEntriesCheckedAsPlannedUnchanged', { v0: summary.checked || 0, v1: summary.expected || 0, v2: summary.preserved || 0 }))),
      ),
      findings.length
        ? el('ul', { className: 'result-findings' }, ...findings.map(integrityRow))
        : el('p', { className: 'result-integrity-ok', textContent: translated(() => (t('ui.noChangesOutsideThePlan'))) }),
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
        if (onDownload() === false) return;
        button.classList.add('is-done');
        button.replaceChildren(icon('check'), translatedNode(() => t('ui.downloaded')));
      },
    },
  }, icon('download'), translated(() => (buttonLabel)));
  return el('div', { className: `result-card is-${copy.tone}`, role: 'status' },
    el('div', { className: 'result-icon' }, icon(copy.tone === 'ok' ? 'check' : 'alert')),
    el('div', { className: 'result-copy' },
      el('h2', { textContent: translated(() => (copy.title)) }),
      el('p', { textContent: `${result.filename || 'file'} · ${formatBytes(result.blob?.size || 0)}` }),
      el('p', { className: `result-warnings${copy.tone === 'ok' ? '' : ' is-visible'}`, textContent: translated(() => (copy.note)) }),
      warnings.length
        ? el('p', { className: 'result-warnings is-visible', textContent: translated(() => (warnings.map(translateSource).join(' '))) })
        : null,
      integrityDetails(integrity),
      renderRawDiff(result.rawDiff),
    ),
    button,
  );
}