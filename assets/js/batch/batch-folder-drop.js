/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import { t, translated } from '../i18n/index.js';
import { el, qs } from '../ui/dom.js';
export const MAX_DROP_DEPTH = 8;
export const MAX_DROP_FILES = 500;
const MAX_READ_BATCHES = 10_000;
function readAllEntries(reader) {
  return new Promise((resolve) => {
    const entries = [];
    let batches = 0;
    const next = () => {
      if (batches >= MAX_READ_BATCHES) {
        resolve(entries);
        return;
      }
      batches += 1;
      let settled = false;
      const onChunk = (chunk) => {
        if (settled) return;
        settled = true;
        if (!Array.isArray(chunk) || !chunk.length) {
          resolve(entries);
          return;
        }
        entries.push(...chunk);
        next();
      };
      try {
        reader.readEntries(onChunk, () => {
          if (!settled) {
            settled = true;
            resolve(entries);
          }
        });
      } catch {
        resolve(entries);
      }
    };
    next();
  });
}
function fileFromEntry(entry) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (file) => {
      if (settled) return;
      settled = true;
      resolve(file || null);
    };
    try {
      entry.file(done, () => done(null));
    } catch {
      done(null);
    }
  });
}
async function walkEntry(entry, depth, collected) {
  if (!entry || depth > MAX_DROP_DEPTH || collected.length >= MAX_DROP_FILES) return;
  if (entry.isFile) {
    const file = await fileFromEntry(entry);
    if (file && collected.length < MAX_DROP_FILES) collected.push(file);
    return;
  }
  if (!entry.isDirectory || typeof entry.createReader !== 'function') return;
  const children = await readAllEntries(entry.createReader());
  for (const child of children) {
    if (collected.length >= MAX_DROP_FILES) break;
    await walkEntry(child, depth + 1, collected);
  }
}
export async function collectDroppedFiles(dataTransfer) {
  const files = [];
  const items = Array.from(dataTransfer?.items || []);
  const entries = [];
  for (const item of items) {
    if (typeof item?.webkitGetAsEntry !== 'function') continue;
    let entry = null;
    try { entry = item.webkitGetAsEntry(); } catch { entry = null; }
    if (entry) entries.push(entry);
    if (entries.length >= MAX_DROP_FILES) break;
  }
  if (entries.length) {
    for (const entry of entries) {
      if (files.length >= MAX_DROP_FILES) break;
      await walkEntry(entry, 0, files);
    }
  }
  if (!files.length) {
    for (const file of Array.from(dataTransfer?.files || [])) {
      if (files.length >= MAX_DROP_FILES) break;
      files.push(file);
    }
  }
  return files;
}
export function bindFolderDropCopy(card) {
  if (typeof document === 'undefined' || !card) return null;
  const existing = qs('.drop-folder-hint', card);
  if (existing) return existing;
  const hint = el('p', {
    className: 'drop-folder-hint',
    textContent: translated(() => t('ui.dropFilesOrFolders')),
  });
  const copy = qs('.drop-copy', card);
  if (copy) copy.after(hint);
  else card.append(hint);
  return hint;
}