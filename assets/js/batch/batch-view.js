/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import { bindTranslation, t, translated } from '../i18n/index.js';
import { BatchProcessor } from './batch-processor.js';
import { BATCH_LIMITS, formatLimitBytes, selectionTotals, usageRows, validateSelection } from './batch-limits.js';
import { clear, el, formatBytes, qs } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { showToast } from '../ui/toast.js';
import { confirmNavigation } from '../ui/confirm.js';
import { STANDARD_FIELDS } from '../core/format-map.js';
import { isSelectedItem } from './batch-item.js';
import { BatchGroupsView } from './batch-groups-view.js';
import { createGroupHistoryController } from './batch-history.js';
import { BatchSaveFlow } from './batch-save-flow.js';
import { BatchDetailView } from './batch-detail-view.js';
import { BatchPreview } from './batch-preview.js';
import { bindFolderDropCopy, collectDroppedFiles } from './batch-folder-drop.js';
import { mountBatchCleanAction } from '../ui/batch-clean.js';

export class BatchController {
  constructor(client) {
    this.client = client;
    this.processor = new BatchProcessor(client);
    this.items = [];
    this.groups = [];
    this.activeItemId = null;
    this.detailTab = 'summary';
    this.applying = false;
    this.scanning = false;
    this.adding = false;
    this.previewItemId = null;
    this.previewUrl = null;
    this.previewCoverUrl = null;
    this.previewNode = null;
    this.previewSignature = '';
    this.groupMap = new Map();
    // Satu stack undo/redo untuk setiap grup format; grup MP3 dan grup PDF
    // tidak saling memengaruhi.
    this.groupHistories = new Map();
    this.groupHistoryController = createGroupHistoryController({
      getGroup: (key) => this.groupMap.get(key) || null,
      histories: this.groupHistories,
    });
    this.updateFrame = 0;
    this.pendingUpdates = new Map();
    this.latestStage = '';
    this.crossEnabled = false;
    this.cross = {
      key: 'cross',
      label: 'Lintas format',
      fields: STANDARD_FIELDS,
      values: Object.fromEntries(STANDARD_FIELDS.map((field) => [field.id, ''])),
      remove: new Set(),
    };
    this.els = {
      landing: qs('#landing'),
      modeSingle: qs('#modeSingleBtn'),
      modeBatch: qs('#modeBatchBtn'),
      dropCard: qs('#dropCard'),
      batchDropCard: qs('#batchDropCard'),
      batchFileInput: qs('#batchFileInput'),
      batchBrowseBtn: qs('#batchBrowseBtn'),
      batchWorkspace: qs('#batchWorkspace'),
      batchAddFileInput: qs('#batchAddFileInput'),
      batchBackBtn: qs('#batchBackBtn'),
      batchStatus: qs('#batchStatus'),
      batchSummary: qs('#batchSummary'),
      batchLimits: qs('#batchLimits'),
      batchCross: qs('#batchCross'),
      batchCrossToggle: qs('#batchCrossToggle'),
      batchCrossBody: qs('#batchCrossBody'),
      batchCrossFields: qs('#batchCrossFields'),
      batchGroups: qs('#batchGroups'),
      batchProgress: qs('#batchProgress'),
      batchProgressBar: qs('#batchProgressBar'),
      batchProgressLabel: qs('#batchProgressLabel'),
      batchApplyBtn: qs('#batchApplyBtn'),
      batchSelectedCount: qs('#batchSelectedCount'),
      batchOperationCount: qs('#batchOperationCount'),
      batchRetryBtn: qs('#batchRetryBtn'),
      batchStopAfter: qs('#batchStopAfter'),
      batchZipBtn: qs('#batchZipBtn'),
      batchReportJsonBtn: qs('#batchReportJsonBtn'),
      batchReportCsvBtn: qs('#batchReportCsvBtn'),
      batchDetail: qs('#batchDetail'),
      batchDetailBackBtn: qs('#batchDetailBackBtn'),
      batchDetailStatus: qs('#batchDetailStatus'),
      batchDetailHeader: qs('#batchDetailHeader'),
      batchPreview: qs('#batchPreview'),
      batchDetailPanel: qs('#batchDetailPanel'),
      batchTabSummary: qs('#batchTabSummary'),
      batchTabRaw: qs('#batchTabRaw'),
      batchRawCount: qs('#batchRawCount'),
    };
    this.bind();
    this.setMode('single');
  }
  bind() {
    const { els } = this;
    els.modeSingle?.addEventListener('click', () => this.setMode('single'));
    els.modeBatch?.addEventListener('click', () => this.setMode('batch'));
    for (const selector of ['#batchBackBtn', '#batchDetailBackBtn']) {
      const span = qs(`${selector} .icon`);
      if (span) span.replaceChildren(icon('arrowLeft'));
    }
    els.batchZipBtn.querySelector('.icon')?.replaceChildren(icon('download'));
    els.batchBrowseBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      els.batchFileInput.click();
    });
    els.batchAddFileInput.addEventListener('change', () => {
      const files = [...(els.batchAddFileInput.files || [])];
      els.batchAddFileInput.value = '';
      if (files.length) this.addFiles(files);
    });
    els.batchFileInput.addEventListener('change', () => {
      const files = [...(els.batchFileInput.files || [])];
      els.batchFileInput.value = '';
      if (files.length) this.addFiles(files);
    });
    bindFolderDropCopy(els.batchDropCard);
    this.bindDrop(els.batchDropCard);
    this.bindDrop(els.batchWorkspace);
    els.batchBackBtn.addEventListener('click', () => { void this.resetBatch({ confirmIfBusy: true }); });
    els.batchDetailBackBtn.addEventListener('click', () => this.closeDetail());
    els.batchCrossToggle.addEventListener('change', () => {
      this.crossEnabled = els.batchCrossToggle.checked;
      els.batchCrossBody.hidden = !this.crossEnabled;
      this.syncApply();
    });
    els.batchApplyBtn.addEventListener('click', () => this.handleApplyClick());
    els.batchZipBtn.addEventListener('click', () => this.downloadZip());
    els.batchRetryBtn?.addEventListener('click', () => this.retryFailed());
    els.batchReportJsonBtn.addEventListener('click', () => this.downloadReport('json'));
    els.batchReportCsvBtn.addEventListener('click', () => this.downloadReport('csv'));
    els.batchTabSummary.addEventListener('click', () => this.setDetailTab('summary'));
    els.batchTabRaw.addEventListener('click', () => this.setDetailTab('raw'));
    window.addEventListener('beforeunload', (event) => {
      if (this.hasUnsavedChanges() || this.applying || this.scanning) {
        event.preventDefault();
        event.returnValue = '';
      }
    });
    window.addEventListener('pagehide', () => {
      this.releasePreview();
      this.client.disposeAllSync();
    });
    this.batchCleanAction = mountBatchCleanAction({
      controller: this,
      container: qs('.batch-head-actions'),
    });
  }
  busy() {
    return this.applying || this.scanning || this.adding;
  }
  setAddEnabled(enabled) {
    for (const tile of this.els.batchGroups.querySelectorAll('.batch-add-tile')) {
      tile.disabled = !enabled;
    }
  }
  bindDrop(card) {
    let depth = 0;
    const enter = (event) => { event.preventDefault(); depth += 1; card.classList.add('is-dragging'); };
    const leave = (event) => {
      event.preventDefault();
      depth = Math.max(0, depth - 1);
      if (!depth) card.classList.remove('is-dragging');
    };
    card.addEventListener('dragenter', enter);
    card.addEventListener('dragover', (event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; });
    card.addEventListener('dragleave', leave);
    card.addEventListener('drop', (event) => {
      event.preventDefault();
      depth = 0;
      card.classList.remove('is-dragging');
      void collectDroppedFiles(event.dataTransfer).then((files) => {
        if (files.length) this.handleDropFiles(files);
      });
    });
  }
  handleDropFiles(files) {
    if (this.applying || this.scanning || this.adding) {
      showToast('Tunggu proses selesai atau batalkan dulu.', 'info', 3200);
      return;
    }
    this.addFiles(files);
  }
  setMode(mode) {
    this.mode = mode;
    const batchEls = [this.els.modeSingle, this.els.modeBatch, this.els.dropCard, this.els.batchDropCard];
    if (batchEls.some((node) => !node)) {
      this.mode = 'batch';
      if (this.els.landing) this.els.landing.hidden = false;
      if (this.els.batchDropCard) this.els.batchDropCard.hidden = false;
      if (this.els.dropCard) this.els.dropCard.hidden = true;
      return;
    }
    const batch = mode === 'batch';
    this.els.modeSingle.classList.toggle('is-active', !batch);
    this.els.modeBatch.classList.toggle('is-active', batch);
    this.els.modeSingle.setAttribute('aria-selected', String(!batch));
    this.els.modeBatch.setAttribute('aria-selected', String(batch));
    this.els.dropCard.hidden = batch;
    this.els.batchDropCard.hidden = !batch;
  }
  async addFiles(files) {
    if (this.adding) return;
    if (this.applying || this.scanning) {
      showToast('Tunggu proses selesai atau batalkan dulu.', 'info', 3200);
      return;
    }
    this.adding = true;
    let rejected = 0;
    const prepared = [];
    for (const file of files) {
      const item = await this.processor.prepare(file, this.items.length + prepared.length);
      if (!item) { rejected += 1; continue; }
      prepared.push(item);
    }
    // Validate the prospective batch with the shared limits before any item is
    // excluded, so an oversized folder drop gets a clear i18n message. The
    // existing per-item exclusion below still enforces the same limits.
    if (prepared.length) {
      const validation = validateSelection([...this.items, ...prepared]);
      if (!validation.ok) {
        const total = validation.totals;
        const totalLimit = total.hasVideo ? BATCH_LIMITS.totalWithVideo : BATCH_LIMITS.totalWithoutVideo;
        showToast(total.bytes > totalLimit
          ? t('ui.totalBatchSizeExceeds', { v0: formatLimitBytes(totalLimit) })
          : t('ui.batchExceedsTheLimits'), 'error', 7000);
      }
    }
    for (const item of prepared) {
      const limitReason = this.initialLimitReason(item);
      if (limitReason) {
        item.excluded = true;
        item.included = false;
        item.status = 'skipped';
        item.skipReason = limitReason;
      }
      this.items.push(item);
    }
    this.rebuildGroups();
    this.renderFull();
    this.showBatchWorkspace();
    this.setStatus(rejected ? `${rejected} file tidak dikenali atau formatnya belum didukung.` : '');
    this.adding = false;
    this.scanQueued();
  }
  initialLimitReason(candidate) {
    const totals = selectionTotals(this.items);
    const category = candidate.category;
    const limit = BATCH_LIMITS[category];
    const usage = totals.byCategory[category];
    if (usage.count + 1 > limit.maxFiles) return `${limit.label}: maksimal ${limit.maxFiles} file.`;
    if (usage.bytes + candidate.file.size > limit.maxBytes) return `${limit.label}: ukuran batch melebihi ${formatLimitBytes(limit.maxBytes)}.`;
    const hasVideo = totals.hasVideo || category === 'video';
    const totalLimit = hasVideo ? BATCH_LIMITS.totalWithVideo : BATCH_LIMITS.totalWithoutVideo;
    if (totals.bytes + candidate.file.size > totalLimit) return `Total ukuran batch melebihi ${formatLimitBytes(totalLimit)}.`;
    return '';
  }
  selectedItems() {
    return this.items.filter(isSelectedItem);
  }
  async scanQueued() {
    const queued = this.items.some((item) => item.status === 'queued');
    if (!queued) return;
    this.processor.cancelRequested = false;
    this.scanning = true;
    this.setAddEnabled(false);
    this.setStatus('Memeriksa metadata…');
    this.showProgress(true);
    try {
      await this.processor.scan(this.items, (item) => this.updateItem(item));
    } finally {
      this.scanning = false;
      this.setAddEnabled(true);
      this.showProgress(false);
    }
    this.renderSummary();
    this.renderLimits();
    this.updateAllRows();
    this.syncApply();
    const ready = this.items.filter((item) => item.status === 'ready').length;
    const failed = this.items.filter((item) => item.status === 'error').length;
    this.setStatus(`${ready} siap · ${failed} gagal`, failed > 0);
  }
  handleProgressOverall(items) {
    if (!items.length) return 0;
    const total = items.reduce((sum, item) => sum + (item.status === 'done' || item.status === 'ready' ? 1 : (Number(item.progress) || 0) / 100), 0);
    return Math.round((total / items.length) * 100);
  }
  updateItem(item) {
    if (!item) return;
    this.pendingUpdates.set(item.id, item);
    if (item.stage) this.latestStage = item.stage;
    if (this.updateFrame) return;
    this.updateFrame = requestAnimationFrame(() => this.flushItemUpdates());
  }
  flushItemUpdates() {
    this.updateFrame = 0;
    const pending = [...this.pendingUpdates.values()];
    this.pendingUpdates.clear();
    for (const item of pending) this.updateRow(item);
    this.renderSummary();
    this.renderLimits();
    this.updateGroupHeaders();
    this.syncApply();
    const done = this.items.filter((entry) => entry.status === 'done' || entry.status === 'ready' || entry.status === 'error' || entry.status === 'skipped' || entry.status === 'cancelled').length;
    this.setProgress(Math.round((done / Math.max(1, this.items.length)) * 100), this.latestStage || 'Memeriksa…');
    if (this.activeItemId && pending.some((item) => item.id === this.activeItemId)) this.renderDetail();
  }
  renderFull() {
    this.renderSummary();
    this.renderLimits();
    this.renderCrossForm();
    this.renderGroups();
    this.syncApply();
  }
  renderSummary() {
    clear(this.els.batchSummary);
    const totalBytes = this.items.reduce((sum, item) => sum + (Number(item.file?.size) || 0), 0);
    const ready = this.items.filter((item) => item.status === 'ready' || item.status === 'done').length;
    const failed = this.items.filter((item) => item.status === 'error').length;
    const flagged = this.items.filter((item) => item.status === 'done' && item.integrity?.status === 'failed').length;
    const skipped = this.items.filter((item) => item.status === 'skipped' || item.excluded).length;
    const stats = [
      [this.items.length, 'file'],
      [ready, 'siap'],
      [failed, 'gagal'],
      [flagged, 'perlu diperiksa'],
      [skipped, 'dilewati'],
      [formatBytes(totalBytes), 'ukuran'],
    ];
    for (const [value, label] of stats) {
      this.els.batchSummary.append(el('div', { className: 'batch-stat' },
        el('strong', { textContent: String(value) }),
        el('span', { textContent: translated(() => label === 'file' ? t('count.fileLabel', { count: value }) : label) }),
      ));
    }
  }
  renderLimits() {
    clear(this.els.batchLimits);
    const rows = usageRows(this.items);
    const validation = validateSelection(this.items);
    for (const row of rows) {
      this.els.batchLimits.append(el('div', { className: `batch-limit${row.ok ? '' : ' is-over'}` },
        el('span', { textContent: translated(() => (row.label)) }),
        el('span', { textContent: translated(() => (t('ui.files2', { v0: row.count, v1: row.maxFiles }))) }),
        el('span', { textContent: translated(() => (`${formatLimitBytes(row.bytes)} / ${formatLimitBytes(row.maxBytes)}`)) }),
      ));
    }
    const total = validation.totals;
    const totalLimit = total.hasVideo ? BATCH_LIMITS.totalWithVideo : BATCH_LIMITS.totalWithoutVideo;
    this.els.batchLimits.append(el('div', { className: `batch-limit batch-limit-total${total.bytes <= totalLimit ? '' : ' is-over'}` },
      el('span', { textContent: 'Total' }),
      el('span', { textContent: translated(() => (t('ui.files', { v0: total.count }))) }),
      el('span', { textContent: translated(() => (`${formatLimitBytes(total.bytes)} / ${formatLimitBytes(totalLimit)}`)) }),
    ));
    const messages = el('div', { className: 'batch-limit-messages' });
    if (validation.messages.length) {
      for (const message of validation.messages) messages.append(el('p', { textContent: translated(() => (message)) }));
    } else if (this.items.length) {
      messages.append(el('p', { className: 'is-ok', textContent: translated(() => (t('ui.withinLimitsSelectedFilesCanBeProcessed'))) }));
    }
    this.els.batchLimits.append(messages);
  }
  setStatus(text, isError = false) {
    bindTranslation(this.els.batchStatus, 'textContent', () => (text || ''));
    this.els.batchStatus.classList.toggle('is-error', isError);
  }
  showProgress(show) {
    this.els.batchProgress.hidden = !show;
  }
  setProgress(percent, label) {
    const pct = Math.max(0, Math.min(100, Number(percent) || 0));
    this.els.batchProgressBar.style.width = `${pct}%`;
    if (label) bindTranslation(this.els.batchProgressLabel, 'textContent', () => (label));
  }
  showBatchWorkspace() {
    this.els.landing.hidden = true;
    this.els.batchDetail.hidden = true;
    this.els.batchWorkspace.hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  showLanding() {
    this.els.landing.hidden = false;
    this.els.batchWorkspace.hidden = true;
    this.els.batchDetail.hidden = true;
  }
  async resetBatch({ confirmIfBusy = false } = {}) {
    this.batchCleanAction?.close?.();
    if (this.updateFrame) cancelAnimationFrame(this.updateFrame);
    this.updateFrame = 0;
    this.pendingUpdates.clear();
    this.latestStage = '';
    if (this.applying) {
      this.processor.cancel();
      this.setStatus('Membatalkan…');
      return;
    }
    if (confirmIfBusy && this.items.some((item) => item.status === 'processing' || item.status === 'scanning')) {
      const ok = await confirmNavigation({
        title: 'Pemrosesan masih berjalan',
        message: 'Progres pemrosesan ini akan dibatalkan. Lanjutkan kembali?',
        confirmLabel: 'Ya, batalkan',
        cancelLabel: 'Tetap di sini',
      });
      if (!ok) return;
      this.processor.cancel();
    } else if (confirmIfBusy && this.hasUnsavedChanges()) {
      const { files, operations } = this.unsavedSummary();
      const ok = await confirmNavigation({
        title: 'Perubahan belum disimpan',
        message: `Anda memiliki ${operations} perubahan belum disimpan pada ${files} file. Progres ini akan hilang. Lanjutkan meninggalkan?`,
        confirmLabel: 'Ya, tinggalkan',
        cancelLabel: 'Tetap di sini',
      });
      if (!ok) return;
    }
    this.releasePreview();
    for (const item of this.items) {
      item.outputFile = null;
    }
    this.items = [];
    this.groups = [];
    this.groupHistories.clear();
    this.activeItemId = null;
    this.els.batchFileInput.value = '';
    this.crossEnabled = false;
    this.cross.values = Object.fromEntries(STANDARD_FIELDS.map((field) => [field.id, '']));
    this.cross.remove.clear();
    if (this.els.batchCrossToggle) this.els.batchCrossToggle.checked = false;
    clear(this.els.batchGroups);
    clear(this.els.batchSummary);
    clear(this.els.batchLimits);
    clear(this.els.batchCrossFields);
    this.els.batchCross.hidden = true;
    this.setApplyingUI(false);
    this.setStatus('');
    this.showProgress(false);
    this.showLanding();
    this.setMode('single');
  }
}
for (const component of [BatchGroupsView, BatchSaveFlow, BatchDetailView, BatchPreview]) {
  const descriptors = Object.getOwnPropertyDescriptors(component.prototype);
  delete descriptors.constructor;
  Object.defineProperties(BatchController.prototype, descriptors);
}
