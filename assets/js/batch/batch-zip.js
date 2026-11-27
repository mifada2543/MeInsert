/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — MeInsert Source-Available License v1.0 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import { Zip, ZipPassThrough } from '../../vendor/fflate.mjs';
import { safeOutputName, fileBaseName, fileExtension } from '../core/tag-utils.js';
export function uniqueOutputName(file, usedNames, suffix = '-meinsert') {
  const name = file?.name || 'file';
  const base = safeOutputName(fileBaseName(name), 'file');
  const extension = fileExtension(name);
  const ext = extension ? `.${extension}` : '';
  let candidate = `${base}${suffix}${ext}`;
  let index = 2;
  const used = usedNames || new Set();
  while (used.has(candidate.toLowerCase())) {
    candidate = `${base}${suffix} (${index})${ext}`;
    index += 1;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}
export async function buildZip(items, { reportJson = '', onProgress } = {}) {
  const chunks = [];
  await pumpZip(zipEntries(items, reportJson), (chunk) => chunks.push(chunk), onProgress);
  onProgress?.({ stage: 'ZIP selesai.', pct: 100 });
  return new Blob(chunks, { type: 'application/zip' });
}
function zipEntries(items, reportJson) {
  const zippedItems = (items || []).filter((item) => item.outputFile);
  const used = new Set();
  const entries = [];
  for (const item of zippedItems) {
    const requestedName = item.outputName || uniqueOutputName(item.file, used);
    const finalName = used.has(requestedName.toLowerCase())
      ? uniqueOutputName(item.file, used)
      : requestedName;
    used.add(finalName.toLowerCase());
    entries.push({ path: `outputs/${finalName}`, source: item.outputFile });
  }
  if (reportJson) entries.push({ path: 'laporan-meinsert.json', source: new Blob([reportJson], { type: 'application/json' }) });
  return entries;
}
async function pumpZip(entries, writeChunk, onProgress) {
  const archive = createArchive(writeChunk);
  for (const [index, entry] of entries.entries()) {
    onProgress?.({ stage: `Menambahkan ${entry.path} ke ZIP…`, pct: Math.round((index / entries.length) * 100) });
    await archive.add(entry);
  }
  await archive.end();
}

function createArchive(writeChunk) {
  // ZipPassThrough emits synchronously. Drain each push before reading more input.
  const pending = [];
  const zip = new Zip((error, chunk) => {
    if (error) throw error;
    if (chunk?.length) pending.push(chunk);
  });
  async function drainChunks() {
    for (const chunk of pending) await writeChunk(chunk);
    pending.length = 0;
  }
  async function add(entry) {
    const pass = new ZipPassThrough(entry.path);
    pass.mtime = new Date(entry.source instanceof File ? entry.source.lastModified || Date.now() : Date.now());
    zip.add(pass);
    const reader = entry.source.stream().getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        pass.push(done ? new Uint8Array(0) : value, done);
        await drainChunks();
        if (done) break;
      }
    } catch (error) {
      try { await reader.cancel(error); } catch { /* Preserve the original failure. */ }
      throw error;
    } finally {
      reader.releaseLock();
    }
  }
  async function end() {
    zip.end();
    await drainChunks();
  }
  return { add, end };
}

export function canSaveZipToDisk() {
  return typeof window !== 'undefined' && typeof window.showSaveFilePicker === 'function';
}

export async function openZipTarget(suggestedName) {
  let handle;
  try {
    handle = await window.showSaveFilePicker({
      suggestedName,
      types: [{ description: 'ZIP archive', accept: { 'application/zip': ['.zip'] } }],
    });
  } catch (error) {
    const cancelled = error instanceof Error && error.name === 'AbortError';
    throw Object.assign(new Error(error?.message || String(error), { cause: error }), {
      cancelled, code: cancelled ? 'SAVE_CANCELLED' : 'SAVE_FAILED',
    });
  }
  return handle;
}

async function openWritableZip(handle) {
  const writable = await handle.createWritable();
  const writer = writable.getWriter();
  const archive = createArchive((chunk) => writer.write(chunk));
  return {
    archive,
    async finish() {
      await archive.end();
      await writer.close();
      writer.releaseLock();
    },
    async abort(error) {
      try { await writer.abort(error); } catch { /* Preserve the original failure. */ }
      finally { writer.releaseLock(); }
    },
  };
}

export async function openDirectZip(handle) {
  const session = await openWritableZip(handle);
  const used = new Set();
  return {
    async add(item, blob) {
      const requested = item.outputName;
      const name = requested && !used.has(requested.toLowerCase())
        ? requested : uniqueOutputName(item.file, used);
      used.add(name.toLowerCase());
      const source = new File([blob], name, { type: blob.type });
      await session.archive.add({ path: `outputs/${name}`, source });
    },
    async finish(reportJson) {
      await session.archive.add({ path: 'laporan-meinsert.json', source: new Blob([reportJson]) });
      await session.finish();
    },
    abort: session.abort,
  };
}

export async function saveZipStreaming(items, { reportJson = '', onProgress, suggestedName = 'meinsert-batch.zip' } = {}) {
  if (!canSaveZipToDisk()) {
    const blob = await buildZip(items, { reportJson, onProgress });
    return { streaming: false, blob };
  }
  const session = await openWritableZip(await openZipTarget(suggestedName));
  try {
    const entries = zipEntries(items, reportJson);
    for (const [index, entry] of entries.entries()) {
      onProgress?.({ stage: `Menambahkan ${entry.path} ke ZIP…`, pct: Math.round((index / entries.length) * 100) });
      await session.archive.add(entry);
    }
    await session.finish();
  } catch (error) {
    await session.abort(error);
    throw error;
  }
  onProgress?.({ stage: 'ZIP selesai.', pct: 100 });
  return { streaming: true };
}
