/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
// Persisted description of which optional engines the user wants available
import { OFFLINE_FEATURES, featureFor } from './format-capabilities.js';
export const OFFLINE_PROFILE_KEY = 'meinsert.offlineProfile';
export const OFFLINE_PROFILE_VERSION = 1;
const MODES = ['frugal', 'selected', 'all'];
const ALL_IDS = OFFLINE_FEATURES.map((feature) => feature.id);
const KNOWN_IDS = new Set(ALL_IDS);
function blankProfile() {
  return { mode: 'frugal', features: [], updatedAt: 0 };
}
function normalize(profile) {
  try {
    if (!profile || typeof profile !== 'object' || Array.isArray(profile)) return blankProfile();
    if (profile.version !== undefined && profile.version !== OFFLINE_PROFILE_VERSION) return blankProfile();
    const mode = MODES.includes(profile.mode) ? profile.mode : 'frugal';
    const updatedAt = Number.isFinite(profile.updatedAt) && profile.updatedAt > 0
      ? Math.trunc(profile.updatedAt)
      : 0;
    if (mode === 'frugal') return { mode, features: [], updatedAt };
    if (mode === 'all') return { mode, features: [...ALL_IDS], updatedAt };
    const features = Array.isArray(profile.features)
      ? [...new Set(profile.features.filter((id) => typeof id === 'string' && KNOWN_IDS.has(id)))]
      : [];
    return { mode: 'selected', features, updatedAt };
  } catch {
    return blankProfile();
  }
}
export function getProfile(storage) {
  try {
    const raw = storage?.getItem?.(OFFLINE_PROFILE_KEY);
    if (typeof raw !== 'string' || !raw) return blankProfile();
    return normalize(JSON.parse(raw));
  } catch {
    return blankProfile();
  }
}
export function setProfile(storage, profile) {
  try {
    if (!storage || typeof storage.setItem !== 'function') return false;
    const clean = normalize(profile);
    clean.updatedAt = clean.updatedAt || Date.now();
    storage.setItem(OFFLINE_PROFILE_KEY, JSON.stringify({ ...clean, version: OFFLINE_PROFILE_VERSION }));
    return true;
  } catch {
    return false;
  }
}
export function featuresForProfile(profile) {
  try {
    return normalize(profile)
      .features
      .map((id) => featureFor(id))
      .filter(Boolean)
      .map((feature) => ({ ...feature, urls: [...feature.urls] }));
  } catch {
    return [];
  }
}
export function optionalUrls(profile) {
  try {
    return [...new Set(featuresForProfile(profile).flatMap((feature) => feature.urls))];
  } catch {
    return [];
  }
}
const SHARED_OPTIONAL_BYTES = new Map([
  ['./assets/vendor/mediabunny.mjs', 722_897],
  ['./assets/vendor/fflate.mjs', 90_922],
]);
export function estimatedBytes(profile) {
  try {
    const seen = new Set();
    return featuresForProfile(profile).reduce((sum, feature) => {
      let bytes = Number(feature.bytes) || 0;
      for (const url of feature.urls) {
        if (seen.has(url)) bytes -= SHARED_OPTIONAL_BYTES.get(url) || 0;
        seen.add(url);
      }
      return sum + bytes;
    }, 0);
  } catch {
    return 0;
  }
}