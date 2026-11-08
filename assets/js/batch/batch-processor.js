/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import { detectFile } from '../core/detector.js';
import { adapterForDetection } from '../core/registry.js';
import { createSnapshot } from '../core/metadata-snapshot.js';
import { verifyIntegrity } from '../core/integrity.js';
import { applyDurationLimits, categoryForDetection, validateSelection } from './batch-limits.js';
function mergeWarnings(...groups) {
  return [...new Set(groups.flat().filter(Boolean))];
}
export class BatchProcessor {
  constructor(client) {
    this.client = client;
    this.cancelRequested = false;
    this.activeEngine = null;
  }
  cancel() {
    this.cancelRequested = true;
    if (this.activeEngine) this.client.cancel(this.activeEngine);
  }
  async prepare(file, index) {
    const detection = await detectFile(file);
    if (!detection) return null;
    const adapter = await adapterForDetection(detection);
    return {
      id: `batch-${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`,
      file,
      detection,
      adapter,
      category: categoryForDetection(detection),
      included: true,
      excluded: false,
      skipReason: '',
      status: 'queued',
      progress: 0,
      stage: 'Menunggu…',
      readResult: null,
      baselineSnapshot: null,
      warnings: detection.warning ? [detection.warning] : [],
      error: null,
      integrity: null,
      removeRaw: new Set(),
      operations: null,
      outputFile: null,
      outputName: '',
      includeFailedInZip: false,
    };
  }
  async scan(items, onUpdate) {
    for (const item of items) {
      if (this.cancelRequested) {
        if (item.status === 'queued') {
          item.status = 'cancelled';
          item.skipReason = 'Dibatalkan.';
          item.included = false;
          onUpdate?.(item);
        }
        continue;
      }
      if (!item.included) {
        item.status = 'skipped';
        onUpdate?.(item);
        continue;
      }
      item.status = 'scanning';
      item.progress = 4;
      item.stage = 'Membaca metadata…';
      onUpdate?.(item);
      try {
        const result = await this.readItem(item, (progress) => {
          item.progress = Number.isFinite(Number(progress.pct)) ? Number(progress.pct) : item.progress;
          item.stage = progress.stage || item.stage;
          onUpdate?.(item);
        });
        item.readResult = result;
        item.warnings = mergeWarnings(item.warnings, result.warnings);
        item.status = 'ready';
        item.progress = 100;
        item.stage = 'Siap';
        item.error = null;
        applyDurationLimits(item);
        onUpdate?.(item);
      } catch (error) {
        if (this.cancelRequested || error?.code === 'CANCELLED') {
          item.status = 'cancelled';
          item.skipReason = 'Dibatalkan.';
          item.included = false;
        } else {
          item.status = 'error';
          item.error = error;
          item.included = false;
          item.skipReason = error?.message || 'File tidak bisa dibaca.';
        }
        onUpdate?.(item);
      }
    }
    await this.client.disposeAll();
  }
  async applyPlans(plans, skipped = [], onUpdate, { lowMemory = false, onOutput = null, maxFailures = 0 } = {}) {
    this.cancelRequested = false;
    let failures = 0;
    this.cancelRequested = false;
    const entries = (plans || []).filter((plan) => plan?.item && plan?.payload);
    const skippedItems = [...new Set(skipped || [])].filter((item) => !entries.some((plan) => plan.item === item));
    const selection = validateSelection([...entries.map((plan) => plan.item), ...skippedItems]);
    if (!selection.ok) {
      return { ok: false, messages: selection.messages };
    }
    const processed = [];
    for (const item of skippedItems) {
      item.status = 'skipped';
      item.skipReason = 'Tidak ada perubahan nyata pada file ini.';
      item.operations = { set: 0, remove: 0, rawRemove: 0, custom: 0 };
      item.integrity = null;
      onUpdate?.(item);
    }
    let stoppedReason = '';
    for (const plan of entries) {
      const item = plan.item;
      if (this.cancelRequested) {
        if (item.status === 'queued' || item.status === 'ready' || item.status === 'processing') {
          item.status = 'cancelled';
          item.skipReason = stoppedReason || 'Dibatalkan.';
          onUpdate?.(item);
        }
        continue;
      }
      const outputName = plan.outputName || item.outputName || item.file.name;
      item.status = 'processing';
      item.progress = 2;
      item.stage = 'Menyiapkan output…';
      item.outputName = outputName;
      item.error = null;
      item.integrity = null;
      onUpdate?.(item);
      try {
        const result = await this.writeItem(item, plan.payload, outputName, (progress) => {
          item.progress = Number.isFinite(Number(progress.pct)) ? Number(progress.pct) : item.progress;
          item.stage = progress.stage || item.stage;
          onUpdate?.(item);
        });
        const warnings = mergeWarnings(item.warnings, result.warnings);
        this.verifyRawRemoval(item, result, warnings);
        let afterSnapshot = null;
        try {
          afterSnapshot = createSnapshot({
            adapter: item.adapter,
            detection: item.detection,
            readResult: result,
          });
        } catch {
          afterSnapshot = null;
        }
        const integrity = verifyIntegrity(plan, afterSnapshot);
        const blob = result.blob;
        item.warnings = warnings;
        item.integrity = integrity;
        item.operations = this.operationCounts(plan);
        item.status = 'done';
        item.progress = 100;
        item.stage = integrity.status === 'failed'
          ? 'Selesai · perlu diperiksa'
          : integrity.status === 'warning' ? 'Selesai · ada catatan' : 'Selesai';
        if (lowMemory && onOutput) {
          // Hemat memori: unduh saat ini juga, jangan tahan semua output untuk ZIP.
          try {
            onOutput(item, blob);
            item.downloadedPerFile = true;
          } catch {
            item.downloadedPerFile = false;
          }
          item.outputFile = null;
        } else {
          item.outputFile = new File([blob], outputName, {
            type: blob.type || item.detection?.mime || item.file?.type || 'application/octet-stream',
            lastModified: Date.now(),
          });
        }
        processed.push(item);
        onUpdate?.(item);
      } catch (error) {
        if (this.cancelRequested || error?.code === 'CANCELLED') {
          item.status = 'cancelled';
          item.skipReason = 'Dibatalkan.';
        } else {
          item.status = 'error';
          item.error = error;
          item.skipReason = error?.message || 'File gagal diproses.';
          failures += 1;
          if (maxFailures > 0 && failures >= maxFailures) {
            stoppedReason = `Dihentikan setelah ${failures} kegagalan.`;
            this.cancelRequested = true;
          }
        }
        item.outputFile = null;
        item.integrity = null;
        onUpdate?.(item);
      }
    }
    await this.client.disposeAll();
    return { ok: true, processed };
  }
  operationCounts(plan) {
    const payload = plan?.payload || {};
    return {
      set: Object.keys(payload.set || {}).length,
      remove: (payload.remove || []).length,
      rawRemove: (payload.rawRemove || []).length,
      custom: (payload.custom || []).length + (payload.customRemove || []).length,
    };
  }
  async readItem(item, onProgress) {
    const { adapter, detection, file } = item;
    if (!adapter) throw new Error(`Format ${detection?.label || 'ini'} belum didukung.`);
    this.activeEngine = adapter.meta.engine;
    try {
      return await this.client.read(
        adapter.meta.engine,
        adapter.meta.id,
        file,
        { extension: detection.ext, subtype: detection.subtype, mime: detection.mime },
        onProgress,
      );
    } finally {
      this.activeEngine = null;
    }
  }
  async writeItem(item, payload, outputName, onProgress) {
    const { adapter, detection, file } = item;
    if (!adapter) throw new Error(`Format ${detection?.label || 'ini'} belum didukung.`);
    this.activeEngine = adapter.meta.engine;
    try {
      const result = await this.client.write(
        adapter.meta.engine,
        adapter.meta.id,
        file,
        payload,
        {
          extension: detection.ext,
          subtype: detection.subtype,
          mime: detection.mime,
          outputName,
        },
        onProgress,
      );
      result.filename = outputName;
      return result;
    } finally {
      this.activeEngine = null;
    }
  }
  verifyRawRemoval(item, result, warnings) {
    const after = Array.isArray(result?.raw) ? result.raw : [];
    if (!after.length || !item.removeRaw?.size) return;
    const afterTags = new Set(after.map((row) => String(row.tag).toLowerCase()));
    for (const selected of item.removeRaw) {
      if (afterTags.has(String(selected).toLowerCase())) {
        warnings.push(`Tag "${selected}" mungkin belum terhapus.`);
      }
    }
  }
}
