/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — MeInsert Source-Available License v1.0 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import { crossTarget } from './format-map.js';
import { asArray, asString } from './tag-utils.js';

const storageKey = 'meinsert-metadata-presets-v1';
let memory = [];
let sessionOnly = false;
export const MAX_PRESET_BYTES = 128 * 1024;

export function validatePreset(input) {
  const name = typeof input?.name === 'string' ? input.name.trim() : '';
  if (input?.version !== 1 || !name || name.length > 80 || !Array.isArray(input.fields)
      || input.fields.length === 0 || input.fields.length > 64) {
    throw new Error('Invalid preset');
  }
  const seen = new Set();
  const fields = input.fields.map(({ id, value } = {}) => {
    if (typeof id !== 'string' || !/^[a-z][a-zA-Z0-9]{0,63}$/.test(id)
        || ['constructor', 'prototype'].includes(id) || seen.has(id)
        || typeof value !== 'string' || !value.trim() || value.length > 10000) {
      throw new Error('Invalid preset field');
    }
    seen.add(id);
    return { id, value };
  });
  const preset = { version: 1, name, fields };
  if (new Blob([JSON.stringify(preset)]).size > MAX_PRESET_BYTES) throw new Error('Preset too large');
  return preset;
}

export function readPresets() {
  if (!sessionOnly) {
    try {
      const saved = localStorage.getItem(storageKey);
      memory = saved ? JSON.parse(saved).slice(0, 40).map(validatePreset) : [];
    } catch { /* In-memory fallback for unavailable or invalid storage. */ }
  }
  return [...memory];
}

export function savePresets(presets) {
  const validated = presets.slice(0, 40).map(validatePreset);
  memory = validated;
  try {
    localStorage.setItem(storageKey, JSON.stringify(memory));
    sessionOnly = false;
  } catch { sessionOnly = true; }
  return !sessionOnly;
}

export function presetFromValues(name, values) {
  return validatePreset({ version: 1, name, fields: Object.entries(values)
    .map(([id, value]) => ({ id, value: asString(value).trim() }))
    .filter(({ value }) => value) });
}

export function fieldsForPreset(adapter, detection) {
  if (adapter?.meta?.readOnly) return [];
  return adapter?.fieldsFor?.(detection?.subtype) || adapter?.fields || [];
}

const crossAliases = new Map([['creator', 'artist'], ['author', 'artist'], ['rights', 'copyright'], ['track', 'trackNumber']]);
export function presetPatch(preset, adapter, detection) {
  const fields = fieldsForPreset(adapter, detection);
  const patch = {};
  for (const { id, value } of preset.fields) {
    const mapped = crossTarget(detection?.id, crossAliases.get(id) || id);
    const field = fields.find((entry) => entry.id === id) || fields.find((entry) => entry.id === mapped);
    if (!field) continue;
    let normalized = value;
    if (field.id === 'year' && /^\d{4}-\d\d-\d\d$/.test(value)) normalized = value.slice(0, 4);
    if (field.type === 'date' && !/^\d{4}-\d\d-\d\d$/.test(normalized)) continue;
    if (field.type === 'number' && (!/^\d+$/.test(normalized)
      || Number(normalized) < (field.min ?? 0) || Number(normalized) > (field.max ?? Number.MAX_SAFE_INTEGER))) continue;
    if (field.maxLength && normalized.length > field.maxLength) continue;
    patch[field.id] = field.type === 'tags' ? asArray(normalized) : normalized;
  }
  return patch;
}
