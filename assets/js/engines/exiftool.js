/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import { parseMetadata, writeMetadata, dispose as disposeExifTool } from '../../vendor/exiftool-wasm/index.js';
import { AppError } from '../core/errors.js';
import { createProgressFetch } from '../ui/engine-loading.js';

function inWorker() {
  return typeof WorkerGlobalScope !== 'undefined'
    && typeof self !== 'undefined'
    && self instanceof WorkerGlobalScope;
}

function postEngineProgress(payload) {
  if (!inWorker()) return;
  try {
    self.postMessage({ type: 'engine-progress', ...payload });
  } catch { /* UI terbaik */ }
}

// `options.fetch` diteruskan vendor sampai ke G.create({ fetch }). Runtime
// memanggilnya hanya saat WASM belum termuat, dan mengharapkan sebuah Response.
// URL tetap same-origin: pembungkus tidak pernah mengarahkan ke origin lain.
function makeEngineFetch() {
  const progressFetch = createProgressFetch({
    onProgress: ({ loaded, total }) => postEngineProgress({ phase: 'downloading', loaded, total }),
  });
  return async (url, init) => {
    postEngineProgress({ phase: 'loading' });
    try {
      const response = await progressFetch(url, init);
      postEngineProgress({ phase: 'ready' });
      return response;
    } catch (error) {
      postEngineProgress({ phase: 'error' });
      throw error;
    }
  };
}

function jsonTransform(text) {
  const parsed = JSON.parse(text);
  if (Array.isArray(parsed)) return parsed[0] || {};
  return parsed || {};
}
export async function readTags(file) {
  let result;
  try {
    result = await parseMetadata(file, {
      args: ['-json', '-G1', '-s', '-a', '-m', '-q'],
      transform: jsonTransform,
      fetch: makeEngineFetch(),
    });
  } catch (error) {
    throw new AppError('READ_FAILED', 'Mesin metadata gagal membaca file.', error.message || String(error));
  }
  if (!result.success) {
    throw new AppError('READ_FAILED', 'Metadata file tidak bisa dibaca.', result.error || '');
  }
  return result.data || {};
}
export async function writeTags(file, tags) {
  let result;
  try {
    result = await writeMetadata(file, tags, { args: ['-m'], fetch: makeEngineFetch() });
  } catch (error) {
    throw new AppError('WRITE_FAILED', 'Mesin metadata gagal menulis file.', error.message || String(error));
  }
  if (!result.success) {
    const detail = result.error || '';
    let code = 'WRITE_FAILED';
    if (/not yet supported/i.test(detail)) code = 'UNSUPPORTED_WRITE';
    if (/not writable|doesn't exist/i.test(detail)) code = 'UNSUPPORTED_TAG';
    throw new AppError(code, 'Metadata tidak dapat ditulis ke file ini.', detail);
  }
  return new Uint8Array(result.data);
}
export async function disposeExifToolRuntime() {
  try {
    await disposeExifTool();
  } catch {}
}
