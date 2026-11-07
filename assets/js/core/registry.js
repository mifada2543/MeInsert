/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
const ADAPTER_LOADERS = {
  image: () => import('../formats/image.js'),
  pdf: () => import('../formats/pdf.js'),
  mp3: () => import('../formats/mp3.js'),
  flac: () => import('../formats/flac.js'),
  ogg: () => import('../formats/ogg.js'),
  mkv: () => import('../formats/mkv.js'),
  mp4: () => import('../formats/mp4.js'),
};
const ADAPTER_IDS = Object.keys(ADAPTER_LOADERS);
const adapterCache = new Map();

export async function getAdapter(id) {
  const load = ADAPTER_LOADERS[id];
  if (!load) return null;
  if (!adapterCache.has(id)) {
    const pending = load()
      .then((module) => module.default)
      .catch((error) => {
        adapterCache.delete(id);
        throw error;
      });
    adapterCache.set(id, pending);
  }
  return adapterCache.get(id);
}
export async function allAdapters() {
  const adapters = await Promise.all(ADAPTER_IDS.map((id) => getAdapter(id).catch(() => null)));
  return adapters.filter(Boolean);
}
export async function adapterForDetection(detection) {
  return detection ? getAdapter(detection.id) : null;
}
export function fieldsBySection(adapter, subtype) {
  const fields = typeof adapter.fieldsFor === 'function' ? adapter.fieldsFor(subtype) : (adapter.fields || []);
  const sections = typeof adapter.sectionsFor === 'function' ? adapter.sectionsFor(subtype) : (adapter.sections || []);
  return sections.map((section) => ({
    ...section,
    fields: fields.filter((field) => field.section === section.id),
  })).filter((section) => section.fields.length);
}
