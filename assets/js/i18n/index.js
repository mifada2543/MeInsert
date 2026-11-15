/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import id from './id.js';
import en from './en.js';

export const STORAGE_KEY = 'meinsert-language';
export const catalogs = { id, en };
export function resolveLanguage(stored, preferred = []) {
  if (stored === 'id' || stored === 'en') return stored;
  for (const language of typeof preferred === 'string' ? [preferred] : preferred) {
    const code = String(language).toLowerCase().split('-')[0];
    if (code === 'id' || code === 'en') return code;
  }
  return 'id';
}
let stored;
try { stored = globalThis.localStorage?.getItem(STORAGE_KEY); } catch { /* blocked storage */ }
let language = resolveLanguage(stored, globalThis.navigator?.languages || [globalThis.navigator?.language]);
const listeners = new Set();
export function getLanguage() { return language; }
export function t(key, parameters = {}, locale = language) {
  let value = catalogs[locale]?.[key] ?? id[key] ?? key;
  if (typeof value === 'object') {
    const category = new Intl.PluralRules(locale === 'en' ? 'en' : 'id').select(Number(parameters.count ?? parameters.v0) || 0);
    value = value[category] ?? value.other;
  }
  return String(value).replace(/\{(\w+)\}/g, (match, name) => Object.hasOwn(parameters, name) ? String(parameters[name]) : match);
}
export function onLanguageChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
const sourceKeys = new Map(Object.entries(id).filter(([, value]) => typeof value === 'string').map(([key, value]) => [value, key]));
// Some adapters originally used English labels even in the Indonesian UI.
// These are display-label aliases, not native tag names or metadata values.
for (const [source, key] of Object.entries({ 'Album artist': 'ui.albumArtist', Creator: 'ui.creator', Producer: 'ui.producer', Track: 'field.trackNumber', Disc: 'field.discNumber' })) sourceKeys.set(source, key);
const templates = [...sourceKeys].filter(([source]) => /\{v\d+\}/.test(source)).map(([source, key]) => {
  const names = [];
  const numericFirst = /^\{v0\} (?:file|tag|catatan|operasi|perubahan|halaman|metadata|siap|selesai|diperiksa)\b/.test(source)
    || /^\{v0\}\/\{v1\}/.test(source) || /^ · \{v0\}/.test(source);
  const escaped = source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\{(v\d+)\\\}/g, (_, name) => {
    names.push(name);
    return numericFirst && name === 'v0' ? '(\\d+)' : '([\\s\\S]*?)';
  });
  return { key, names, regex: new RegExp(`^${escaped}$`), weight: source.replace(/\{v\d+\}/g, '').length };
}).sort((a, b) => b.weight - a.weight);
export function translateSource(source) {
  const value = String(source ?? '');
  const key = sourceKeys.get(value);
  if (key) return t(key);
  for (const template of templates) {
    const match = template.regex.exec(value);
    if (match) {
      const parameters = Object.fromEntries(template.names.map((name, index) => [name, match[index + 1]]));
      const original = id[template.key];
      // These parameters are adapter-owned labels or diagnostic messages,
      // unlike tag names, filenames, and metadata values, which stay verbatim.
      if (original.startsWith('Field "') || original.startsWith('{v0}: maksimal') || original.startsWith('{v0}: ukuran batch')) {
        parameters.v0 = sourceKeys.has(parameters.v0) ? t(sourceKeys.get(parameters.v0)) : parameters.v0;
      }
      if (original === 'Tag "{v0}": {v1}') parameters.v1 = translateSource(parameters.v1);
      return t(template.key, parameters);
    }
  }
  return value;
}
const marker = Symbol('localized presentation');
export function translated(read) { return { [marker]: true, read: typeof read === 'function' ? read : () => read }; }
export function isTranslated(value) { return Boolean(value?.[marker]); }
const bindings = new WeakMap();
const nodes = new Set();
function renderBinding(node, attribute, read) {
  const value = translateSource(read());
  if (attribute === 'textContent') node.textContent = value;
  else node.setAttribute(attribute, value);
}
export function bindTranslation(node, attribute, read) {
  let attributes = bindings.get(node);
  if (!attributes) {
    attributes = new Map();
    bindings.set(node, attributes);
    nodes.add(new WeakRef(node));
  }
  attributes.set(attribute, read);
  renderBinding(node, attribute, read);
  return node;
}
export function bindText(node, read) { return bindTranslation(node, 'textContent', typeof read === 'function' ? read : () => read); }
export function translatedNode(read) { return bindText(document.createTextNode(''), read); }
export function setLanguage(next, { persist = true } = {}) {
  if (next !== 'id' && next !== 'en') next = 'id';
  language = next;
  if (persist) {
    try { globalThis.localStorage?.setItem(STORAGE_KEY, next); } catch { /* storage is optional */ }
  }
  if (typeof document !== 'undefined') {
    document.documentElement.lang = next;
    const page = document.body?.dataset.page;
    document.title = t(page === 'batch' ? 'page.batchTitle' : page === 'privacy' ? 'page.privacyTitle' : page === 'terms' ? 'page.termsTitle' : 'page.title');
    document.querySelectorAll('[data-policy-language]').forEach((article) => { article.hidden = article.dataset.policyLanguage !== next; });
    document.querySelectorAll('[data-language-toggle]').forEach((button) => {
      button.textContent = next.toUpperCase();
      button.dataset.currentLanguage = next;
      button.setAttribute('aria-label', t('ui.switchLanguage'));
      button.title = t('ui.switchLanguage');
    });
    document.querySelectorAll('a[data-notice]').forEach((link) => link.setAttribute('href', next === 'en' ? './NOTICE-en.md' : './NOTICE.md'));
    document.querySelectorAll('a[data-policy]').forEach((link) => {
      link.setAttribute('href', link.dataset.policy === 'terms' ? './Terms.html' : './privacy.html');
    });
  }
  for (const reference of nodes) {
    const node = reference.deref();
    if (!node) { nodes.delete(reference); continue; }
    if (!node.isConnected) continue;
    for (const [attribute, read] of bindings.get(node) || []) renderBinding(node, attribute, read);
  }
  listeners.forEach((listener) => listener(next));
  if (typeof document !== 'undefined') document.dispatchEvent(new CustomEvent('meinsert:languagechange', { detail: { language: next } }));
}
export function initLanguage() {
  document.querySelectorAll('[data-i18n]').forEach((node) => bindText(node, () => id[node.dataset.i18n]));
  for (const attribute of ['title', 'aria-label', 'placeholder', 'alt']) {
    document.querySelectorAll(`[data-i18n-${attribute}]`).forEach((node) => {
      const key = node.getAttribute(`data-i18n-${attribute}`);
      bindTranslation(node, attribute, () => id[key]);
    });
  }
  document.querySelectorAll('[data-language-toggle]').forEach((button) => button.addEventListener('click', () => setLanguage(language === 'id' ? 'en' : 'id')));
  setLanguage(language, { persist: false });
  globalThis.addEventListener?.('storage', (event) => {
    if (event.key === STORAGE_KEY) setLanguage(resolveLanguage(event.newValue, navigator.languages), { persist: false });
  });
}
