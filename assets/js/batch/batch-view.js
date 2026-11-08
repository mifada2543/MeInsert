/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import { BatchProcessor } from './batch-processor.js';
import {
  BATCH_LIMITS,
  categoryLabel,
  formatDuration,
  formatLimitBytes,
  selectionTotals,
  usageRows,
  validateSelection,
} from './batch-limits.js';
import { makeCsvReport, makeJsonReport } from './batch-report.js';
import { saveZipStreaming, uniqueOutputName } from './batch-zip.js';
import { el, clear, formatBytes, downloadBlob, qs } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { openLightbox } from '../ui/lightbox.js';
import { showToast } from '../ui/toast.js';
import { confirmNavigation } from '../ui/confirm.js';
import { openReviewDialog } from '../ui/review-dialog.js';
import { createSnapshot } from '../core/metadata-snapshot.js';
import { buildChangePlan } from '../core/change-plan.js';
import { previewKind } from '../ui/file-card.js';
import { asArray, asString, fileBaseName, fileExtension, safeOutputName, sameValue } from '../core/tag-utils.js';
import { STANDARD_FIELDS, crossFormatPatch } from '../core/format-map.js';
const MP3_DELETABLE_FRAMES = new Set([
  'TIT2', 'TPE1', 'TALB', 'TPE2', 'TYER', 'TDRC', 'TCON', 'TRCK', 'TPOS',
  'TCOM', 'COMM', 'USLT', 'TCOP', 'TSSE',
]);
const RAW_LOCKED = [
  { pattern: /^QuickTime:(Duration|ImageWidth|ImageHeight|CreateDate|ModifyDate)$/i, reason: 'Tag turunan QuickTime; tidak bisa dihapus selektif.' },
  { pattern: /^(File|SourceFile|FileType|Directory|FileName|FileSize)/i, reason: 'Tag berasal dari filesystem; bukan metadata file.' },
  { pattern: /^vendor$/i, reason: 'Vendor encoder tidak bisa dihapus selektif.' },
];
function isSelectedItem(item) {
  return Boolean(item?.included) && !item?.excluded;
}
function groupKey(item) {
  return `${item.detection?.id || 'unknown'}:${item.detection?.subtype || 'unknown'}`;
}
function statusLabel(item) {
  if (item?.status === 'done' && item.integrity?.status === 'failed') return 'Perlu diperiksa';
  if (item?.status === 'done' && item.integrity?.status === 'warning') return 'Selesai · catatan';
  switch (item?.status) {
    case 'queued': return 'Menunggu';
    case 'scanning': return 'Memeriksa';
    case 'ready': return 'Siap';
    case 'processing': return 'Memproses';
    case 'done': return 'Selesai';
    case 'error': return 'Gagal';
    case 'skipped': return 'Dilewati';
    case 'cancelled': return 'Dibatalkan';
    default: return 'Menunggu';
  }
}
function statusClass(item) {
  const status = item?.status || 'queued';
  if (status === 'done' && item.integrity?.status === 'failed') return 'is-error';
  if (status === 'done' && item.integrity?.status === 'warning') return 'is-skipped';
  if (status === 'skipped' || status === 'cancelled') return 'is-skipped';
  if (status === 'error') return 'is-error';
  if (status === 'done' || status === 'ready') return 'is-ready';
  return 'is-busy';
}
function zipEligible(item) {
  return Boolean(item?.outputFile) && (item.integrity?.status !== 'failed' || Boolean(item.includeFailedInZip));
}
function fileIconName(item) {
  const id = item?.detection?.id;
  if (id === 'image') return 'image';
  if (id === 'pdf') return 'pdf';
  if (id === 'mp3' || id === 'flac' || id === 'ogg' || (id === 'mp4' && item?.detection?.subtype === 'm4a')) return 'audio';
  if (id === 'mkv' || id === 'mp4') return 'video';
  return 'file';
}
function durationOf(item) {
  const value = Number(item?.readResult?.info?.duration);
  return Number.isFinite(value) && value > 0 ? value : null;
}
function tagCountOf(item) {
  return item?.readResult?.raw?.length || 0;
}
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
      const files = [...(event.dataTransfer?.files || [])];
      if (files.length) this.handleDropFiles(files);
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
    for (const file of files) {
      const item = await this.processor.prepare(file, this.items.length);
      if (!item) { rejected += 1; continue; }
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
  rebuildGroups() {
    const previous = new Map(this.groups.map((group) => [group.key, group]));
    const map = new Map();
    for (const item of this.items) {
      const key = groupKey(item);
      let group = map.get(key);
      if (!group) {
        const fields = typeof item.adapter?.fieldsFor === 'function'
          ? item.adapter.fieldsFor(item.detection.subtype)
          : (item.adapter?.fields || []);
        const existing = previous.get(key);
        group = existing || {
          key,
          detection: item.detection,
          adapter: item.adapter,
          category: item.category,
          label: item.detection?.label || 'Format lain',
          items: [],
          fields,
          values: Object.fromEntries(fields.map((field) => [field.id, ''])),
          remove: new Set(),
          open: true,
        };
        group.detection = item.detection;
        group.adapter = item.adapter;
        group.category = item.category;
        group.label = item.detection?.label || 'Format lain';
        group.fields = fields;
        group.items = [];
        map.set(key, group);
      }
      item.groupKey = key;
      group.items.push(item);
    }
    const order = { image: 0, pdf: 1, mp3: 2, flac: 2, ogg: 2, mp4: 3, mkv: 3 };
    this.groups = [...map.values()].sort((a, b) => (order[a.detection?.id] ?? 9) - (order[b.detection?.id] ?? 9) || a.label.localeCompare(b.label));
    this.groupMap = map;
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
        el('span', { textContent: label }),
      ));
    }
  }
  renderLimits() {
    clear(this.els.batchLimits);
    const rows = usageRows(this.items);
    const validation = validateSelection(this.items);
    for (const row of rows) {
      this.els.batchLimits.append(el('div', { className: `batch-limit${row.ok ? '' : ' is-over'}` },
        el('span', { textContent: row.label }),
        el('span', { textContent: `${row.count}/${row.maxFiles} file` }),
        el('span', { textContent: `${formatLimitBytes(row.bytes)} / ${formatLimitBytes(row.maxBytes)}` }),
      ));
    }
    const total = validation.totals;
    const totalLimit = total.hasVideo ? BATCH_LIMITS.totalWithVideo : BATCH_LIMITS.totalWithoutVideo;
    this.els.batchLimits.append(el('div', { className: `batch-limit batch-limit-total${total.bytes <= totalLimit ? '' : ' is-over'}` },
      el('span', { textContent: 'Total' }),
      el('span', { textContent: `${total.count} file` }),
      el('span', { textContent: `${formatLimitBytes(total.bytes)} / ${formatLimitBytes(totalLimit)}` }),
    ));
    const messages = el('div', { className: 'batch-limit-messages' });
    if (validation.messages.length) {
      for (const message of validation.messages) messages.append(el('p', { textContent: message }));
    } else if (this.items.length) {
      messages.append(el('p', { className: 'is-ok', textContent: 'Batas terpenuhi. File terpilih aman diproses.' }));
    }
    this.els.batchLimits.append(messages);
  }
  renderCrossForm() {
    const hasItems = this.items.length > 0;
    this.els.batchCross.hidden = !hasItems;
    this.els.batchCrossToggle.disabled = !hasItems;
    this.els.batchCrossToggle.checked = this.crossEnabled;
    this.els.batchCrossBody.hidden = !this.crossEnabled;
    clear(this.els.batchCrossFields);
    for (const field of STANDARD_FIELDS) {
      this.els.batchCrossFields.append(this.renderBatchField(this.cross, field));
    }
  }
  crossPatchFor(item) {
    if (!this.crossEnabled) return { set: {}, remove: [] };
    const group = this.groupMap.get(item.groupKey);
    const availableFields = new Set((group?.fields || []).map((field) => field.id));
    return crossFormatPatch({
      detectionId: item.detection?.id,
      availableFields,
      values: this.cross.values,
      removed: [...this.cross.remove],
    });
  }
  renderGroups() {
    clear(this.els.batchGroups);
    for (const group of this.groups) {
      const section = el('section', { className: 'batch-group', dataset: { groupKey: group.key } });
      const toggle = el('button', { className: 'batch-group-toggle', type: 'button', 'aria-expanded': String(group.open) },
        icon('chevron', 'batch-group-chevron'),
        el('span', { className: 'batch-group-title', textContent: group.label }),
        el('span', { className: 'batch-group-meta', textContent: `${group.items.length} file` }),
      );
      toggle.addEventListener('click', () => {
        group.open = !group.open;
        toggle.setAttribute('aria-expanded', String(group.open));
        body.hidden = !group.open;
      });
      const select = el('input', { type: 'checkbox', className: 'batch-group-select-input', 'aria-label': `Pilih semua file ${group.label}` });
      const selectWrap = el('label', { className: 'batch-group-select' }, select, el('span', { textContent: 'Pilih semua' }));
      select.addEventListener('change', () => {
        for (const item of group.items) {
          if (this.isLocked(item) || item.status === 'error') continue;
          item.included = select.checked;
          item.excluded = !select.checked;
          if (select.checked) item.skipReason = '';
        }
        this.updateAllRows();
        this.renderLimits();
        this.syncApply();
      });
      const head = el('div', { className: 'batch-group-head' }, toggle, selectWrap);
      const body = el('div', { className: 'batch-group-body', hidden: !group.open });
      const list = el('div', { className: 'batch-file-list' });
      for (const item of group.items) list.append(this.renderRow(item));
      list.append(this.renderAddTile());
      body.append(list);
      if (group.adapter) body.append(this.renderGroupForm(group));
      else body.append(el('p', { className: 'batch-group-note', textContent: 'Format ini belum didukung. File akan dilewati.' }));
      section.append(head, body);
      this.els.batchGroups.append(section);
      this.updateGroupHeader(group);
    }
  }
  renderRow(item) {
    const row = el('div', { className: `batch-file ${statusClass(item)}`, dataset: { itemId: item.id } });
    const checkbox = el('input', { type: 'checkbox', className: 'batch-file-checkbox', 'aria-label': `Sertakan ${item.file.name}` });
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
    });
    const main = el('button', { className: 'batch-file-main', type: 'button' });
    main.addEventListener('click', () => this.openDetail(item.id));
    main.append(
      el('span', { className: 'batch-file-icon' }, icon(fileIconName(item))),
      el('span', { className: 'batch-file-copy' },
        el('span', { className: 'batch-file-name', textContent: item.file.name }),
        el('span', { className: 'batch-file-meta', textContent: this.metaLine(item) }),
      ),
      el('span', { className: `batch-file-status ${statusClass(item)}`, textContent: statusLabel(item) }),
    );
    const progress = el('span', { className: 'batch-file-progress' }, el('span', { style: { width: `${item.progress || 0}%` } }));
    row.append(el('label', { className: 'batch-file-check' }, checkbox), main, progress);
    return row;
  }
  metaLine(item) {
    const parts = [formatBytes(item.file.size), item.detection?.label || 'Tidak dikenal'];
    const duration = durationOf(item);
    if (duration) parts.push(formatDuration(duration));
    if (item.readResult) parts.push(`${tagCountOf(item)} tag`);
    if (item.skipReason && item.status !== 'done') parts.push(item.skipReason);
    return parts.join(' · ');
  }
  isLocked(item) {
    return Boolean(item?.limitLocked) || item?.status === 'error';
  }
  renderAddTile() {
    const tile = el('button', {
      className: 'batch-add-tile',
      type: 'button',
      title: 'Tambah file ke batch',
      disabled: this.busy(),
    },
      icon('plus'),
      el('span', { textContent: 'Tambah file' }),
      el('small', { textContent: 'File baru otomatis masuk grup format yang sesuai' }),
    );
    tile.addEventListener('click', () => {
      if (this.busy()) {
        showToast('Tunggu proses selesai atau batalkan dulu.', 'info', 3200);
        return;
      }
      this.els.batchAddFileInput.click();
    });
    return tile;
  }
  renderGroupForm(group) {
    const form = el('div', { className: 'batch-group-form' });
    form.append(el('div', { className: 'batch-form-head' },
      el('div', {},
        el('h2', { textContent: `Edit ${group.label}` }),
        el('p', { textContent: 'Field kosong dibiarkan tidak berubah. Gunakan tombol hapus untuk mengosongkan tag pada semua file terpilih.' }),
      ),
      el('button', {
        className: 'button ghost small',
        type: 'button',
        on: {
          click: () => {
            for (const field of group.fields) group.values[field.id] = '';
            group.remove.clear();
            const replacement = this.renderGroupForm(group);
            form.replaceWith(replacement);
            this.syncApply();
          },
        },
      }, 'Bersihkan input'),
    ));
    const grid = el('div', { className: 'field-grid batch-field-grid' });
    for (const field of group.fields) grid.append(this.renderBatchField(group, field));
    form.append(grid);
    return form;
  }
  renderBatchField(group, field) {
    const wrapper = el('div', { className: `field batch-field ${field.type === 'textarea' || field.type === 'tags' ? 'is-full' : ''}`.trim(), dataset: { fieldId: field.id } });
    const inputId = `batch-${group.key.replace(/[^a-z0-9]/gi, '-')}-${field.id}`;
    const removeToggle = el('button', {
      className: 'batch-remove-toggle',
      type: 'button',
      'aria-pressed': String(group.remove.has(field.id)),
      title: `Hapus tag ${field.label}`,
      'aria-label': `Hapus tag ${field.label}`,
    }, icon('trash'));
    const head = el('div', { className: 'field-head' },
      el('label', { for: inputId, textContent: field.label }),
      el('span', { className: 'field-native', textContent: field.native || '' }),
      removeToggle,
    );
    const inputValue = group.values[field.id] || '';
    const common = {
      id: inputId,
      className: 'field-input',
      autocomplete: 'off',
      spellcheck: 'false',
      value: inputValue,
      placeholder: field.placeholder || '',
      on: { input: (event) => { group.values[field.id] = event.target.value; this.syncApply(); } },
    };
    if (field.maxLength) common.maxLength = field.maxLength;
    if (field.min !== undefined) common.min = field.min;
    if (field.max !== undefined) common.max = field.max;
    let input;
    if (field.type === 'textarea') {
      input = el('textarea', common);
      input.value = inputValue;
    } else if (field.type === 'date') input = el('input', { ...common, type: 'date' });
    else if (field.type === 'number') input = el('input', { ...common, type: 'number', inputmode: 'numeric' });
    else input = el('input', { ...common, type: 'text' });
    const syncDisabled = () => {
      const active = group.remove.has(field.id);
      removeToggle.classList.toggle('is-active', active);
      removeToggle.setAttribute('aria-pressed', String(active));
      input.disabled = active;
      wrapper.classList.toggle('is-removing', active);
    };
    removeToggle.addEventListener('click', () => {
      if (group.remove.has(field.id)) group.remove.delete(field.id);
      else group.remove.add(field.id);
      syncDisabled();
      this.syncApply();
    });
    if (field.helper) wrapper.append(head, input, el('p', { className: 'field-helper', textContent: field.helper }));
    else wrapper.append(head, input);
    syncDisabled();
    return wrapper;
  }
  updateAllRows() {
    for (const item of this.items) this.updateRow(item);
    this.updateGroupHeaders();
  }
  updateRow(item) {
    const row = qs(`[data-item-id="${CSS.escape(item.id)}"]`, this.els.batchGroups);
    if (!row) return;
    row.className = `batch-file ${statusClass(item)}`;
    const checkbox = row.querySelector('.batch-file-checkbox');
    checkbox.checked = isSelectedItem(item);
    checkbox.disabled = this.isLocked(item) || item.status === 'error';
    checkbox.title = item.skipReason || '';
    const status = row.querySelector('.batch-file-status');
    status.textContent = statusLabel(item);
    status.className = `batch-file-status ${statusClass(item)}`;
    row.querySelector('.batch-file-meta').textContent = this.metaLine(item);
    row.querySelector('.batch-file-progress span').style.width = `${item.progress || 0}%`;
  }
  updateGroupHeaders() {
    for (const group of this.groups) this.updateGroupHeader(group);
  }
  updateGroupHeader(group) {
    const section = qs(`[data-group-key="${CSS.escape(group.key)}"]`, this.els.batchGroups);
    if (!section) return;
    const selected = group.items.filter(isSelectedItem).length;
    const meta = section.querySelector('.batch-group-meta');
    if (meta) meta.textContent = `${selected}/${group.items.length} dipilih · ${formatBytes(group.items.reduce((sum, item) => sum + item.file.size, 0))}`;
    const checkbox = section.querySelector('.batch-group-select-input');
    if (checkbox) {
      const selectable = group.items.filter((item) => !this.isLocked(item) && item.status !== 'error');
      const checked = selectable.filter(isSelectedItem).length;
      checkbox.checked = selectable.length > 0 && checked === selectable.length;
      checkbox.indeterminate = checked > 0 && checked < selectable.length;
    }
  }
  operationCountFor(item) {
    const group = this.groupMap.get(item.groupKey);
    const before = item.readResult?.fields || {};
    const changed = new Set();
    if (group) {
      for (const field of group.fields) {
        if (group.remove.has(field.id)) {
          if (asString(before[field.id]).trim()) changed.add(`remove:${field.id}`);
          continue;
        }
        const value = group.values[field.id];
        if (asString(value).trim() && !sameValue(value, before[field.id])) changed.add(`field:${field.id}`);
      }
    }
    const cross = this.crossPatchFor(item);
    for (const [id, value] of Object.entries(cross.set || {})) {
      if (!sameValue(value, before[id])) changed.add(`field:${id}`);
    }
    for (const id of cross.remove || []) {
      if (asString(before[id]).trim()) changed.add(`remove:${id}`);
    }
    for (const key of item.removeRaw || []) {
      const tag = asString(key).trim().toLowerCase();
      const exists = (item.readResult?.raw || []).some((row) => asString(row.tag).trim().toLowerCase() === tag);
      if (exists) changed.add(`raw:${tag}`);
    }
    return changed.size;
  }
  unsavedSummary() {
    const files = this.items.filter((item) => this.operationCountFor(item) > 0);
    const operations = files.reduce((sum, item) => sum + this.operationCountFor(item), 0);
    return { files: files.length, operations };
  }
  hasUnsavedChanges() {
    return this.unsavedSummary().operations > 0;
  }
  collectGroupPayload(item) {
    const group = this.groups.find((entry) => entry.key === item.groupKey);
    const set = {};
    const remove = [...(group?.remove || [])];
    if (group) {
      for (const field of group.fields) {
        if (group.remove.has(field.id)) continue;
        const raw = asString(group.values[field.id]).trim();
        if (!raw) continue;
        set[field.id] = field.type === 'tags' ? asArray(raw) : raw;
      }
    }
    const cross = this.crossPatchFor(item);
    for (const [id, value] of Object.entries(cross.set)) set[id] = value;
    for (const id of cross.remove) remove.push(id);
    const rawRemove = [...item.removeRaw];
    const operations = {
      set: Object.keys(set).length,
      remove: new Set(remove).size,
      rawRemove: rawRemove.length,
    };
    return {
      payload: {
        set,
        remove: [...new Set(remove)],
        custom: [],
        customRemove: [],
        rawRemove,
      },
      operations,
      hasOperations: operations.set + operations.remove + operations.rawRemove > 0,
    };
  }
  syncApply() {
    const selected = this.selectedItems();
    const validation = validateSelection(this.items);
    let operationCount = 0;
    for (const item of selected) operationCount += this.operationCountFor(item);
    this.els.batchSelectedCount.textContent = `${selected.length} file dipilih`;
    this.els.batchOperationCount.textContent = `${operationCount} operasi`;
    this.els.batchApplyBtn.disabled = this.applying ? false : selected.length === 0 || !validation.ok;
    const label = this.applying ? 'Batalkan' : `Terapkan ke ${selected.length} file`;
    this.els.batchApplyBtn.querySelector('.icon')?.replaceChildren(icon(this.applying ? 'x' : 'check'));
    this.els.batchApplyBtn.lastChild.textContent = label;
    this.els.batchApplyBtn.title = validation.messages[0] || '';
    this.els.batchZipBtn.disabled = !this.items.some(zipEligible);
    const noItems = this.items.length === 0;
    this.els.batchReportJsonBtn.disabled = noItems;
    this.els.batchReportCsvBtn.disabled = noItems;
  }
  setStatus(text, isError = false) {
    this.els.batchStatus.textContent = text || '';
    this.els.batchStatus.classList.toggle('is-error', isError);
  }
  showProgress(show) {
    this.els.batchProgress.hidden = !show;
  }
  setProgress(percent, label) {
    const pct = Math.max(0, Math.min(100, Number(percent) || 0));
    this.els.batchProgressBar.style.width = `${pct}%`;
    if (label) this.els.batchProgressLabel.textContent = label;
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
  setApplyingUI(applying) {
    this.els.batchGroups.inert = applying;
    this.els.batchGroups.classList.toggle('is-disabled', applying);
    this.els.batchCross.inert = applying;
    this.els.batchCross.classList.toggle('is-disabled', applying);
    this.setAddEnabled(!applying);
  }
  handleApplyClick() {
    if (this.applying) {
      this.processor.cancel();
      this.setStatus('Membatalkan…');
      return;
    }
    this.apply();
  }
  planForItem(item, outputName) {
    if (!item.baselineSnapshot) {
      item.baselineSnapshot = createSnapshot({
        adapter: item.adapter,
        detection: item.detection,
        readResult: item.readResult,
      });
    }
    const plan = buildChangePlan({
      adapter: item.adapter,
      detection: item.detection,
      baseline: item.baselineSnapshot,
      payload: this.collectGroupPayload(item).payload,
      outputName,
      source: 'batch',
    });
    plan.fileName = item.file.name;
    plan.item = item;
    return plan;
  }
  async apply() {
    const selected = this.selectedItems();
    const validation = validateSelection(this.items);
    if (!selected.length) return;
    if (!validation.ok) {
      this.renderLimits();
      showToast(validation.messages[0], 'error', 7500);
      return;
    }
    const usedNames = new Set();
    const plans = [];
    const skipped = [];
    for (const item of selected) {
      const outputName = uniqueOutputName(item.file, usedNames, '-meinsert');
      const plan = this.planForItem(item, outputName);
      if (plan.hasOperations) plans.push(plan);
      else skipped.push(item);
    }
    if (!plans.length) {
      showToast('Tidak ada perubahan nyata pada file terpilih.', 'info', 4500);
      return;
    }
    const confirmed = await openReviewDialog({ plans, mode: 'batch' });
    if (!confirmed) {
      this.setStatus('Perubahan belum diterapkan.');
      return;
    }
    this.applying = true;
    this.els.batchApplyBtn.classList.add('is-processing');
    this.setApplyingUI(true);
    this.setStatus(`Menerapkan ke ${plans.length} file…`);
    this.showProgress(true);
    this.setProgress(2, 'Menyiapkan…');
    this.syncApply();
    let result;
    try {
      result = await this.processor.applyPlans(plans, skipped, (item) => this.updateItem(item));
    } catch (error) {
      this.setStatus(error?.message || 'Batch gagal diproses.', true);
      showToast(error?.message || 'Batch gagal diproses.', 'error', 8000);
      result = { ok: false, messages: [error?.message || 'Batch gagal diproses.'] };
    } finally {
      this.applying = false;
      this.els.batchApplyBtn.classList.remove('is-processing');
      this.setApplyingUI(false);
      this.showProgress(false);
    }
    if (!result.ok) {
      this.renderLimits();
      this.setStatus(result.messages[0] || 'Batch melebihi batas.', true);
      showToast(result.messages[0] || 'Batch melebihi batas.', 'error', 7500);
      this.syncApply();
      return;
    }
    const done = this.items.filter((item) => item.status === 'done').length;
    const failed = this.items.filter((item) => item.status === 'error').length;
    const flagged = this.items.filter((item) => item.integrity?.status === 'failed').length;
    const warned = this.items.filter((item) => item.integrity?.status === 'warning').length;
    this.setStatus(`${done} selesai · ${failed} gagal${flagged ? ` · ${flagged} perlu diperiksa` : warned ? ` · ${warned} bercatatan` : ''}`, failed > 0 || flagged > 0);
    if (flagged) {
      showToast(`${flagged} file perlu diperiksa integritasnya. Buka detail file sebelum mengunduh ZIP.`, 'error', 9000);
    } else if (failed) {
      showToast(`${failed} file gagal; ${done} file berhasil diproses.`, 'error', 7000);
    } else if (warned) {
      showToast(`${done} file berhasil dengan ${warned} catatan integritas.`, 'info', 7000);
    } else {
      showToast(`${done} file berhasil diproses. Unduh ZIP di atas.`, 'success', 7000);
    }
    this.renderSummary();
    this.renderLimits();
    this.updateAllRows();
    this.syncApply();
  }
  downloadReport(kind) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    if (kind === 'csv') {
      downloadBlob(new Blob([makeCsvReport(this.items)], { type: 'text/csv;charset=utf-8' }), `meinsert-laporan-${stamp}.csv`);
      return;
    }
    downloadBlob(new Blob([makeJsonReport(this.items)], { type: 'application/json' }), `meinsert-laporan-${stamp}.json`);
  }
  async downloadZip() {
    const doneItems = this.items.filter(zipEligible);
    if (!doneItems.length) {
      const flagged = this.items.filter((item) => item.outputFile && item.integrity?.status === 'failed').length;
      if (flagged) {
        showToast(`${flagged} file perlu diperiksa dan tidak disertakan. Pilih "Sertakan di ZIP" pada detail file bila tetap ingin mengunduhnya.`, 'error', 9000);
      }
      return;
    }
    const excludedFailed = this.items.filter((item) => item.outputFile && !zipEligible(item)).length;
    this.els.batchZipBtn.disabled = true;
    this.showProgress(true);
    this.setProgress(0, 'Menyiapkan ZIP…');
    try {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const result = await saveZipStreaming(doneItems, {
        reportJson: makeJsonReport(this.items),
        suggestedName: `meinsert-batch-${stamp}.zip`,
        onProgress: ({ stage, pct }) => this.setProgress(pct, stage),
      });
      const excludedNote = excludedFailed
        ? ` · ${excludedFailed} file bermasalah tidak disertakan`
        : '';
      if (result.streaming) {
        this.setStatus(`${doneItems.length} file disimpan langsung ke ZIP${excludedNote}.`);
      } else {
        downloadBlob(result.blob, `meinsert-batch-${stamp}.zip`);
        this.setStatus(`${doneItems.length} file masuk ZIP${excludedNote}.`);
      }
    } catch (error) {
      if (error?.code === 'SAVE_CANCELLED' || error?.name === 'AbortError') {
        this.setStatus('Penyimpanan ZIP dibatalkan.');
      } else {
        showToast(`ZIP gagal dibuat: ${error?.message || error}`, 'error', 8000);
        this.setStatus('ZIP gagal dibuat.', true);
      }
    } finally {
      this.showProgress(false);
      this.syncApply();
    }
  }
  openDetail(itemId, tab = 'summary') {
    this.activeItemId = itemId;
    this.detailTab = tab;
    this.els.batchWorkspace.hidden = true;
    this.els.batchDetail.hidden = false;
    this.renderDetail();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  closeDetail() {
    this.releasePreview();
    this.activeItemId = null;
    this.els.batchDetail.hidden = true;
    this.els.batchWorkspace.hidden = false;
    this.updateAllRows();
    this.syncApply();
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
    this.els.batchRawCount.textContent = String(tagCountOf(item));
    this.renderDetailHeader(item);
    this.renderPreview(item);
    if (this.detailTab === 'raw') this.renderRawDetail(item);
    else this.renderSummaryDetail(item);
  }
  previewKindOf(item) {
    const kind = previewKind(item?.detection);
    if (kind !== 'file') return kind;
    const type = item?.file?.type || '';
    if (type.startsWith('image/')) return 'image';
    if (type.startsWith('video/')) return 'video';
    if (type.startsWith('audio/')) return 'audio';
    if (type === 'application/pdf') return 'pdf';
    return 'file';
  }
  previewSignatureFor(item) {
    const kind = this.previewKindOf(item);
    const cover = kind === 'audio' && item?.readResult?.coverBytes ? 'cover' : 'nocover';
    return `${item.id}:${kind}:${cover}`;
  }
  releasePreview() {
    const host = this.els.batchPreview;
    host?.querySelectorAll('video, audio').forEach((media) => media.pause());
    const frame = host?.querySelector('iframe');
    if (frame) frame.src = 'about:blank';
    if (this.previewCoverUrl) URL.revokeObjectURL(this.previewCoverUrl);
    if (this.previewUrl) URL.revokeObjectURL(this.previewUrl);
    this.previewItemId = null;
    this.previewUrl = null;
    this.previewCoverUrl = null;
    this.previewNode = null;
    this.previewSignature = '';
    if (host) clear(host);
  }
  pausePreview() {
    this.els.batchPreview?.querySelectorAll('video, audio').forEach((media) => media.pause());
  }
  ensurePreview(item) {
    const signature = this.previewSignatureFor(item);
    if (this.previewNode && this.previewItemId === item.id && this.previewSignature === signature) {
      return this.previewNode;
    }
    this.releasePreview();
    const kind = this.previewKindOf(item);
    this.previewItemId = item.id;
    this.previewSignature = signature;
    this.previewUrl = this.createPreviewUrl(item, kind);
    if (kind === 'audio') this.previewCoverUrl = this.createCoverUrl(item);
    this.previewNode = this.buildPreview(item, kind);
    return this.previewNode;
  }
  createPreviewUrl(item, kind) {
    if (kind === 'pdf' && item.file.type !== 'application/pdf') {
      return URL.createObjectURL(new Blob([item.file], { type: 'application/pdf' }));
    }
    return URL.createObjectURL(item.file);
  }
  createCoverUrl(item) {
    const bytes = item.readResult?.coverBytes;
    if (!bytes || !(bytes.byteLength || bytes.length)) return null;
    const mime = item.readResult?.cover?.mimeType || 'image/jpeg';
    return URL.createObjectURL(new Blob([bytes], { type: mime }));
  }
  renderPreview(item) {
    const host = this.els.batchPreview;
    if (!host) return;
    const visible = this.detailTab !== 'raw';
    host.hidden = !visible;
    if (!visible) {
      this.pausePreview();
      return;
    }
    const node = this.ensurePreview(item);
    if (!host.contains(node)) host.replaceChildren(node);
  }
  buildPreview(item, kind) {
    const info = item.readResult?.info || {};
    const stage = el('div', { className: `batch-preview-stage batch-preview-stage--${kind}` });
    const wrap = el('div', { className: 'batch-preview-inner' });
    if (kind === 'image' || kind === 'video') this.setPreviewRatio(stage, info.width, info.height);
    if (kind === 'image') {
      const img = el('img', { src: this.previewUrl, alt: `Pratinjau ${item.file.name}`, decoding: 'async' });
      img.addEventListener('load', () => this.setPreviewRatio(stage, img.naturalWidth, img.naturalHeight));
      img.addEventListener('error', () => stage.replaceChildren(this.previewFallback(item, 'Gambar tidak bisa ditampilkan di browser ini.')));
      const zoom = el('button', {
        className: 'batch-preview-zoom',
        type: 'button',
        title: 'Klik untuk perbesar',
        'aria-label': `Perbesar pratinjau ${item.file.name}`,
        on: {
          click: () => {
            const dims = info.width && info.height ? ` · ${info.width} × ${info.height}` : '';
            openLightbox({
              src: this.previewUrl,
              alt: `Pratinjau ${item.file.name}`,
              caption: `${item.file.name}${dims}`,
            });
          },
        },
      }, img, el('span', { className: 'preview-zoom-badge', 'aria-hidden': 'true' }, icon('expand')));
      stage.append(zoom);
    } else if (kind === 'video') {
      const video = el('video', {
        src: this.previewUrl,
        controls: true,
        preload: 'metadata',
        playsinline: true,
        'aria-label': `Pratinjau video ${item.file.name}`,
      });
      video.addEventListener('loadedmetadata', () => this.setPreviewRatio(stage, video.videoWidth, video.videoHeight));
      video.addEventListener('error', () => stage.replaceChildren(this.previewFallback(item, 'Video tidak bisa diputar di browser ini.')));
      stage.append(video);
    } else if (kind === 'audio') {
      const cover = el('div', { className: 'batch-preview-cover' });
      if (this.previewCoverUrl) {
        const coverImg = el('img', { src: this.previewCoverUrl, alt: `Cover ${item.file.name}`, decoding: 'async' });
        coverImg.addEventListener('error', () => cover.replaceChildren(icon('audio'), el('span', { textContent: 'Tanpa cover' })));
        const coverZoom = el('button', {
          className: 'batch-preview-cover-zoom',
          type: 'button',
          title: 'Klik untuk perbesar cover',
          'aria-label': `Perbesar cover ${item.file.name}`,
          on: {
            click: () => openLightbox({
              src: this.previewCoverUrl,
              alt: `Cover ${item.file.name}`,
              caption: `Cover · ${item.file.name}`,
            }),
          },
        }, coverImg, el('span', { className: 'cover-zoom-badge', 'aria-hidden': 'true' }, icon('expand')));
        cover.append(coverZoom);
      } else {
        cover.append(icon('audio'), el('span', { textContent: 'Tanpa cover' }));
      }
      const copy = el('div', { className: 'batch-preview-audio-copy' },
        el('p', { textContent: this.previewDetail(item, kind) }),
        el('audio', {
          src: this.previewUrl,
          controls: true,
          preload: 'metadata',
          'aria-label': `Putar audio ${item.file.name}`,
        }),
      );
      stage.append(cover, copy);
    } else if (kind === 'pdf') {
      stage.append(el('iframe', { src: this.previewUrl, title: `Pratinjau PDF ${item.file.name}` }));
    } else {
      stage.append(this.previewFallback(item, 'Format file ini belum bisa dipratinjau.'));
    }
    const meta = el('div', { className: 'batch-preview-meta' },
      el('span', { className: 'batch-preview-kind' },
        icon(this.previewIcon(kind)),
        el('span', { textContent: item.detection?.label || this.previewKindLabel(kind) }),
      ),
      el('span', { className: 'batch-preview-detail', textContent: this.previewDetail(item, kind) }),
      el('a', { className: 'batch-preview-open', href: this.previewUrl, target: '_blank', rel: 'noopener', textContent: 'Buka di tab baru' }),
    );
    wrap.append(stage, meta);
    if (kind === 'pdf') {
      wrap.append(el('p', { className: 'batch-preview-note', textContent: 'Jika pratinjau kosong, buka PDF di tab baru. Tampilan PDF mengikuti browser Anda.' }));
    }
    return wrap;
  }
  setPreviewRatio(stage, width, height) {
    const w = Number(width);
    const h = Number(height);
    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return;
    stage.style.setProperty('--batch-preview-ratio', `${w} / ${h}`);
    stage.style.setProperty('--batch-preview-ratio-num', String(w / h));
  }
  previewDetail(item, kind) {
    const info = item.readResult?.info || {};
    const parts = [];
    if ((kind === 'image' || kind === 'video') && info.width && info.height) parts.push(`${info.width} × ${info.height}`);
    if ((kind === 'video' || kind === 'audio') && durationOf(item)) parts.push(formatDuration(durationOf(item)));
    if (kind === 'pdf' && info.pages) parts.push(`${info.pages} halaman`);
    if (!parts.length) parts.push(formatBytes(item.file.size));
    return parts.join(' · ');
  }
  previewKindLabel(kind) {
    return { image: 'Gambar', video: 'Video', audio: 'Audio', pdf: 'PDF', file: 'File' }[kind] || 'File';
  }
  previewIcon(kind) {
    return kind === 'file' ? 'file' : kind;
  }
  previewFallback(item, message) {
    return el('div', { className: 'batch-preview-fallback' },
      el('span', { className: 'batch-preview-fallback-icon' }, icon(this.previewIcon(this.previewKindOf(item)))),
      el('div', {},
        el('h3', { textContent: 'Pratinjau tidak tersedia' }),
        el('p', { textContent: message }),
        el('a', { href: this.previewUrl, target: '_blank', rel: 'noopener', textContent: 'Buka file di tab baru' }),
      ),
    );
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
        el('p', { textContent: this.metaLine(item) }),
        el('p', { className: `batch-detail-status ${statusClass(item)}`, textContent: item.skipReason && item.status !== 'done' ? item.skipReason : statusLabel(item) }),
      ),
      el('label', { className: 'batch-detail-include', for: 'batchDetailInclude' },
        checkbox,
        el('span', { textContent: 'Ikut diterapkan' }),
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
      dl.append(el('dt', { textContent: term }), el('dd', { textContent: String(value) }));
    }
    panel.append(dl);
    if (item.warnings?.length) {
      const warnings = el('div', { className: 'batch-warning-list' });
      warnings.append(el('h3', { textContent: 'Warning' }));
      for (const warning of item.warnings) warnings.append(el('p', { textContent: warning }));
      panel.append(warnings);
    }
    if (item.error) {
      panel.append(el('div', { className: 'error-card', role: 'alert' },
        el('div', {},
          el('h3', { textContent: 'File tidak bisa diproses' }),
          el('p', { textContent: item.error?.message || String(item.error) }),
        ),
      ));
    }
    if (item.integrity) panel.append(this.renderIntegrityReport(item));
    if (item.outputFile) {
      panel.append(el('div', { className: 'batch-output-note' },
        icon('check'),
        el('div', {},
          el('h3', { textContent: 'Hasil siap diunduh' }),
          el('p', { textContent: `${item.outputFile.name} · ${formatBytes(item.outputFile.size)}. ${zipEligible(item) ? 'File masuk ke ZIP saat tombol Unduh ZIP ditekan.' : 'File tidak masuk ZIP sampai Anda memilih untuk menyertakannya.'}` }),
        ),
      ));
    }
  }
  renderIntegrityReport(item) {
    const integrity = item.integrity;
    const counts = integrity.summary || {};
    const block = el('div', { className: `batch-integrity is-${integrity.status}` });
    block.append(el('h3', {
      textContent: integrity.status === 'failed'
        ? 'Integritas metadata perlu diperiksa'
        : integrity.status === 'warning' ? 'Metadata tersimpan dengan catatan' : 'Integritas metadata terverifikasi',
    }));
    block.append(el('p', { className: 'batch-integrity-summary' },
      `${counts.checked || 0} diperiksa · ${counts.preserved || 0} utuh`
      + `${counts.lost ? ` · ${counts.lost} hilang` : ''}`
      + `${counts.changed ? ` · ${counts.changed} berubah` : ''}`
      + `${counts.added ? ` · ${counts.added} baru` : ''}`
      + `${counts.knownLoss ? ` · ${counts.knownLoss} kehilangan dikenal` : ''}`
      + `${counts.unverified ? ` · ${counts.unverified} belum terverifikasi` : ''}`,
    ));
    if (integrity.findings?.length) {
      const list = el('div', { className: 'batch-integrity-findings' });
      for (const finding of integrity.findings) {
        const value = finding.before || finding.after
          ? ` · ${finding.before || '—'} → ${finding.after || '—'}`
          : '';
        list.append(el('p', { className: `batch-integrity-finding is-${finding.severity || 'warning'}` },
          el('strong', { textContent: finding.message }),
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
        el('span', { textContent: 'Sertakan file ini di ZIP meskipun integritasnya perlu diperiksa' }),
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
        el('h2', { textContent: 'Tag belum tersedia' }),
        el('p', { textContent: 'File ini gagal dibaca, sehingga daftar raw tag tidak bisa ditampilkan.' }),
      ));
      return;
    }
    const raw = item.readResult.raw || [];
    const note = item.adapter?.meta?.id === 'mp3'
      ? 'MP3 ditulis ulang oleh MeInsert; frame ID3 yang tidak dikenal juga akan hilang.'
      : 'Tag yang tidak bisa dihapus selektif ditandai dengan gembok.';
    const search = el('input', { type: 'search', placeholder: 'Cari tag atau nilai…', className: 'batch-raw-search', 'aria-label': 'Cari raw tag' });
    const selectedCount = el('span', { className: 'raw-count' });
    const selectAll = el('button', { className: 'button ghost small', type: 'button' }, 'Pilih semua yang bisa dihapus');
    const clearSelection = el('button', { className: 'button ghost small', type: 'button' }, 'Bersihkan pilihan');
    const tbody = el('tbody');
    const rows = [];
    const updateSelectedCount = () => {
      selectedCount.textContent = `${item.removeRaw.size} dipilih dari ${raw.length} tag`;
      for (const { tr, row, checkbox } of rows) checkbox.checked = item.removeRaw.has(row.tag);
    };
    for (const row of raw) {
      const { ok, reason } = this.rawDeletability(item, row);
      const checkbox = el('input', { type: 'checkbox', 'aria-label': `Hapus tag ${row.tag}` });
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
      const tr = el('tr', { className: ok ? '' : 'is-locked', title: reason || '' },
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
      el('p', { className: 'batch-raw-note', textContent: note }),
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
            el('th', { textContent: 'Nilai' }),
          )),
          tbody,
        ),
      ),
    );
  }
}
