import image from '../formats/image.js';
import pdf from '../formats/pdf.js';
import mp3 from '../formats/mp3.js';
import flac from '../formats/flac.js';
import ogg from '../formats/ogg.js';
import mkv from '../formats/mkv.js';
import mp4 from '../formats/mp4.js';

const ADAPTERS = [image, pdf, mp3, flac, ogg, mkv, mp4];

export function getAdapter(id) {
  return ADAPTERS.find((adapter) => adapter.meta.id === id) || null;
}

export function allAdapters() {
  return ADAPTERS;
}

export function adapterForDetection(detection) {
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
