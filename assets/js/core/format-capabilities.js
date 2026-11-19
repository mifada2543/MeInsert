/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
// Single source of truth for what MeInsert can edit. The landing page renders
export const FORMAT_CAPABILITIES = [
  { id: 'jpg', label: 'JPG', group: 'image', status: 'full', offlineFeature: 'image', chip: true },
  { id: 'png', label: 'PNG', group: 'image', status: 'full', offlineFeature: 'image', chip: true },
  { id: 'webp', label: 'WebP', group: 'image', status: 'full', offlineFeature: 'image', chip: true },
  { id: 'tiff', label: 'TIFF', group: 'image', status: 'full', offlineFeature: 'image', chip: true },
  { id: 'pdf', label: 'PDF', group: 'pdf', status: 'full', offlineFeature: 'pdf', chip: true },
  { id: 'mp3', label: 'MP3', group: 'audio', status: 'full', offlineFeature: 'audio', chip: true },
  { id: 'flac', label: 'FLAC', group: 'audio', status: 'full', offlineFeature: 'audio', chip: true },
  { id: 'ogg', label: 'OGG', group: 'audio', status: 'full', offlineFeature: 'audio', chip: true },
  { id: 'mp4', label: 'MP4', group: 'video', status: 'full', offlineFeature: 'image', chip: true },
  { id: 'mkv', label: 'MKV', group: 'video', status: 'full', offlineFeature: 'audio', chip: true },
  { id: 'docx', label: 'DOCX', group: 'office', status: 'full', offlineFeature: 'office', chip: true },
  { id: 'xlsx', label: 'XLSX', group: 'office', status: 'full', offlineFeature: 'office', chip: true },
  { id: 'pptx', label: 'PPTX', group: 'office', status: 'full', offlineFeature: 'office', chip: true },
  { id: 'odt', label: 'ODT', group: 'office', status: 'full', offlineFeature: 'office', chip: false },
  { id: 'ods', label: 'ODS', group: 'office', status: 'full', offlineFeature: 'office', chip: false },
  { id: 'odp', label: 'ODP', group: 'office', status: 'full', offlineFeature: 'office', chip: false },
  { id: 'docm', label: 'DOCM', group: 'office', status: 'bestEffort', offlineFeature: 'office', chip: false },
  { id: 'xlsm', label: 'XLSM', group: 'office', status: 'bestEffort', offlineFeature: 'office', chip: false },
  { id: 'pptm', label: 'PPTM', group: 'office', status: 'bestEffort', offlineFeature: 'office', chip: false },
  { id: 'signed-pdf', label: 'PDF + tanda tangan', group: 'pdf', status: 'bestEffort', offlineFeature: 'pdf', chip: false },
  { id: 'doc-legacy', label: '.doc/.xls/.ppt', group: 'office', status: 'unsupported', offlineFeature: 'office', chip: false },
  { id: 'encrypted', label: 'Office terenkripsi', group: 'office', status: 'unsupported', offlineFeature: 'office', chip: false },
  { id: 'flac-in-ogg', label: 'FLAC-in-Ogg', group: 'audio', status: 'unsupported', offlineFeature: 'audio', chip: false },
  { id: 'speex', label: 'Speex', group: 'audio', status: 'unsupported', offlineFeature: 'audio', chip: false },
];
export const STATUS_KEYS = {
  full: 'ui.statusFullySupported',
  bestEffort: 'ui.statusBestEffort',
  unsupported: 'ui.statusUnsupported',
};
export const OFFICE_NOTE_KEY = 'ui.officeFormatsNote';
export const OFFLINE_FEATURES = [
  {
    id: 'audio',
    labelKey: 'ui.offlineFeatureAudio',
    bytes: 900_000,
    urls: [
      './assets/vendor/mediabunny.mjs',
      './assets/js/workers/media.worker.js',
      './assets/js/formats/mp3.js',
      './assets/js/formats/flac.js',
      './assets/js/formats/ogg.js',
      './assets/js/formats/mkv.js',
      './assets/js/formats/vorbis-common.js',
      './assets/js/formats/vorbis-pictures.js',
    ],
  },
  {
    id: 'image',
    labelKey: 'ui.offlineFeatureImage',
    bytes: 27_800_000,
    urls: [
      './assets/vendor/exiftool-wasm/index.js',
      './assets/vendor/exiftool-wasm/zeroperl-twnm61dk.wasm',
      './assets/js/workers/exiftool.worker.js',
      './assets/js/formats/image.js',
      './assets/js/formats/mp4.js',
    ],
  },
  {
    id: 'pdf',
    labelKey: 'ui.offlineFeaturePdf',
    bytes: 600_000,
    urls: ['./assets/vendor/pdf-lib.esm.js', './assets/js/workers/pdf.worker.js', './assets/js/formats/pdf.js'],
  },
  {
    id: 'office',
    labelKey: 'ui.offlineFeatureOffice',
    bytes: 200_000,
    urls: [
      './assets/vendor/fflate.mjs',
      './assets/js/core/office-zip.js',
      './assets/js/workers/office.worker.js',
      './assets/js/formats/office.js',
    ],
  },
];
export function visibleChips() {
  return FORMAT_CAPABILITIES.filter((entry) => entry.chip);
}
export function statusSummary() {
  return Object.keys(STATUS_KEYS).map((status) => ({
    status,
    key: STATUS_KEYS[status],
    count: FORMAT_CAPABILITIES.filter((entry) => entry.status === status).length,
  }));
}
export function features() {
  return OFFLINE_FEATURES.map((feature) => ({ ...feature, urls: [...feature.urls] }));
}
export function featureFor(id) {
  return OFFLINE_FEATURES.find((feature) => feature.id === id) || null;
}