/*
 * Adapter registry. Format adapters are loaded on demand so a page only pays
 * for the format it actually opens (the homepage pays for none).
 */
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
    // Cache the promise so concurrent requests share one import; drop it again
    // on failure so a transient chunk error can be retried.
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
