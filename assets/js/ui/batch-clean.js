/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — MeInsert Source-Available License v1.0 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
/* aksi "Bersihkan metadata" pada mode batch. */
import { bindTranslation, getLanguage, t, translated } from '../i18n/index.js';
import { el } from './dom.js';
import { icon } from './icons.js';
import { showToast } from './toast.js';
import { createSnapshot } from '../core/metadata-snapshot.js';
import {
  CLEAN_CATEGORIES,
  CLEAN_PROFILE_CATEGORIES,
  summarizeCleaning,
  buildCleanPayload,
} from '../core/privacy-categories.js';
const CATEGORY_KEYS = {
  location: 'ui.cleanCategoryLocation',
  device: 'ui.cleanCategoryDevice',
  identity: 'ui.cleanCategoryIdentity',
  software: 'ui.cleanCategorySoftware',
  thumbnail: 'ui.cleanCategoryThumbnail',
  history: 'ui.cleanCategoryHistory',
};
const PROFILE_KEYS = [
  ['privacy', 'ui.cleanProfilePrivacy', 'ui.cleanProfilePrivacyHint'],
  ['all', 'ui.cleanProfileAll', 'ui.cleanProfileAllHint'],
  ['custom', 'ui.cleanProfileCustom', 'ui.cleanProfileCustomHint'],
];
const SAMPLE_LIMIT = 6;
function readyTargets(controller) {
  return (controller?.items || []).filter((item) => item?.readResult
    && !item.excluded
    && !['queued', 'scanning', 'reading', 'error'].includes(item.status));
}
function resolveTargets(controller) {
  const selected = typeof controller.selectedItems === 'function' ? controller.selectedItems() : [];
  const usableSelected = selected.filter((item) => item?.readResult && !['queued', 'scanning', 'reading', 'error'].includes(item.status));
  const fallback = usableSelected.length === 0;
  const targets = fallback ? readyTargets(controller) : usableSelected;
  return { targets, fallback };
}
function snapshotTargets(targets) {
  return targets.map((item) => {
    const snapshot = createSnapshot({
      adapter: item.adapter,
      detection: item.detection,
      readResult: item.readResult,
    });
    return { item, snapshot, summary: summarizeCleaning(snapshot) };
  });
}
function planCleaning(snapshots, categories) {
  const perItem = [];
  const categoryCounts = Object.fromEntries(CLEAN_CATEGORIES.map((category) => [category, 0]));
  const samples = [];
  const unsupported = new Set();
  let keptCount = 0;
  let total = 0;
  for (const target of snapshots) {
    const { item, snapshot, summary } = target;
    const group = (controllerGroup(item));
    const remove = new Set();
    const rawRemove = new Set();
    const customRemove = new Set();
    const removedCategories = [];
    const itemCategoryCounts = {};
    let itemCount = 0;
    for (const category of categories) {
      const payload = buildCleanPayload(snapshot, [category]) || {};
      if (payload.cover?.action === 'remove') {
        unsupported.add(category);
        continue;
      }
      for (const id of payload.remove || []) remove.add(id);
      for (const tag of payload.rawRemove || []) rawRemove.add(tag);
      for (const key of payload.customRemove || []) customRemove.add(key);
      const count = Number(payload.count) || 0;
      const found = Number(summary?.categories?.[category]?.count) || 0;
      if (count > 0 || found > 0) removedCategories.push(category);
      categoryCounts[category] = (categoryCounts[category] || 0) + count;
      itemCategoryCounts[category] = count;
      itemCount += count;
    }
    for (const row of summary?.sensitive || []) {
      if (!categories.includes(row.category) || unsupported.has(row.category)) continue;
      if (samples.length >= SAMPLE_LIMIT) break;
      samples.push(row);
    }
    keptCount += (summary?.kept || []).length;
    total += itemCount;
    perItem.push({
      item,
      group,
      remove: [...remove],
      rawRemove: [...rawRemove],
      customRemove: [...customRemove],
      removedCategories,
      categoryCounts: itemCategoryCounts,
      count: itemCount,
    });
  }
  return {
    perItem,
    categoryCounts,
    samples,
    unsupported: [...unsupported],
    removedCategories: [...new Set(perItem.flatMap((entry) => entry.removedCategories))],
    total,
    keptCount,
    fileCount: snapshots.length,
  };
}
let currentController = null;
function controllerGroup(item) {
  const map = currentController?.groupMap;
  return (map && map.get(item.groupKey))
    || (currentController?.groups || []).find((group) => group.key === item.groupKey)
    || null;
}
function categoryLabel(category) {
  const key = CATEGORY_KEYS[category] || category;
  return translated(() => t(key));
}
function renderPlan(container, confirmButton, plan) {
  container.replaceChildren();
  const summaryTitle = el('h3', {
    className: 'batch-clean-section-title',
    textContent: translated(() => t('ui.cleanSummary')),
  });
  container.append(summaryTitle);
  const rows = el('div', { className: 'batch-clean-rows' });
  let hasRows = false;
  for (const category of CLEAN_CATEGORIES) {
    const count = Number(plan.categoryCounts[category]) || 0;
    if (count <= 0) continue;
    hasRows = true;
    rows.append(el('div', { className: 'batch-clean-row', dataset: { cleanCategory: category } },
      el('span', { className: 'batch-clean-row-label', textContent: categoryLabel(category) }),
      el('span', { className: 'batch-clean-arrow', 'aria-hidden': 'true', textContent: '\u2192' }),
      el('span', { className: 'batch-clean-row-count', textContent: translated(() => t('ui.cleanTagCount', { v0: count })) }),
    ));
  }
  if (!hasRows) {
    rows.append(el('p', {
      className: 'batch-clean-empty',
      textContent: translated(() => t('ui.cleanNoSensitive')),
    }));
  }
  container.append(rows);
  if (plan.samples.length) {
    const samples = el('ul', { className: 'batch-clean-samples' });
    for (const row of plan.samples) {
      samples.append(el('li', {},
        el('strong', { textContent: String(row.tag || '') }),
        el('span', { textContent: `: ${String(row.value ?? '')}` }),
      ));
    }
    container.append(
      el('h4', { className: 'batch-clean-section-title', textContent: translated(() => t('ui.cleanFoundTags')) }),
      samples,
    );
  }
  const kept = el('div', { className: 'batch-clean-kept' },
    el('strong', { textContent: translated(() => t('ui.cleanKept')) }),
    el('span', { textContent: translated(() => t('ui.cleanKeptHint')) }),
  );
  if (plan.keptCount) {
    kept.append(el('span', { className: 'batch-clean-kept-count', textContent: translated(() => t('ui.cleanTagCount', { v0: plan.keptCount })) }));
  }
  container.append(kept);
  if (plan.unsupported.length) {
    const labels = plan.unsupported.map((category) => translated(() => t(CATEGORY_KEYS[category] || category)).read()).join(', ');
    const note = getLanguage() === 'en'
      ? `Not applied in batch: ${labels} (cover removal is not available in batch yet).`
      : `Tidak diterapkan di batch: ${labels} (penghapusan cover belum tersedia di mode batch).`;
    container.append(el('p', {
      className: 'batch-clean-note',
      textContent: translated(() => note),
    }));
  }
  bindTranslation(confirmButton, 'textContent', () => t('ui.cleanConfirm', { v0: plan.total, v1: plan.fileCount }));
  confirmButton.disabled = plan.total === 0;
}
function applyPlan(controller, plan, snapshots) {
  let changedFiles = 0;
  const byItem = new Map(plan.perItem.map((entry) => [entry.item, entry]));
  for (const target of snapshots) {
    const entry = byItem.get(target.item);
    if (!entry) continue;
    const { item, group } = entry;
    let changed = false;
    if (group && entry.remove.length) {
      const additions = entry.remove.filter((id) => !group.remove.has(id));
      if (additions.length) {
        controller.groupHistoryController.begin(group.key, `group:${group.key}:clean`);
        for (const id of additions) group.remove.add(id);
        controller.groupHistoryController.end(group.key);
        changed = true;
      }
    }
    const rawKeys = [...entry.rawRemove, ...entry.customRemove];
    if (rawKeys.length) {
      if (!item.removeRaw) item.removeRaw = new Set();
      for (const key of rawKeys) item.removeRaw.add(key);
      changed = true;
    }
    if (changed) changedFiles += 1;
    item.cleanSummary = {
      categories: Object.fromEntries(entry.removedCategories.map((category) => [
        category,
        Number(entry.categoryCounts?.[category]) || 0,
      ])),
      removedCategories: [...entry.removedCategories],
      removedTagCount: entry.count,
      keptCount: (target.summary?.kept || []).length,
      unsupported: [...plan.unsupported],
    };
  }
  return changedFiles;
}
function buildDialog(state, onClose) {
  const backdrop = el('div', { className: 'batch-clean-backdrop' });
  const cancelButton = el('button', {
    className: 'button ghost batch-clean-cancel',
    type: 'button',
    textContent: translated(() => (getLanguage() === 'en' ? 'Cancel' : 'Batal')),
  });
  const confirmButton = el('button', {
    className: 'button primary batch-clean-confirm',
    type: 'button',
  });
  const summaryBox = el('div', { className: 'batch-clean-summary' });
  const customBox = el('div', { className: 'batch-clean-custom', hidden: true });
  const checkboxes = new Map();
  for (const category of CLEAN_CATEGORIES) {
    const input = el('input', {
      type: 'checkbox',
      className: 'batch-clean-category-input',
      dataset: { cleanCategory: category },
      id: `batchCleanCategory-${category}`,
    });
    input.checked = state.customCategories.has(category);
    input.addEventListener('change', () => {
      if (input.checked) state.customCategories.add(category);
      else state.customCategories.delete(category);
      refresh();
    });
    checkboxes.set(category, input);
    customBox.append(el('label', {
      className: 'batch-clean-category',
      for: input.id,
    }, input, el('span', { textContent: categoryLabel(category) })));
  }
  const profileInputs = new Map();
  const profileBox = el('div', { className: 'batch-clean-profiles', role: 'radiogroup' });
  for (const [value, labelKey, hintKey] of PROFILE_KEYS) {
    const input = el('input', {
      type: 'radio',
      name: 'batchCleanProfile',
      className: 'batch-clean-profile-input',
      value,
      id: `batchCleanProfile-${value}`,
      dataset: { cleanProfile: value },
    });
    input.checked = state.profile === value;
    input.addEventListener('change', () => {
      if (!input.checked) return;
      state.profile = value;
      refresh();
    });
    profileInputs.set(value, input);
    profileBox.append(el('label', { className: 'batch-clean-profile', for: input.id },
      input,
      el('span', { className: 'batch-clean-profile-copy' },
        el('strong', { textContent: translated(() => t(labelKey)) }),
        el('small', { textContent: translated(() => t(hintKey)) }),
      ),
    ));
  }
  const scope = el('p', { className: 'batch-clean-scope' });
  const card = el('div', {
    className: 'batch-clean-card',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-labelledby': 'batchCleanTitle',
    'aria-describedby': 'batchCleanIntro',
  },
    el('div', { className: 'batch-clean-head' },
      el('span', { className: 'batch-clean-icon', 'aria-hidden': 'true' }, icon('shield')),
      el('h2', {
        className: 'batch-clean-title',
        id: 'batchCleanTitle',
        textContent: translated(() => t('ui.cleanMetadata')),
      }),
    ),
    el('p', {
      className: 'batch-clean-intro',
      id: 'batchCleanIntro',
      textContent: translated(() => t('ui.cleanMetadataIntro')),
    }),
    scope,
    profileBox,
    customBox,
    summaryBox,
    el('div', { className: 'batch-clean-actions' }, cancelButton, confirmButton),
  );
  backdrop.append(card);
  function currentCategories() {
    if (state.profile === 'custom') return [...state.customCategories];
    return [...(CLEAN_PROFILE_CATEGORIES[state.profile] || [])];
  }
  function refresh() {
    customBox.hidden = state.profile !== 'custom';
    for (const [category, input] of checkboxes) input.checked = state.customCategories.has(category);
    for (const [value, input] of profileInputs) input.checked = state.profile === value;
    state.plan = planCleaning(state.snapshots, currentCategories());
    renderPlan(summaryBox, confirmButton, state.plan);
  }
  let cleanup = null;
  const close = () => { if (typeof cleanup === 'function') cleanup(); };
  cleanup = onClose(backdrop, {
    cancelButton,
    confirmButton,
    state,
    plan: () => state.plan,
    refresh,
  });
  refresh();
  return { backdrop, scope, close, refresh };
}
export function mountBatchCleanAction({ controller, container } = {}) {
  if (typeof document === 'undefined' || !controller) return null;
  const host = container || document.querySelector('.batch-head-actions');
  if (!host || host.querySelector('#batchCleanBtn')) return null;
  const button = el('button', {
    className: 'button ghost batch-clean-btn',
    id: 'batchCleanBtn',
    type: 'button',
    title: translated(() => t('ui.cleanMetadata')),
    'aria-label': translated(() => t('ui.cleanMetadata')),
  },
    el('span', { className: 'icon', 'aria-hidden': 'true' }, icon('shield')),
    el('span', { textContent: translated(() => t('ui.cleanMetadata')) }),
  );
  host.insertBefore(button, host.firstChild);
  let openState = null;
  let openCleanup = null;
  function closeDialog() {
    const cleanup = openCleanup;
    openCleanup = null;
    openState = null;
    if (typeof cleanup === 'function') cleanup();
  }
  function open() {
    if (button.disabled || typeof controller.busy === 'function' && controller.busy()) return;
    closeDialog();
    currentController = controller;
    const { targets, fallback } = resolveTargets(controller);
    if (!targets.length) {
      showToast(t('ui.cleanNoFile'), 'info', 4200);
      return;
    }
    const snapshots = snapshotTargets(targets);
    const state = {
      profile: 'privacy',
      customCategories: new Set(CLEAN_PROFILE_CATEGORIES.custom || []),
      snapshots,
      plan: null,
      fallback,
    };
    const focusBefore = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    let trap = null;
    const cleanup = () => {
      document.removeEventListener('keydown', trap, true);
      document.body.style.overflow = prevOverflow || '';
      if (dialog.backdrop.parentNode) dialog.backdrop.parentNode.removeChild(dialog.backdrop);
      if (openCleanup === cleanup) { openCleanup = null; openState = null; }
      if (focusBefore && typeof focusBefore.focus === 'function') {
        try { focusBefore.focus(); } catch { /* noop */ }
      }
    };
    const dialog = buildDialog(state, (backdrop, handlers) => {
      handlers.cancelButton.addEventListener('click', () => closeDialog());
      handlers.confirmButton.addEventListener('click', () => {
        const plan = handlers.plan();
        if (!plan || plan.total === 0) return;
        const changedFiles = applyPlan(controller, plan, snapshots);
        if (typeof controller.syncApply === 'function') controller.syncApply();
        closeDialog();
        if (changedFiles > 0) {
          showToast(t('ui.cleanAddedToReview'), 'success', 6000);
        } else {
          showToast(t('ui.cleanNoFile'), 'info', 4200);
        }
      });
      backdrop.addEventListener('click', (event) => {
        if (event.target === backdrop) closeDialog();
      });
      const focusables = () => [
        ...backdrop.querySelectorAll('button:not([disabled]), input:not([disabled])'),
      ].filter((node) => !node.closest('[hidden]'));
      trap = (event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          closeDialog();
        } else if (event.key === 'Tab') {
          const nodes = focusables();
          if (!nodes.length) return;
          const first = nodes[0];
          const last = nodes[nodes.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }
      };
      document.addEventListener('keydown', trap, true);
      return cleanup;
    });
    openState = dialog;
    openCleanup = cleanup;
    document.body.append(dialog.backdrop);
    bindTranslation(dialog.scope, 'textContent', () => (fallback
      ? (getLanguage() === 'en'
        ? `No files selected — cleaning all ${targets.length} ready file(s).`
        : `Tidak ada file dipilih — membersihkan semua ${targets.length} file siap.`)
      : (getLanguage() === 'en'
        ? `Cleaning ${targets.length} selected file(s).`
        : `Membersihkan ${targets.length} file yang dipilih.`)));
    dialog.backdrop.querySelector('.batch-clean-profile-input:checked')?.focus();
  }
  button.addEventListener('click', open);
  function sync() {
    const busy = typeof controller.busy === 'function' && controller.busy();
    const hasReady = readyTargets(controller).length > 0;
    button.disabled = Boolean(busy) || !hasReady;
  }
  sync();
  return {
    button,
    open,
    close: closeDialog,
    sync,
    get isOpen() { return Boolean(openState); },
  };
}