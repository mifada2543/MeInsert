/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — MeInsert Source-Available License v1.0 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import { bindTranslation, t, translated } from '../i18n/index.js';
import { el, clear, formatBytes } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { formatDuration } from './batch-limits.js';
import { durationOf, fileIconName, isSelectedItem, statusClass, statusLabel, tagCountOf, zipEligible } from './batch-item.js';
const MP3_DELETABLE_FRAMES = new Set([
  'TIT2', 'TPE1', 'TALB', 'TPE2', 'TYER', 'TDRC', 'TCON', 'TRCK', 'TPOS',
  'TCOM', 'COMM', 'USLT', 'TCOP', 'TSSE',
]);
const RAW_LOCKED = [
  { pattern: /^QuickTime:(Duration|ImageWidth|ImageHeight|CreateDate|ModifyDate)$/i, reason: 'Tag turunan QuickTime; tidak bisa dihapus selektif.' },
  { pattern: /^(File|SourceFile|FileType|Directory|FileName|FileSize)/i, reason: 'Tag berasal dari filesystem; bukan metadata file.' },
  { pattern: /^vendor$/i, reason: 'Vendor encoder tidak bisa dihapus selektif.' },
];
export class BatchDetailView {
  openDetail(itemId, tab = 'summary') {
    this.detailFocusBefore = typeof document !== 'undefined' && document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    this.activeItemId = itemId;
    this.detailTab = tab;
    this.els.batchWorkspace.hidden = true;
    this.els.batchDetail.hidden = false;
    this.renderDetail();
    this.els.batchDetailBackBtn?.focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  closeDetail() {
    this.releasePreview();
    this.activeItemId = null;
    this.els.batchDetail.hidden = true;
    this.els.batchWorkspace.hidden = false;
    this.updateAllRows();
    this.syncApply();
    const restore = this.detailFocusBefore;
    this.detailFocusBefore = null;
    if (restore?.isConnected && typeof restore.focus === 'function') {
      try { restore.focus(); } catch { /* noop */ }
    }
  }
  setDetailTab(tab) {
    this.detailTab = tab;
    for (const button of [this.els.batchTabSummary, this.els.batchTabRaw]) {
      const active = button.dataset.tab === tab;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', String(active));
    }
    this.renderDetail();
  }
  activeItem() {
    return this.items.find((item) => item.id === this.activeItemId) || null;
  }
  renderDetail() {
    const item = this.activeItem();
    if (!item) {
      this.closeDetail();
      return;
    }
    bindTranslation(this.els.batchRawCount, 'textContent', () => (String(tagCountOf(item))));
    this.renderDetailHeader(item);
    this.renderPreview(item);
    if (this.detailTab === 'raw') this.renderRawDetail(item);
    else this.renderSummaryDetail(item);
  }
  renderDetailHeader(item) {
    clear(this.els.batchDetailHeader);
    const checkbox = el('input', { type: 'checkbox', id: 'batchDetailInclude' });
    checkbox.checked = isSelectedItem(item);
    checkbox.disabled = this.isLocked(item) || item.status === 'error';
    checkbox.addEventListener('change', () => {
      if (checkbox.disabled) return;
      item.included = checkbox.checked;
      item.excluded = !checkbox.checked;
      if (checkbox.checked) item.skipReason = '';
      this.renderLimits();
      this.updateGroupHeaders();
      this.syncApply();
      this.setStatus(isSelectedItem(item) ? 'File ini ikut diterapkan.' : 'File ini tidak diterapkan.');
    });
    this.els.batchDetailHeader.append(
      el('div', { className: 'batch-detail-icon' }, icon(fileIconName(item))),
      el('div', { className: 'batch-detail-copy' },
        el('h2', { textContent: item.file.name }),
        el('p', { textContent: translated(() => (this.metaLine(item))) }),
        el('p', { className: `batch-detail-status ${statusClass(item)}`, textContent: translated(() => (item.skipReason && item.status !== 'done' ? item.skipReason : statusLabel(item))) }),
      ),
      el('label', { className: 'batch-detail-include', for: 'batchDetailInclude' },
        checkbox,
        el('span', { textContent: translated(() => (t('ui.includeInProcessing'))) }),
      ),
    );
  }
  renderSummaryDetail(item) {
    const panel = clear(this.els.batchDetailPanel);
    const info = item.readResult?.info || {};
    const rows = [
      ['Format', item.detection?.label || 'Tidak dikenali'],
      ['Subtype', item.detection?.subtype || '-'],
      ['Ukuran', formatBytes(item.file.size)],
      ['Durasi', durationOf(item) ? formatDuration(durationOf(item)) : '-'],
      ['Dimensi', info.width && info.height ? `${info.width} × ${info.height}` : '-'],
      ['Codec', info.videoCodec || info.audioCodec || info.codec || '-'],
      ['Halaman', info.pages ? String(info.pages) : '-'],
      ['Jumlah tag', String(tagCountOf(item))],
    ];
    const dl = el('dl', { className: 'batch-info-grid' });
    for (const [term, value] of rows) {
      dl.append(el('dt', { textContent: translated(() => (term)) }), el('dd', { textContent: String(value) }));
    }
    panel.append(dl);
    if (item.warnings?.length) {
      const warnings = el('div', { className: 'batch-warning-list' });
      warnings.append(el('h3', { textContent: translated(() => t('ui.warnings')) }));
      for (const warning of item.warnings) warnings.append(el('p', { textContent: translated(() => (warning)) }));
      panel.append(warnings);
    }
    if (item.error) {
      panel.append(el('div', { className: 'error-card', role: 'alert' },
        el('div', {},
          el('h3', { textContent: translated(() => (t('ui.cannotProcessFile'))) }),
          el('p', { textContent: translated(() => (item.error?.message || String(item.error))) }),
        ),
      ));
    }
    if (item.integrity) panel.append(this.renderIntegrityReport(item));
    if (item.outputFile) {
      panel.append(el('div', { className: 'batch-output-note' },
        icon('check'),
        el('div', {},
          el('h3', { textContent: translated(() => (t('ui.resultReadyToDownload'))) }),
          el('p', { textContent: translated(() => (`${item.outputFile.name} · ${formatBytes(item.outputFile.size)}. ${zipEligible(item) ? t('ui.theFileIsIncludedWhenYouSelectDownloadZIP') : t('ui.theFileIsExcludedFromTheZIPUntilYou')}`)) }),
        ),
      ));
    }
  }
  renderIntegrityReport(item) {
    const integrity = item.integrity;
    const counts = integrity.summary || {};
    const block = el('div', { className: `batch-integrity is-${integrity.status}` });
    block.append(el('h3', {
      textContent: translated(() => (integrity.status === 'failed'
        ? t('ui.metadataIntegrityNeedsReview')
        : integrity.status === 'warning' ? t('ui.metadataSavedWithNotes') : t('ui.metadataIntegrityVerified'))),
    }));
    block.append(el('p', { className: 'batch-integrity-summary' },
      translated(() => [
        t('ui.checkedIntact', { v0: counts.checked || 0, v1: counts.preserved || 0 }),
        counts.lost ? t('ui.missing', { v0: counts.lost }) : '',
        counts.changed ? t('ui.changed', { v0: counts.changed }) : '',
        counts.added ? t('ui.new', { v0: counts.added }) : '',
        counts.knownLoss ? t('ui.knownLosses', { v0: counts.knownLoss }) : '',
        counts.unverified ? t('ui.unverified', { v0: counts.unverified }) : '',
      ].join('')),
    ));
    if (integrity.findings?.length) {
      const list = el('div', { className: 'batch-integrity-findings' });
      for (const finding of integrity.findings) {
        const value = finding.before || finding.after
          ? ` · ${finding.before || '—'} → ${finding.after || '—'}`
          : '';
        list.append(el('p', { className: `batch-integrity-finding is-${finding.severity || 'warning'}` },
          el('strong', { textContent: translated(() => (finding.message)) }),
          value ? el('span', { textContent: value }) : null,
        ));
      }
      block.append(list);
    }
    if (integrity.status === 'failed' && item.outputFile) {
      const checkbox = el('input', { type: 'checkbox', id: `zip-failed-${item.id}` });
      checkbox.checked = Boolean(item.includeFailedInZip);
      checkbox.addEventListener('change', () => {
        item.includeFailedInZip = checkbox.checked;
        this.syncApply();
        this.renderSummaryDetail(item);
      });
      block.append(el('label', { className: 'batch-integrity-include', for: `zip-failed-${item.id}` },
        checkbox,
        el('span', { textContent: translated(() => (t('ui.includeThisFileInTheZIPDespiteIntegrityWarnings'))) }),
      ));
    }
    return block;
  }
  rawDeletability(item, row) {
    const tag = row.tag || '';
    const locked = RAW_LOCKED.find((entry) => entry.pattern.test(tag));
    if (locked) return { ok: false, reason: locked.reason };
    if (item.adapter?.meta?.id === 'mp3') {
      if (tag === 'APIC') return { ok: true, reason: '' };
      if (tag.startsWith('TXXX:')) return { ok: true, reason: '' };
      if (MP3_DELETABLE_FRAMES.has(tag)) return { ok: true, reason: '' };
      return { ok: false, reason: 'Frame ID3 tidak dikenal; rewrite MP3 menghapus frame ini juga.' };
    }
    if (item.adapter?.meta?.id === 'pdf' && /^\/Metadata$/i.test(tag)) {
      return { ok: false, reason: 'XMP stream PDF tidak bisa dihapus selektif dari Info dictionary.' };
    }
    return { ok: true, reason: '' };
  }
  renderRawDetail(item) {
    const panel = clear(this.els.batchDetailPanel);
    if (!item.readResult) {
      panel.append(el('div', { className: 'empty-state' },
        el('div', { className: 'empty-icon' }, icon('tag')),
        el('h2', { textContent: translated(() => (t('ui.tagsNotAvailableYet'))) }),
        el('p', { textContent: translated(() => (t('ui.thisFileCouldNotBeReadSoItsRaw'))) }),
      ));
      return;
    }
    const raw = item.readResult.raw || [];
    const note = item.adapter?.meta?.id === 'mp3'
      ? 'MP3 ditulis ulang oleh MeInsert; frame ID3 yang tidak dikenal juga akan hilang.'
      : 'Tag yang tidak bisa dihapus selektif ditandai dengan gembok.';
    const search = el('input', { type: 'search', placeholder: translated(() => (t('ui.searchTagsOrValues'))), className: 'batch-raw-search', 'aria-label': translated(() => (t('ui.searchRawTags'))) });
    const selectedCount = el('span', { className: 'raw-count' });
    const selectAll = el('button', { className: 'button ghost small', type: 'button' }, translated(() => (t('ui.selectAllRemovableTags'))));
    const clearSelection = el('button', { className: 'button ghost small', type: 'button' }, translated(() => (t('ui.clearSelection'))));
    const tbody = el('tbody');
    const rows = [];
    const updateSelectedCount = () => {
      bindTranslation(selectedCount, 'textContent', () => (t('ui.selectedOutOfTags', { v0: item.removeRaw.size, v1: raw.length })));
      for (const { row, checkbox } of rows) checkbox.checked = item.removeRaw.has(row.tag);
    };
    for (const row of raw) {
      const { ok, reason } = this.rawDeletability(item, row);
      const checkbox = el('input', { type: 'checkbox', 'aria-label': translated(() => (t('ui.removeTag', { v0: row.tag }))) });
      checkbox.checked = item.removeRaw.has(row.tag);
      checkbox.disabled = !ok;
      checkbox.addEventListener('change', () => {
        if (ok) {
          if (checkbox.checked) item.removeRaw.add(row.tag);
          else item.removeRaw.delete(row.tag);
          updateSelectedCount();
          this.syncApply();
        }
      });
      const tr = el('tr', { className: ok ? '' : 'is-locked', title: translated(() => (reason || '')) },
        el('td', { className: 'raw-check' }, ok ? checkbox : icon('lock', 'batch-lock')),
        el('td', {},
          el('div', { className: 'raw-tag', textContent: row.tag }),
          el('div', { className: 'raw-group', textContent: row.group || '' }),
        ),
        el('td', { className: 'raw-value', textContent: row.value }),
      );
      tr.dataset.search = `${row.tag} ${row.group} ${row.value}`.toLowerCase();
      tbody.append(tr);
      rows.push({ tr, row, checkbox });
    }
    search.addEventListener('input', () => {
      const query = search.value.trim().toLowerCase();
      for (const { tr } of rows) tr.hidden = Boolean(query) && !tr.dataset.search.includes(query);
    });
    selectAll.addEventListener('click', () => {
      for (const { row } of rows) {
        if (this.rawDeletability(item, row).ok) item.removeRaw.add(row.tag);
      }
      updateSelectedCount();
      this.syncApply();
    });
    clearSelection.addEventListener('click', () => {
      item.removeRaw.clear();
      updateSelectedCount();
      this.syncApply();
    });
    updateSelectedCount();
    panel.append(
      el('p', { className: 'batch-raw-note', textContent: translated(() => (note)) }),
      el('div', { className: 'raw-toolbar batch-raw-toolbar' },
        el('div', { className: 'search-wrap' }, icon('search'), search),
        selectedCount,
        selectAll,
        clearSelection,
      ),
      el('div', { className: 'raw-table-wrap' },
        el('table', { className: 'raw-table' },
          el('thead', {}, el('tr', {},
            el('th', { textContent: '' }),
            el('th', { textContent: 'Tag' }),
            el('th', { textContent: translated(() => (t('ui.value'))) }),
          )),
          tbody,
        ),
      ),
    );
  }
}