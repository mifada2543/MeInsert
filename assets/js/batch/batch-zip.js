/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
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
  const chunks = [];
  let filesDone = 0;
  const total = entries.length;
  await new Promise((resolve, reject) => {
    const zip = new Zip((err, chunk, final) => {
      if (err) {
        reject(err);
        return;
      }
      if (chunk && chunk.length) chunks.push(chunk);
      if (final) resolve();
    });
    (async () => {
      try {
        for (const entry of entries) {
          const pass = new ZipPassThrough(entry.path);
          pass.mtime = new Date(entry.source instanceof File ? entry.source.lastModified || Date.now() : Date.now());
          zip.add(pass);
          onProgress?.({ stage: `Menambahkan ${entry.path} ke ZIP…`, pct: total ? Math.round((filesDone / total) * 100) : 0 });
          const stream = entry.source.stream();
          const reader = stream.getReader();
          for (;;) {
            const { done, value } = await reader.read();
            if (done) {
              pass.push(new Uint8Array(0), true);
              break;
            }
            pass.push(value, false);
          }
          filesDone += 1;
        }
        zip.end();
      } catch (error) {
        reject(error);
      }
    })();
  });
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
async function pumpZip(entries, onChunk, onProgress) {
  let filesDone = 0;
  const total = entries.length;
  await new Promise((resolve, reject) => {
    const zip = new Zip((err, chunk, final) => {
      if (err) {
        reject(err);
        return;
      }
      if (chunk && chunk.length) onChunk(chunk);
      if (final) resolve();
    });
    (async () => {
      try {
        for (const entry of entries) {
          const pass = new ZipPassThrough(entry.path);
          pass.mtime = new Date(entry.source instanceof File ? entry.source.lastModified || Date.now() : Date.now());
          zip.add(pass);
          onProgress?.({ stage: `Menambahkan ${entry.path} ke ZIP…`, pct: total ? Math.round((filesDone / total) * 100) : 0 });
          const reader = entry.source.stream().getReader();
          for (;;) {
            const { done, value } = await reader.read();
            if (done) {
              pass.push(new Uint8Array(0), true);
              break;
            }
            pass.push(value, false);
          }
          filesDone += 1;
        }
        zip.end();
      } catch (error) {
        reject(error);
      }
    })();
  });
  onProgress?.({ stage: 'ZIP selesai.', pct: 100 });
}
export async function saveZipStreaming(items, { reportJson = '', onProgress, suggestedName = 'meinsert-batch.zip' } = {}) {
  const entries = zipEntries(items, reportJson);
  const canStream = typeof window !== 'undefined' && typeof window.showSavePicker === 'function';
  if (!canStream) {
    const blob = await buildZip(items, { reportJson, onProgress });
    return { streaming: false, blob };
  }
  let handle;
  try {
    handle = await window.showSavePicker({
      suggestedName,
      types: [{ description: 'ZIP archive', accept: { 'application/zip': ['.zip'] } }],
    });
  } catch (error) {
    const cancelled = error instanceof Error && error.name === 'AbortError';
    throw Object.assign(error instanceof Error ? error : new Error(String(error)), { cancelled, code: cancelled ? 'SAVE_CANCELLED' : 'SAVE_FAILED' });
  }
  const writable = await handle.createWritable();
  const writer = writable.getWriter();
  const writes = [];
  try {
    await pumpZip(entries, (chunk) => { writes.push(writer.write(chunk)); }, onProgress);
    await Promise.all(writes);
    await writer.close();
    return { streaming: true };
  } catch (error) {
    try { await writer.abort(error); } catch { /* best-effort */ }
    throw error;
  }
}
export function reportTextBlob(reportJson) {
  return new Blob([reportJson || ''], { type: 'application/json' });
}
