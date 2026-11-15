/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import { bindTranslation, t } from '../i18n/index.js';
import { downloadBlob } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { showToast } from '../ui/toast.js';
import { openReviewDialog } from '../ui/review-dialog.js';
import { createSnapshot } from '../core/metadata-snapshot.js';
import { buildChangePlan } from '../core/change-plan.js';
import { estimateForBatch } from '../core/memory-estimate.js';
import { asArray, asString, fileExtension, sameValue } from '../core/tag-utils.js';
import { validateSelection } from './batch-limits.js';
import { makeCsvReport, makeJsonReport } from './batch-report.js';
import { saveZipStreaming, uniqueOutputName } from './batch-zip.js';
import { zipEligible } from './batch-item.js';
import { batchDraftKey, setEditingNavigation } from '../ui/editing-navigation.js';
export class BatchSaveFlow {
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
  failedItems() {
    return this.items.filter((item) => item.status === 'error');
  }
  retryFailed() {
    const failed = this.failedItems();
    if (!failed.length || this.applying) return;
    for (const item of failed) {
      item.status = item.readResult ? 'ready' : 'queued';
      item.included = true;
      item.excluded = false;
      item.skipReason = '';
      item.error = null;
      item.outputFile = null;
      item.integrity = null;
      item.progress = 0;
      item.stage = item.readResult ? 'Siap diulang' : 'Antre ulang';
      this.updateItem(item);
    }
    this.setStatus(`Mengulang ${failed.length} file gagal…`);
    const queued = this.items.filter((item) => item.status === 'queued');
    return queued.length
      ? this.scanQueued().then(() => this.apply())
      : this.apply();
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
    const draft = batchDraftKey(this);
    if (this._navigationWasApplying && !this.applying) this._navigationCompletedDraft = draft;
    this._navigationWasApplying = this.applying;
    const pending = this.items.some((item) => ['queued', 'reading', 'ready', 'processing'].includes(item.status));
    const editedAgain = this._navigationCompletedDraft !== undefined && draft !== this._navigationCompletedDraft;
    setEditingNavigation(this.busy() || pending || this.items.length > 0 && editedAgain);
    bindTranslation(this.els.batchSelectedCount, 'textContent', () => (t('ui.filesSelected', { v0: selected.length })));
    bindTranslation(this.els.batchOperationCount, 'textContent', () => (t('ui.operations', { v0: operationCount })));
    this.els.batchApplyBtn.disabled = this.applying ? false : selected.length === 0 || !validation.ok;
    const label = this.applying ? 'Batalkan' : `Terapkan ke ${selected.length} file`;
    this.els.batchApplyBtn.querySelector('.icon')?.replaceChildren(icon(this.applying ? 'x' : 'check'));
    bindTranslation(this.els.batchApplyBtn.querySelector('[data-i18n]') || this.els.batchApplyBtn.lastChild, 'textContent', () => (label));
    bindTranslation(this.els.batchApplyBtn, 'title', () => (validation.messages[0] || ''));
    const failedCount = this.items.filter((item) => item.status === 'error').length;
    if (this.els.batchRetryBtn) {
      this.els.batchRetryBtn.hidden = failedCount === 0 || this.applying;
      this.els.batchRetryBtn.disabled = this.applying;
      bindTranslation(this.els.batchRetryBtn, 'textContent', () => (t('ui.retryFailedFiles2', { v0: failedCount })));
    }
    this.els.batchZipBtn.disabled = !this.items.some(zipEligible);
    const noItems = this.items.length === 0;
    this.els.batchReportJsonBtn.disabled = noItems;
    this.els.batchReportCsvBtn.disabled = noItems;
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
        readResult: {
          ...item.readResult,
          warnings: [...new Set([item.detection?.warning, ...(item.readResult?.warnings || [])].filter(Boolean))],
        },
      });
    }
    const plan = buildChangePlan({
      adapter: item.adapter,
      detection: item.detection,
      baseline: item.baselineSnapshot,
      payload: this.collectGroupPayload(item).payload,
      outputName,
      source: 'batch',
      memory: this._batchMemory || null,
    });
    plan.fileName = item.file.name;
    plan.item = item;
    {
      const originalExt = fileExtension(item.file?.name || '');
      const detectedExt = (item.detection?.ext || '').toLowerCase();
      const base = outputName.replace(/\.[^.]+$/, '');
      if (originalExt && detectedExt && originalExt.toLowerCase() !== detectedExt) {
        plan.extensionMismatch = {
          found: true,
          originalExt: originalExt.toLowerCase(),
          detectedExt,
          recommendedName: outputName,
          alternativeName: `${base}.${originalExt.toLowerCase()}`,
        };
      }
    }
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
    this._batchMemory = estimateForBatch(selected.map((item) => ({ file: item.file })));
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
    const reviewResult = await openReviewDialog({ plans, mode: 'batch' });
    const confirmed = typeof reviewResult === 'object' && reviewResult !== null ? Boolean(reviewResult.confirmed) : Boolean(reviewResult);
    if (!confirmed) {
      this.setStatus('Perubahan belum diterapkan.');
      return;
    }
    const lowMemory = typeof reviewResult === 'object' ? Boolean(reviewResult.lowMemory) : false;
    if (typeof reviewResult === 'object' && reviewResult.keepOriginalExt) {
      const used = new Set();
      for (const plan of plans) {
        if (!plan.extensionMismatch?.alternativeName) continue;
        const base = plan.extensionMismatch.alternativeName.replace(/\.[^.]+$/, '');
        let candidate = plan.extensionMismatch.alternativeName;
        let n = 2;
        while (used.has(candidate.toLowerCase())) {
          candidate = `${base} (${n}).${plan.extensionMismatch.originalExt}`;
          n += 1;
        }
        used.add(candidate.toLowerCase());
        plan.outputName = candidate;
        if (plan.item) plan.item.outputName = candidate;
      }
    }
    this._lowMemory = lowMemory;
    this.applying = true;
    this.els.batchApplyBtn.classList.add('is-processing');
    this.setApplyingUI(true);
    this.setStatus(lowMemory ? `Menerapkan hemat memori ke ${plans.length} file…` : `Menerapkan ke ${plans.length} file…`);
    this.showProgress(true);
    this.setProgress(2, 'Menyiapkan…');
    this.syncApply();
    let result;
    const maxFailures = Math.max(0, Number(this.els.batchStopAfter?.value) || 0);
    try {
      result = await this.processor.applyPlans(
        plans,
        skipped,
        (item) => this.updateItem(item),
        {
          lowMemory,
          maxFailures,
          onOutput: lowMemory
            ? (item, blob) => {
                downloadBlob(blob, item.outputName || item.file.name);
                item.downloadedPerFile = true;
              }
            : null,
        },
      );
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
      const perFile = this.items.filter((item) => item.downloadedPerFile).length;
      if (perFile) {
        showToast('Semua hasil sudah diunduh per file (modus hemat memori).', 'info', 6000);
        return;
      }
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
}
