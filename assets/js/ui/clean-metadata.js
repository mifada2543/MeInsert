/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import { t, translated, bindTranslation } from '../i18n/index.js';
import { el, clear, qs } from './dom.js';
import { icon } from './icons.js';
import { showToast } from './toast.js';
import { createSnapshot } from '../core/metadata-snapshot.js';
import {
  CLEAN_CATEGORIES,
  CLEAN_PROFILE_CATEGORIES,
  summarizeCleaning,
  buildCleanPayload,
} from '../core/privacy-categories.js';
import { beginChange } from '../core/history.js';
import { refreshCoverPreview, renderWorkspace } from '../editor/editor-view.js';
import { syncActionBar } from '../editor/editor-changes.js';
const CATEGORY_LABELS = {
  location: 'ui.cleanCategoryLocation',
  device: 'ui.cleanCategoryDevice',
  identity: 'ui.cleanCategoryIdentity',
  software: 'ui.cleanCategorySoftware',
  thumbnail: 'ui.cleanCategoryThumbnail',
  history: 'ui.cleanCategoryHistory',
};
const PROFILES = [
  { id: 'privacy', label: 'ui.cleanProfilePrivacy', hint: 'ui.cleanProfilePrivacyHint' },
  { id: 'all', label: 'ui.cleanProfileAll', hint: 'ui.cleanProfileAllHint' },
  { id: 'custom', label: 'ui.cleanProfileCustom', hint: 'ui.cleanProfileCustomHint' },
];
let current = null;
let currentCleanup = null;
let pendingResolve = null;
function categoryLabel(category) {
  const key = CATEGORY_LABELS[category];
  return key ? t(key) : category;
}
function displayValue(value) {
  return String(value ?? '').trim() || '—';
}
function summaryColumns(summary, selected) {
  const chosen = new Set(selected);
  const before = el('div', { className: 'clean-summary-col is-before' },
    el('h4', { className: 'clean-summary-col-title', textContent: 'Sebelum' }));
  const after = el('div', { className: 'clean-summary-col is-after' },
    el('h4', { className: 'clean-summary-col-title', textContent: 'Sesudah' }));
  for (const category of CLEAN_CATEGORIES) {
    const info = summary.categories?.[category] || { count: 0, tags: [] };
    const count = Number(info.count) || 0;
    const willRemove = chosen.has(category);
    const tags = Array.isArray(info.tags) ? info.tags : [];
    before.append(el('div', { className: 'clean-summary-row' },
      el('div', { className: 'clean-summary-row-head' },
        el('strong', { textContent: translated(() => categoryLabel(category)) }),
        el('span', { className: 'clean-count', textContent: translated(() => t('ui.cleanTagCount', { v0: count })) }),
      ),
      tags.length
        ? el('ul', { className: 'clean-tag-list' }, ...tags.map((tag) => el('li', {},
          el('span', { className: 'clean-tag-name', textContent: String(tag.label || tag.tag || '') }),
          el('span', { className: 'clean-tag-value', textContent: displayValue(tag.value) }),
        )))
        : null,
    ));
    after.append(el('div', { className: `clean-summary-row${willRemove ? ' is-zero' : ''}` },
      el('div', { className: 'clean-summary-row-head' },
        el('strong', { textContent: translated(() => categoryLabel(category)) }),
        el('span', { className: 'clean-count', textContent: translated(() => t('ui.cleanTagCount', { v0: willRemove ? 0 : count })) }),
      ),
      willRemove
        ? el('span', { className: 'clean-zero-note', textContent: translated(() => t('ui.removed')) })
        : el('span', { className: 'clean-kept-note', textContent: translated(() => t('ui.cleanKept')) }),
    ));
  }
  return el('div', { className: 'clean-summary-grid' },
    before,
    el('div', { className: 'clean-summary-arrow', 'aria-hidden': 'true' }, '→'),
    after,
  );
}
function sensitiveBlock(summary) {
  const sensitive = Array.isArray(summary.sensitive) ? summary.sensitive : [];
  if (!sensitive.length) {
    return el('p', { className: 'clean-empty', textContent: translated(() => t('ui.cleanNoSensitive')) });
  }
  return el('div', { className: 'clean-sensitive' },
    el('h4', { className: 'clean-block-title', textContent: translated(() => t('ui.cleanFoundTags')) }),
    el('ul', { className: 'clean-sensitive-list' }, ...sensitive.map((item) => el('li', { className: 'clean-sensitive-item' },
      el('div', { className: 'clean-sensitive-meta' },
        el('strong', { textContent: String(item.tag || '') }),
        el('span', { className: 'clean-sensitive-category', textContent: translated(() => categoryLabel(item.category)) }),
      ),
      el('code', { className: 'clean-sensitive-value', textContent: displayValue(item.value) }),
      el('span', { className: 'clean-remove-badge' },
        icon('trash'),
        translated(() => t('ui.removed')),
      ),
    ))),
  );
}
function keptBlock(summary) {
  const kept = Array.isArray(summary.kept) ? summary.kept : [];
  if (!kept.length) return null;
  return el('div', { className: 'clean-kept' },
    el('h4', { className: 'clean-block-title', textContent: translated(() => t('ui.cleanKept')) }),
    el('p', { className: 'clean-kept-hint', textContent: translated(() => t('ui.cleanKeptHint')) }),
    el('ul', { className: 'clean-kept-list' }, ...kept.map((item) => el('li', { className: 'clean-kept-item' },
      el('strong', { textContent: String(item.tag || '') }),
      item.reason ? el('span', { className: 'clean-kept-reason', textContent: translated(() => t(String(item.reason))) }) : null,
    ))),
  );
}
export function mountCleanButton({ container, ctx } = {}) {
  if (typeof document === 'undefined') return null;
  const target = document.getElementById('actionOptions') || container;
  const host = target || qs('.action-bar');
  if (!host) return null;
  const existing = qs('.clean-metadata-btn', host);
  if (existing) return existing;
  const button = el('button', {
    type: 'button',
    id: 'cleanMetadataBtn',
    className: 'button ghost small clean-metadata-btn',
    title: translated(() => t('ui.cleanMetadata')),
    'aria-label': translated(() => t('ui.cleanMetadata')),
  }, icon('shield'), translated(() => t('ui.cleanMetadata')));
  button.addEventListener('click', () => { void openCleanPanel(ctx); });
  host.insertBefore(button, qs('.action-buttons', host) || null);
  return button;
}
export function openCleanPanel(ctx) {
  if (typeof document === 'undefined') return Promise.resolve(false);
  const { state } = ctx || {};
  if (!state || state.status !== 'ready' || !state.adapter || !state.readResult || !state.file) {
    showToast(t('ui.cleanNoFile'), 'info', 4200);
    return Promise.resolve(false);
  }
  closeCleanPanel(false);
  const snapshot = createSnapshot({
    adapter: state.adapter,
    detection: state.detection,
    readResult: state.readResult,
  });
  const summary = summarizeCleaning(snapshot);
  const focusBefore = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const prevOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  const promise = new Promise((resolve) => { pendingResolve = resolve; });
  let profile = 'privacy';
  let currentCount = 0;
  let selected = [];
  const profileInputs = new Map();
  const categoryInputs = new Map();
  const profiles = el('div', { className: 'clean-profiles', role: 'radiogroup' });
  for (const item of PROFILES) {
    const input = el('input', {
      type: 'radio',
      name: 'cleanProfile',
      id: `cleanProfile-${item.id}`,
      value: item.id,
      checked: item.id === profile,
    });
    profileInputs.set(item.id, input);
    profiles.append(el('label', { className: 'clean-profile', for: input.id },
      input,
      el('span', { className: 'clean-profile-copy' },
        el('strong', { textContent: translated(() => t(item.label)) }),
        el('span', { className: 'clean-profile-hint', textContent: translated(() => t(item.hint)) }),
      ),
    ));
  }
  const customList = el('div', { className: 'clean-custom-list' });
  for (const category of CLEAN_CATEGORIES) {
    const input = el('input', {
      type: 'checkbox',
      id: `cleanCategory-${category}`,
      checked: profile === 'custom' && (CLEAN_PROFILE_CATEGORIES.custom || []).includes(category),
    });
    categoryInputs.set(category, input);
    customList.append(el('label', { className: 'clean-custom-item', for: input.id },
      input,
      el('span', { textContent: translated(() => categoryLabel(category)) }),
    ));
  }
  const customContainer = el('div', { className: 'clean-custom' },
    el('h3', { className: 'clean-section-title', textContent: translated(() => t('ui.cleanProfileCustomHint')) }),
    customList,
  );
  const summaryHost = el('div', { className: 'clean-summary' },
    el('h3', { className: 'clean-section-title', textContent: translated(() => t('ui.cleanSummary')) }),
  );
  const summaryBody = el('div', { className: 'clean-summary-body' });
  summaryHost.append(summaryBody);
  const cancelButton = el('button', {
    className: 'button ghost clean-btn-cancel',
    type: 'button',
    textContent: translated(() => t('ui.close')),
  });
  const applyButton = el('button', {
    className: 'button primary clean-btn-apply',
    type: 'button',
  });
  const card = el('div', {
    className: 'clean-card',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-labelledby': 'cleanTitle',
    'aria-describedby': 'cleanIntro',
  },
    el('div', { className: 'clean-head' },
      el('div', { className: 'clean-head-icon', 'aria-hidden': 'true' }, icon('shield')),
      el('div', { className: 'clean-head-copy' },
        el('h2', { id: 'cleanTitle', className: 'clean-title', textContent: translated(() => t('ui.cleanMetadata')) }),
        el('p', { id: 'cleanIntro', className: 'clean-intro', textContent: translated(() => t('ui.cleanMetadataIntro')) }),
      ),
      el('button', { className: 'clean-close', type: 'button', 'aria-label': translated(() => t('ui.close')), textContent: '×' }),
    ),
    el('div', { className: 'clean-body' }, profiles, customContainer, summaryHost),
    el('div', { className: 'clean-foot' },
      el('p', { className: 'clean-foot-note', textContent: translated(() => t('ui.noUploadsAllProcessingIsLocal')) }),
      el('div', { className: 'clean-actions' }, cancelButton, applyButton),
    ),
  );
  const backdrop = el('div', { className: 'clean-backdrop' }, card);
  document.body.append(backdrop);
  function readSelection() {
    if (profile === 'custom') {
      return CLEAN_CATEGORIES.filter((category) => categoryInputs.get(category)?.checked);
    }
    return [...(CLEAN_PROFILE_CATEGORIES[profile] || [])];
  }
  function update() {
    selected = readSelection();
    const payload = buildCleanPayload(snapshot, selected);
    currentCount = Number(payload?.count) || 0;
    bindTranslation(applyButton, 'textContent', () => t('ui.cleanConfirm', { v0: currentCount, v1: 1 }));
    customContainer.hidden = profile !== 'custom';
    clear(summaryBody);
    summaryBody.append(summaryColumns(summary, selected), sensitiveBlock(summary), keptBlock(summary));
    applyButton.disabled = currentCount === 0;
  }
  for (const [id, input] of profileInputs) {
    input.addEventListener('change', () => {
      if (!input.checked) return;
      profile = id;
      update();
    });
  }
  for (const input of categoryInputs.values()) {
    input.addEventListener('change', () => {
      if (profile !== 'custom') {
        profile = 'custom';
        profileInputs.get('custom').checked = true;
      }
      update();
    });
  }
  update();
  const cleanup = () => {
    document.removeEventListener('keydown', onKeydown, true);
    document.body.style.overflow = prevOverflow || '';
    if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
    if (current === backdrop) current = null;
    currentCleanup = null;
    if (focusBefore && typeof focusBefore.focus === 'function') {
      try { focusBefore.focus(); } catch { /* noop */ }
    }
  };
  currentCleanup = cleanup;
  const finish = (value) => {
    if (!pendingResolve) return;
    const resolve = pendingResolve;
    pendingResolve = null;
    cleanup();
    resolve(value);
  };
  const focusables = () => [...card.querySelectorAll('button:not(:disabled), input:not(:disabled), [href], summary')];
  const onKeydown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      finish(false);
      return;
    }
    if (event.key !== 'Tab') return;
    const items = focusables().filter((node) => node.offsetParent !== null);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };
  document.addEventListener('keydown', onKeydown, true);
  cancelButton.addEventListener('click', () => finish(false));
  card.querySelector('.clean-close').addEventListener('click', () => finish(false));
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) finish(false);
  });
  applyButton.addEventListener('click', () => {
    const payload = buildCleanPayload(snapshot, readSelection());
    if (!(Number(payload?.count) || 0)) {
      showToast(t('ui.cleanNoSensitive'), 'info', 4000);
      return;
    }
    finish(true);
    applyCleaning(ctx, payload);
  });

  current = backdrop;
  cancelButton.focus();
  return promise;
}
function applyCleaning(ctx, payload) {
  const { els, state } = ctx;
  beginChange(state.history, 'clean-metadata', t('ui.changeHistoryClean'));
  for (const [id, value] of Object.entries(payload.set || {})) {
    state.values[id] = value;
    state.removedFields.delete(id);
  }
  for (const id of payload.remove || []) {
    state.removedFields.add(id);
    delete state.values[id];
  }
  for (const tag of payload.rawRemove || []) {
    state.rawRemove.add(tag);
  }
  for (const key of payload.customRemove || []) {
    state.removedCustom.add(key);
  }
  for (const row of payload.custom || []) {
    if (!row?.key) continue;
    state.customRows.push({
      uid: ++state.customUid,
      key: row.key,
      value: row.value || '',
      originalKey: null,
      originalValue: '',
    });
  }
  if (payload.cover?.action === 'remove') {
    state.coverAction = 'remove';
    state.coverChosen = null;
    refreshCoverPreview(state);
  }
  state.saveError = null;
  state.result = null;
  renderWorkspace(ctx);
  syncActionBar(els, state);
  showToast(t('ui.cleanAddedToReview'), 'info', 6000);
}
export function closeCleanPanel(value = false) {
  if (!current) {
    if (pendingResolve) {
      const resolve = pendingResolve;
      pendingResolve = null;
      try { resolve(value); } catch { /* noop */ }
    }
    return;
  }
  const resolve = pendingResolve;
  pendingResolve = null;
  if (currentCleanup) {
    const run = currentCleanup;
    currentCleanup = null;
    run();
  }
  if (resolve) {
    try { resolve(value); } catch { /* noop */ }
  }
}
export function isCleanPanelOpen() {
  return Boolean(current);
}