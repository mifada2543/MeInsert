/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import { detectFile } from '../core/detector.js';
import { adapterForDetection } from '../core/registry.js';
import { applyDurationLimits, categoryForDetection, validateSelection } from './batch-limits.js';
import { uniqueOutputName } from './batch-zip.js';
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
      warnings: [],
      error: null,
      removeRaw: new Set(),
      operations: null,
      outputFile: null,
      outputName: '',
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
        item.warnings = result.warnings || [];
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
  async apply(items, buildPayload, onUpdate) {
    this.cancelRequested = false;
    const selection = validateSelection(items);
    if (!selection.ok) {
      return { ok: false, messages: selection.messages };
    }
    const usedNames = new Set();
    const processed = [];
    for (const item of items) {
      if (this.cancelRequested) {
        if (item.status === 'queued' || item.status === 'ready' || item.status === 'processing') {
          item.status = 'cancelled';
          item.skipReason = 'Dibatalkan.';
          onUpdate?.(item);
        }
        continue;
      }
      const plan = buildPayload?.(item) || null;
      if (!plan || !plan.hasOperations) {
        item.status = 'skipped';
        item.skipReason = 'Tidak ada perubahan yang dipilih.';
        item.operations = { set: 0, remove: 0, rawRemove: 0 };
        onUpdate?.(item);
        continue;
      }
      const outputName = uniqueOutputName(item.file, usedNames, '-meinsert');
      item.status = 'processing';
      item.progress = 2;
      item.stage = 'Menyiapkan output…';
      item.outputName = outputName;
      item.error = null;
      onUpdate?.(item);
      try {
        const result = await this.writeItem(item, plan.payload, outputName, (progress) => {
          item.progress = Number.isFinite(Number(progress.pct)) ? Number(progress.pct) : item.progress;
          item.stage = progress.stage || item.stage;
          onUpdate?.(item);
        });
        const warnings = [...(result.warnings || [])];
        this.verifyRawRemoval(item, result, warnings);
        const blob = result.blob;
        item.outputFile = new File([blob], outputName, {
          type: blob.type || item.detection?.mime || item.file?.type || 'application/octet-stream',
          lastModified: Date.now(),
        });
        item.warnings = warnings;
        item.operations = plan.operations;
        item.status = 'done';
        item.progress = 100;
        item.stage = 'Selesai';
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
        }
        item.outputFile = null;
        onUpdate?.(item);
      }
    }
    await this.client.disposeAll();
    return { ok: true, processed };
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
