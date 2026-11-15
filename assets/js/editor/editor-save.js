/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import { el, qs } from '../ui/dom.js';
import { showToast } from '../ui/toast.js';
import { openReviewDialog } from '../ui/review-dialog.js';
import { createSnapshot } from '../core/metadata-snapshot.js';
import { buildChangePlan } from '../core/change-plan.js';
import { estimateForSingle } from '../core/memory-estimate.js';
import { verifyIntegrity } from '../core/integrity.js';
import { asString } from '../core/tag-utils.js';
import { cloneRows, defaultOutputName, makeRows, sanitizeBasename, valuesFromFields } from './editor-state.js';
import { setStatus, setProgress, showProgress } from './editor-shell.js';
import { collectChanges, syncActionBar } from './editor-changes.js';
import {
  previewUrlFor,
  refreshCoverPreview,
  renderWorkspace,
  revokePreview,
} from './editor-view.js';
export function ensureOutputName(ctx) {
  const { els, state } = ctx;
  const ext = state.detection?.ext || 'bin';
  const base = sanitizeBasename(state.outputBase || defaultOutputName(state.file));
  const name = `${base}.${ext}`;
  state.outputBase = base;
  state.outputName = name;
  els.outputBase.value = base;
  if (els.outputExt) els.outputExt.textContent = `.${ext}`;
  return name;
}
export function applyOutput(ctx, result) {
  const { els, state } = ctx;
  state.navigationHasResult = true;
  const file = new File([result.blob], result.filename, {
    type: result.blob.type || state.file.type || state.detection.mime,
  });
  revokePreview(state);
  state.file = file;
  state.previewUrl = previewUrlFor(file, state.detection);
  state.values = valuesFromFields(state.adapter, result.fields || state.values);
  state.originalValues = { ...state.values };
  state.removedFields.clear();
  if (state.coverAction === 'set' && state.coverChosen) {
    state.coverOriginal = {
      mimeType: state.coverChosen.mimeType,
      kind: 'coverFront',
      name: state.coverChosen.name || 'cover',
      size: state.coverChosen.data?.byteLength || 0,
    };
    const bytes = state.coverChosen.data;
    state.coverOriginalBytes = bytes?.buffer?.slice
      ? bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
      : bytes;
  } else if (state.coverAction === 'remove') {
    state.coverOriginal = null;
    state.coverOriginalBytes = null;
  }
  state.coverAction = 'keep';
  state.coverChosen = null;
  refreshCoverPreview(state);
  const rows = Array.isArray(result.custom)
    ? result.custom
    : state.customRows.filter((row) => asString(row.key).trim() && asString(row.value).trim());
  state.customRows = makeRows(state, rows.map((row) => ({
    key: row.key,
    value: row.value,
    originalKey: row.originalKey === undefined ? row.key : row.originalKey,
    originalValue: row.originalValue === undefined ? row.value : row.originalValue,
  })));
  state.customBaseline = cloneRows(state.customRows);
  state.removedCustom.clear();
  const warnings = [...new Set([state.detection?.warning, ...(result.warnings || [])].filter(Boolean))];
  state.readResult = {
    ...(state.readResult || {}),
    fields: result.fields || state.values,
    custom: Array.isArray(result.custom) ? result.custom : state.readResult?.custom,
    raw: result.raw?.length ? result.raw : state.readResult?.raw || [],
    info: { ...(state.readResult?.info || {}), ...(result.info || {}) },
    warnings,
  };
  state.result = {
    ...result,
    filename: result.filename || state.outputName,
    warnings,
  };
  state.outputName = result.filename || state.outputName;
  if (state.detection) els.outputExt.textContent = `.${state.detection.ext}`;
}
export async function saveMetadata(ctx) {
  const { client, els, state } = ctx;
  if (state.processing) {
    if (state.adapter) client.cancel(state.adapter.meta.engine);
    setProgress(els, 0, 'Membatalkan…');
    return;
  }
  if (!state.adapter || state.status !== 'ready') return;
  const { payload, errors, count } = collectChanges(state, { validate: true });
  if (errors.length) {
    showToast(errors[0], 'error', 7500);
    return;
  }
  if (!count) {
    showToast('Belum ada perubahan. Ubah minimal satu field terlebih dahulu.', 'info', 4200);
    return;
  }
  let filename = ensureOutputName(ctx);
  state.outputName = filename;
  const baseline = state.baselineSnapshot
    || createSnapshot({ adapter: state.adapter, detection: state.detection, readResult: state.readResult });
  state.baselineSnapshot = baseline;
  const memory = estimateForSingle({
    fileSize: state.file?.size || 0,
    coverBytes: state.coverChosen?.data?.byteLength || 0,
  });
  const plan = buildChangePlan({
    adapter: state.adapter,
    detection: state.detection,
    baseline,
    payload,
    outputName: filename,
    source: 'single',
    memory,
  });
  plan.fileName = state.file.name;
  {
    const originalExt = (state.file?.name || '').includes('.') ? (state.file.name.split('.').pop() || '').toLowerCase() : '';
    const detectedExt = (state.detection?.ext || '').toLowerCase();
    const base = state.outputBase || filename.replace(/\.[^.]+$/, '');
    if (originalExt && detectedExt && originalExt !== detectedExt) {
      plan.extensionMismatch = {
        found: true,
        originalExt,
        detectedExt,
        recommendedName: `${base}.${detectedExt}`,
        alternativeName: `${base}.${originalExt}`,
      };
    }
  }
  if (!plan.hasOperations) {
    showToast('Perubahan yang dipilih sama dengan metadata saat ini.', 'info', 4200);
    return;
  }
  const reviewResult = await openReviewDialog({ plans: [plan], mode: 'single' });
  const confirmed = typeof reviewResult === 'object' && reviewResult !== null ? Boolean(reviewResult.confirmed) : Boolean(reviewResult);
  if (!confirmed) {
    setStatus(els, `${state.detection.label} · perubahan belum disimpan`);
    return;
  }
  if (typeof reviewResult === 'object' && reviewResult?.keepOriginalExt && plan.extensionMismatch?.alternativeName) {
    filename = plan.extensionMismatch.alternativeName;
    state.outputName = filename;
    plan.outputName = filename;
  }
  state.saveError = null;
  state.result = null;
  qs('.result-card', els.panel)?.remove();
  state.processing = true;
  syncActionBar(els, state);
  showProgress(els, true);
  setProgress(els, 4, 'Menyiapkan…');
  setStatus(els, `Memproses ${state.detection.label}…`);
  try {
    const result = await client.write(
      state.adapter.meta.engine,
      state.adapter.meta.id,
      state.file,
      plan.payload,
      {
        extension: state.detection.ext,
        subtype: state.detection.subtype,
        mime: state.detection.mime,
        outputName: filename,
      },
      (progress) => {
        if (progress.pct !== undefined) {
          setProgress(els, progress.pct, progress.stage || 'Memproses…');
        } else if (progress.stage) {
          els.progressLabel.textContent = progress.stage;
        }
        if (progress.stage) setStatus(els, progress.stage);
      },
    );
    result.filename = filename;
    const afterSnapshot = createSnapshot({
      adapter: state.adapter,
      detection: state.detection,
      readResult: result,
    });
    result.integrity = verifyIntegrity(plan, afterSnapshot);
    applyOutput(ctx, result);
    state.baselineSnapshot = afterSnapshot;
    state.processing = false;
    state.status = 'ready';
    state.saveError = null;
    renderWorkspace(ctx);
    syncActionBar(els, state);
    showProgress(els, false);
    const integrityStatus = result.integrity?.status;
    setStatus(els, integrityStatus === 'failed'
      ? `${state.detection.label} · perlu diperiksa`
      : `${state.detection.label} · metadata diperbarui`);
    if (integrityStatus === 'failed') {
      showToast('File tersimpan, tetapi ada metadata yang perlu diperiksa. Buka laporan integritas.', 'error', 9000);
    } else if (integrityStatus === 'warning' || result.warnings?.length) {
      showToast('Metadata tersimpan dengan catatan. Periksa laporan integritas.', 'info', 9000);
    } else {
      showToast('Metadata tersimpan dan seluruh metadata lain tetap utuh.', 'success', 6000);
    }
  } catch (error) {
    state.processing = false;
    showProgress(els, false);
    if (error?.code === 'CANCELLED') {
      setStatus(els, `${state.detection.label} · dibatalkan`);
      showToast('Pemrosesan dibatalkan.', 'info', 3500);
    } else {
      state.saveError = error;
      setStatus(els, error?.message || 'Gagal menyimpan metadata.', true);
      renderWorkspace(ctx);
      showToast(error?.message || 'Gagal menyimpan metadata.', 'error', 8000);
    }
    syncActionBar(els, state);
  }
}
export function downloadResult(ctx) {
  const { state } = ctx;
  if (!state.result?.blob) return;
  const url = URL.createObjectURL(state.result.blob);
  const link = el('a', {
    href: url,
    download: state.result.filename || state.outputName || 'file',
  });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
