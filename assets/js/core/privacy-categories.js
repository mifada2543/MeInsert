/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — MeInsert Source-Available License v1.0 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
/* Kategori metadata sensitif untuk fitur "Bersihkan Metadata" */
import { isXmpOnlyImageSubtype } from './tag-utils.js';
export const CLEAN_CATEGORIES = ['location', 'device', 'identity', 'software', 'thumbnail', 'history'];
export const CLEAN_PROFILE_CATEGORIES = {
  privacy: ['location', 'device', 'identity', 'software', 'thumbnail', 'history'],
  all: ['location', 'device', 'identity', 'software', 'thumbnail', 'history'],
  custom: [],
};
const PRESERVE_REASON = {
  generated: 'ui.cleanReasonGenerated',
  orientation: 'ui.cleanReasonOrientation',
  structure: 'ui.cleanReasonStructure',
};
const GENERATED_PREFIX = /^(file|system|exiftool|composite)/;
const THUMBNAIL_FILE_EXCEPTION = /^file (previewimage|thumbnailimage)/;
const ORIENTATION_PATTERN = /(orientation|rotate|rotation|rotatematrix)/;
const STRUCTURE_PATTERNS = [
  /duration/,
  /stream/,
  /codec/,
  /framerate/,
  /framecount/,
  /bitrate/,
  /samplerate/,
  /channels?/,
  /pagecount/,
  /numpages/,
  /\bpages\b/,
  /image(width|height|size)/,
  /\b(width|height)\b/,
  /timescale/,
  /matrix/,
  /bitspersample/,
  /compression/,
  /mimetype/,
  /filesize/,
];
const CATEGORY_PATTERNS = {
  location: [
    /\bgps/,
    /\b(latitude|longitude|altitude|geolocation|geoposition)\b/,
    /\blocation/,
    /\b(city|country|countryname|countrycode|state|province|region|postalcode|zipcode|sublocation|address)\b/,
  ],
  device: [
    /serial/,
    /uniqueid/,
    /cameraowner/,
    /bodyowner/,
    /lensowner/,
    /device(id|serial|unique)/,
  ],
  identity: [
    /\b(author|artist|creator|owner|contact|albumartist)\b/,
    /(owner|contact|author|artist|creator)name/,
    /\btpe[12]\b/,
  ],
  software: [
    /\bsoftware\b/,
    /creatortool/,
    /encodeby/,
    /encodedby/,
    /\bencoder\b/,
    /\btenc\b/,
    /\bproducer\b/,
  ],
  thumbnail: [
    /thumbnail/,
    /previewimage/,
    /\bpreview\b/,
    /\bjif\b/,
  ],
  history: [
    /history/,
    /derivedfrom/,
    /originaldocumentid/,
    /\bdocumentid\b/,
    /\binstanceid\b/,
    /metadatadate/,
    /editlog/,
    /revision/,
    /versionid/,
  ],
};
const CATEGORY_PRIORITY = ['thumbnail', 'history', 'location', 'device', 'software', 'identity'];
const OFFICE_CATEGORY_PATTERNS = {
  identity: [
    /(?:^| )cp lastmodifiedby$/,
    /(?:^| )app xml (?:company|manager)$/,
    /^(?:company|manager)$/,
  ],
  software: [
    /(?:^| )app xml application$/,
    /^application$/,
    /(?:^| )meta generator$/,
  ],
  history: [
    /(?:^| )meta editing (?:cycles|duration)$/,
    /(?:^| )cp revision$/,
    /(?:^| )dcterms modified$/,
  ],
};
const FIELD_CATEGORIES = ['identity', 'software', 'location'];
function normalizeTagText(tag) {
  return String(tag ?? '')
    .toLowerCase()
    .replace(/^\/+/, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
function preservedTagReason(norm, formatId) {
  if (THUMBNAIL_FILE_EXCEPTION.test(norm)) return '';
  if (formatId === 'office' && OFFICE_CATEGORY_PATTERNS.history.some((pattern) => pattern.test(norm))) return '';
  if (GENERATED_PREFIX.test(norm)) return PRESERVE_REASON.generated;
  if (ORIENTATION_PATTERN.test(norm)) return PRESERVE_REASON.orientation;
  if (STRUCTURE_PATTERNS.some((pattern) => pattern.test(norm))) return PRESERVE_REASON.structure;
  return '';
}
function isPreserved(norm, formatId) {
  return Boolean(preservedTagReason(norm, formatId));
}
/**
 * Petakan satu nama tag ke kategori bersih, atau `null` jika bukan kandidat.
 * @param {string} formatId id format snapshot (dipakai untuk aturan khusus format).
 * @param {string} tag nama tag mentah, mis. `EXIF:GPSLatitude`.
 * @returns {string|null}
 */
export function categorizeRawTag(formatId, tag) {
  const norm = normalizeTagText(tag);
  if (!norm || isPreserved(norm, formatId)) return null;
  if (formatId === 'office') {
    for (const category of CATEGORY_PRIORITY) {
      if (OFFICE_CATEGORY_PATTERNS[category]?.some((pattern) => pattern.test(norm))) return category;
    }
  }
  if (formatId === 'pdf' && norm === 'creator') return 'software';
  if (/^gps:/i.test(String(tag ?? '').trim())) return 'location';
  for (const category of CATEGORY_PRIORITY) {
    if (CATEGORY_PATTERNS[category].some((pattern) => pattern.test(norm))) return category;
  }
  return null;
}
function fieldCategory(formatId, field) {
  if (!field?.id) return null;
  for (const candidate of [field.id, field.native, field.label]) {
    const category = categorizeRawTag(formatId, candidate);
    if (FIELD_CATEGORIES.includes(category)) return category;
  }
  return null;
}
function customKeyCategory(formatId, row) {
  return categorizeRawTag(formatId, row?.canonicalKey || row?.key);
}
function rowCategory(formatId, row) {
  if (String(row?.group || '').toLowerCase() === 'thumbnail') return 'thumbnail';
  return categorizeRawTag(formatId, row?.tag);
}
function emptyCategories() {
  return Object.fromEntries(CLEAN_CATEGORIES.map((category) => [category, { count: 0, tags: [] }]));
}
function addFinding(bucket, finding) {
  const entry = bucket.categories[finding.category];
  if (!entry) return;
  entry.count += 1;
  entry.tags.push({ tag: finding.tag, label: finding.label || finding.tag, value: finding.value });
  bucket.sensitive.push({ tag: finding.tag, category: finding.category, value: finding.value });
}
export function summarizeCleaning(snapshot) {
  const formatId = snapshot?.format?.id || '';
  const bucket = { categories: emptyCategories(), sensitive: [], total: 0, kept: [] };
  const keptSeen = new Set();
  const seenRaw = new Set();
  const seenCustom = new Set();
  const keep = (tag, reason) => {
    const name = String(tag || '').trim();
    if (!name || keptSeen.has(name)) return;
    keptSeen.add(name);
    bucket.kept.push({ tag: name, reason });
  };
  for (const field of Object.values(snapshot?.fields || {})) {
    if (!field?.id) continue;
    const normalized = normalizeTagText(field.id);
    const nativeReason = preservedTagReason(normalizeTagText(field.native), formatId);
    if (normalized && isPreserved(normalized, formatId)) {
      keep(field.id, preservedTagReason(normalized, formatId));
      continue;
    }
    if (nativeReason) {
      keep(field.id, nativeReason);
      continue;
    }
    if (!field.normalized) continue;
    const category = fieldCategory(formatId, field);
    if (category) {
      addFinding(bucket, { tag: field.id, label: field.label, value: field.value, category });
    }
  }
  for (const row of snapshot?.raw || []) {
    if (!row?.tag) continue;
    const norm = normalizeTagText(row.tag);
    if (norm && isPreserved(norm, formatId)) {
      keep(row.tag, preservedTagReason(norm, formatId));
      continue;
    }
    if (!row.value || !norm || seenRaw.has(norm)) continue;
    seenRaw.add(norm);
    const category = rowCategory(formatId, row);
    if (category) addFinding(bucket, { tag: row.tag, label: row.label, value: row.value, category });
  }
  for (const row of snapshot?.custom || []) {
    if (!row?.key || !row.value) continue;
    const canonical = row.canonicalKey || normalizeTagText(row.key);
    if (seenCustom.has(canonical)) continue;
    seenCustom.add(canonical);
    const category = customKeyCategory(formatId, row);
    if (category) addFinding(bucket, { tag: row.key, label: row.key, value: row.value, category });
  }
  if (snapshot?.cover?.present) {
    const value = snapshot.cover.mime || 'gambar tersemat';
    addFinding(bucket, { tag: 'cover', label: 'Sampul', value, category: 'thumbnail' });
  }
  bucket.total = bucket.sensitive.length;
  return bucket;
}
function selectedSet(selectedCategories) {
  if (typeof selectedCategories === 'string' && CLEAN_PROFILE_CATEGORIES[selectedCategories]) {
    return new Set(CLEAN_PROFILE_CATEGORIES[selectedCategories]);
  }
  if (selectedCategories instanceof Set) {
    return new Set([...selectedCategories].map((value) => String(value)));
  }
  if (Array.isArray(selectedCategories)) {
    return new Set(selectedCategories.map((value) => String(value)));
  }
  return new Set();
}
export function buildCleanPayload(snapshot, selectedCategories) {
  const selected = selectedSet(selectedCategories);
  const formatId = snapshot?.format?.id || '';
  const xmpOnly = formatId === 'image' && isXmpOnlyImageSubtype(snapshot?.format?.subtype);
  const payload = { set: {}, remove: [], custom: [], customRemove: [], rawRemove: [], cover: null };
  const removedFields = new Set();
  const removedRaw = new Set();
  const removedCustom = new Set();
  let count = 0;
  for (const field of Object.values(snapshot?.fields || {})) {
    if (!field?.id || !field.normalized || removedFields.has(field.id)) continue;
    const category = fieldCategory(formatId, field);
    if (!category || !selected.has(category)) continue;
    removedFields.add(field.id);
    payload.remove.push(field.id);
    count += 1;
  }
  for (const row of snapshot?.raw || []) {
    if (!row?.tag || !row.value) continue;
    if (xmpOnly && !/^XMP[-.]/i.test(row.tag)) continue;
    const canonical = normalizeTagText(row.tag);
    if (!canonical || removedRaw.has(canonical)) continue;
    const category = rowCategory(formatId, row);
    if (!category || !selected.has(category)) continue;
    removedRaw.add(canonical);
    payload.rawRemove.push(row.tag);
    count += 1;
  }
  for (const row of snapshot?.custom || []) {
    if (!row?.key || !row.value) continue;
    if (xmpOnly && !/^XMP[-.]/i.test(row.key)) continue;
    const canonical = row.canonicalKey || normalizeTagText(row.key);
    if (removedCustom.has(canonical)) continue;
    const category = customKeyCategory(formatId, row);
    if (!category || !selected.has(category)) continue;
    removedCustom.add(canonical);
    payload.customRemove.push(row.key);
    count += 1;
  }
  if (selected.has('thumbnail') && snapshot?.cover?.present) {
    payload.cover = { action: 'remove' };
    count += 1;
  }
  payload.count = count;
  return payload;
}
export function isCleanableField(formatId, fieldId) {
  const norm = normalizeTagText(fieldId);
  if (!norm || isPreserved(norm, formatId)) return false;
  return FIELD_CATEGORIES.includes(categorizeRawTag(formatId, fieldId));
}