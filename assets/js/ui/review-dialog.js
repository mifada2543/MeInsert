/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import { t, translated } from '../i18n/index.js';
import { el } from './dom.js';
import { icon } from './icons.js';
import { canProceedWithMemory } from '../core/memory-estimate.js';
let current = null;
let currentCleanup = null;
let pendingResolve = null;
function displayValue(value) {
  const text = String(value ?? '').trim();
  return text || '—';
}
function operationRow(operation) {
  const label = operation.label || operation.key || operation.tag || operation.id || 'Metadata';
  const before = displayValue(operation.before);
  const after = operation.action === 'remove' ? 'dihapus' : displayValue(operation.after);
  const arrow = el('span', { className: 'review-arrow', 'aria-hidden': 'true' }, '→');
  return el('div', { className: 'review-operation' },
    el('div', { className: 'review-operation-label' },
      el('strong', { textContent: operation.kind === 'field' || operation.kind === 'cover' ? translated(() => label) : label }),
      operation.native ? el('span', { className: 'review-native', textContent: operation.native }) : null,
    ),
    el('div', { className: 'review-operation-value' },
      el('span', { className: `review-before${operation.action === 'remove' ? ' is-removed' : ''}`, textContent: before }),
      arrow,
      el('span', { className: `review-after${operation.action === 'remove' ? ' is-removed' : ''}`, textContent: operation.action === 'remove' ? translated(() => t('ui.removed')) : after }),
    ),
  );
}
function operationGroup(title, operations, description = '') {
  if (!operations.length) return null;
  return el('section', { className: 'review-group' },
    el('div', { className: 'review-group-head' },
      el('h3', { textContent: translated(() => (title)) }),
      el('span', { className: 'review-count', textContent: translated(() => (String(operations.length))) }),
      description ? el('p', { textContent: translated(() => (description)) }) : null,
    ),
    el('div', { className: 'review-operations' }, ...operations.map(operationRow)),
  );
}
function risksBlock(risks) {
  if (!risks.length) return null;
  const list = el('div', { className: 'review-risks' });
  for (const risk of risks) {
    list.append(el('p', { className: `review-risk is-${risk.severity || 'warning'}` },
      el('span', { className: 'review-risk-icon', 'aria-hidden': 'true' }, icon('alert')),
      el('span', { textContent: translated(() => (risk.message)) }),
    ));
  }
  return el('section', { className: 'review-group' },
    el('div', { className: 'review-group-head' }, el('h3', { textContent: translated(() => (t('ui.warnings'))) })),
    list,
  );
}
function planDetails(plan, { open = false } = {}) {
  const operations = plan.operations || [];
  const fields = operations.filter((operation) => operation.kind === 'field');
  const custom = operations.filter((operation) => operation.kind === 'custom');
  const raw = operations.filter((operation) => operation.kind === 'raw');
  const cover = operations.filter((operation) => operation.kind === 'cover');
  const sidecar = operations.filter((operation) => operation.kind === 'sidecar');
  const unchanged = plan.unchanged || {};
  const details = el('details', { className: 'review-file', open });
  const fileLabel = plan.fileName || plan.outputName || plan.format?.label || 'File';
  const summary = el('summary', { className: 'review-file-summary' },
    el('span', { className: 'review-file-name', textContent: fileLabel }),
    el('span', { className: 'review-file-format', textContent: translated(() => (plan.format?.label || plan.format?.id || '')) }),
    el('span', { className: 'review-file-count', textContent: translated(() => (t('ui.changes', { v0: operations.length }))) }),
  );
  const body = el('div', { className: 'review-file-body' },
    plan.outputName && plan.outputName !== fileLabel
      ? el('p', { className: 'review-output', textContent: translated(() => (t('ui.outputName', { v0: plan.outputName }))) })
      : null,
    xmpSection(plan),
    operationGroup('Field', fields),
    operationGroup('Tag kustom', custom),
    operationGroup('Hapus tag mentah', raw),
    operationGroup('Sampul', cover),
    operationGroup(sidecar[0]?.label || t('ui.lyrics'), sidecar),
    el('p', { className: 'review-unchanged' },
      translated(() => (t('ui.fieldsCustomTagsAndRawTagsRemainUnchanged', { v0: unchanged.fields || 0, v1: unchanged.custom || 0, v2: unchanged.raw || 0 }))),
    ),
  );
  details.append(summary, body);
  return details;
}
function summaryChips(plans) {
  const operations = plans.reduce((sum, plan) => sum + (plan.operations?.length || 0), 0);
  const unchanged = plans.reduce((sum, plan) => sum + (plan.unchanged?.fields || 0) + (plan.unchanged?.custom || 0) + (plan.unchanged?.raw || 0), 0);
  const memory = plans[0]?.memory;
  const chips = [
    el('span', { className: 'review-chip is-strong' }, translated(() => (t('ui.changes', { v0: operations })))),
    el('span', { className: 'review-chip' }, translated(() => (t('ui.files', { v0: plans.length })))),
    el('span', { className: 'review-chip' }, translated(() => (t('ui.metadataEntriesUnchanged', { v0: unchanged })))),
  ];
  if (memory?.estimatedLabel) {
    chips.push(el('span', { className: `review-chip${memory.level && memory.level !== 'ok' ? ' is-warn' : ''}` }, translated(() => (t('ui.estimatedMemory', { v0: memory.estimatedLabel })))));
  }
  return el('div', { className: 'review-summary' }, ...chips);
}
function uniqueRisks(plans) {
  const seen = new Set();
  const risks = [];
  for (const plan of plans) {
    for (const risk of plan.risks || []) {
      const key = `${risk.code}:${risk.message}`;
      if (seen.has(key)) continue;
      seen.add(key);
      risks.push(risk);
    }
  }
  return risks;
}
const XMP_OWNED_FIELD = {
  'dc:title': 'title',
  'dc:creator': 'author',
  'dc:description': 'subject',
  'dc:subject': 'keywords',
  'pdf:keywords': 'keywords',
  'pdf:producer': 'producer',
  'xmp:creatortool': 'creator',
  'xmp:createdate': 'creationDate',
  'xmp:modifydate': 'modDate',
};
function xmpSection(plan) {
  const properties = plan?.before?.xmp?.properties || [];
  const present = plan?.before?.xmp?.present || properties.length > 0;
  if (!present) return null;
  if (!properties.length) {
    return el('section', { className: 'review-group' },
      el('div', { className: 'review-group-head' }, el('h3', { textContent: 'XMP' })),
      el('p', { className: 'review-unchanged', textContent: translated(() => (t('ui.anXMPPacketExistsButNoPropertiesWereListed'))) }),
    );
  }
  const changedIds = new Set((plan.operations || []).filter((op) => op.kind === 'field').map((op) => op.id));
  const rows = properties.map((prop) => {
    const qualified = String(prop.qualified || `${prop.prefix}:${prop.local}`).trim();
    const ownedField = XMP_OWNED_FIELD[qualified.toLowerCase()] || '';
    const changed = ownedField && changedIds.has(ownedField);
    const status = changed ? 'akan ditulis ulang' : ownedField ? 'dipakai field' : 'asing · dipertahankan';
    return el('tr', {},
      el('td', { className: 'review-xmp-tag', textContent: qualified }),
      el('td', { textContent: displayValue(prop.value) }),
      el('td', { className: `review-xmp-status ${changed ? 'is-changed' : ownedField ? '' : 'is-foreign'}`.trim(), textContent: translated(() => (status)) }),
    );
  });
  return el('section', { className: 'review-group' },
    el('div', { className: 'review-group-head' },
      el('h3', { textContent: translated(() => t('review.xmpReadOnly')) }),
      el('span', { className: 'review-count', textContent: translated(() => (String(properties.length))) }),
      el('p', { textContent: translated(() => (t('ui.xmpPropertyInventoryBeforeWritingForeignPropertiesArePreserved'))) }),
    ),
    el('table', { className: 'review-xmp-table' },
      el('thead', {}, el('tr', {},
        el('th', { textContent: translated(() => (t('ui.property'))) }),
        el('th', { textContent: translated(() => (t('ui.value'))) }),
        el('th', { textContent: 'Status' }),
      )),
      el('tbody', {}, ...rows),
    ),
  );
}
export function openReviewDialog({ plans = [], mode = 'single' } = {}) {
  if (typeof document === 'undefined') return Promise.resolve(false);
  closeReviewDialog(false);
  if (!plans.length) return Promise.resolve(false);
  const focusBefore = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const prevOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  const promise = new Promise((resolve) => { pendingResolve = resolve; });
  const cancelButton = el('button', {
    className: 'button ghost review-btn-cancel',
    type: 'button',
    textContent: translated(() => (mode === 'batch' ? t('ui.cancel') : t('ui.backToEditor'))),
  });
  const risks = uniqueRisks(plans);
  const danger = risks.some((risk) => risk.severity === 'danger');
  const confirmButton = el('button', {
    className: `button primary review-btn-confirm${danger ? ' is-danger' : ''}`,
    type: 'button',
    textContent: translated(() => (mode === 'batch'
      ? t(danger ? 'review.applyAnywayFiles' : 'review.applyFiles', { v0: plans.length })
      : danger ? t('ui.saveAnyway') : t('ui.saveDownload'))),
  });
  const title = mode === 'batch' ? 'Periksa batch sebelum menerapkan' : 'Periksa sebelum menyimpan';
  const subtitle = mode === 'batch'
    ? 'Pastikan seluruh perubahan di bawah ini sudah benar. Setelah dikonfirmasi, file akan diproses.'
    : 'Periksa seluruh perubahan. File asli tidak ditimpa; hasil dapat diunduh setelah verifikasi.';
  const body = el('div', { className: 'review-body' },
    summaryChips(plans),
    risksBlock(risks),
  );
  const mismatches = plans.filter((plan) => plan?.extensionMismatch?.found);
  let lowMemoryInput = null;
  let memoryOverrideInput = null;
  let extKeepInput = null;
  const memoryBlocked = plans.some((plan) => plan?.memory?.level === 'block');
  if (mode === 'batch') {
    lowMemoryInput = el('input', { type: 'checkbox', id: 'reviewLowMemory' });
    lowMemoryInput.checked = (plans || []).some((plan) => ['warn', 'block'].includes(plan?.memory?.level));
    body.append(
      el('label', { className: 'review-low-memory', for: 'reviewLowMemory' },
        lowMemoryInput,
        el('span', {},
          el('strong', { textContent: translated(() => (t('ui.lowMemoryMode'))) }),
          el('span', { textContent: translated(() => (t('ui.downloadEachResultImmediatelyAfterWritingInsteadOfRetaining'))) }),
        ),
      ),
    );
  }
  if (memoryBlocked && mode !== 'batch') {
    memoryOverrideInput = el('input', { type: 'checkbox', id: 'reviewMemoryOverride' });
    body.append(
      el('label', { className: 'review-low-memory', for: 'reviewMemoryOverride' },
        memoryOverrideInput,
        el('span', {},
          el('strong', { textContent: translated(() => t('ui.memoryBlockNotice')) }),
          el('span', { textContent: translated(() => t('ui.memoryOverride')) }),
        ),
      ),
    );
  }
  const updateMemoryGate = () => {
    const decision = canProceedWithMemory(plans[0]?.memory, {
      lowMemory: Boolean(lowMemoryInput?.checked),
      memoryOverride: Boolean(memoryOverrideInput?.checked),
    });
    confirmButton.disabled = !decision.allowed;
  };
  lowMemoryInput?.addEventListener('change', updateMemoryGate);
  memoryOverrideInput?.addEventListener('change', updateMemoryGate);
  updateMemoryGate();
  if (mismatches.length) {
    const first = mismatches[0];
    const recommended = first.extensionMismatch.recommendedName || first.outputName || '';
    const alternative = first.extensionMismatch.alternativeName || recommended;
    const followInput = el('input', { type: 'radio', name: 'review-ext-choice', value: 'follow', checked: true });
    extKeepInput = el('input', { type: 'radio', name: 'review-ext-choice', value: 'keep' });
    body.append(
      el('section', { className: 'review-ext-choice' },
        el('h3', { textContent: translated(() => (t('ui.extensionDoesNotMatchContents'))) }),
        el('p', { textContent: translated(() => (t('ui.filesHaveNamesExtensionsThatDifferFromTheirDetected', { v0: mismatches.length }))) }),
        el('label', { className: 'review-ext-radio' },
          followInput,
          el('span', {}, translated(() => (t('ui.followFileContentsSafe'))), el('code', { textContent: recommended }), translated(() => mismatches.length > 1 ? t('ui.andOthers', { v0: mismatches.length - 1 }) : '')),
        ),
        el('label', { className: 'review-ext-radio' },
          extKeepInput,
          el('span', {}, translated(() => (t('ui.keepOriginalExtension'))), el('code', { textContent: alternative }), translated(() => (t('ui.contentsStillFollowDetectionOnlyTheNameIsKept')))),
        ),
      ),
    );
  }
  if (mode === 'single') {
    body.append(planDetails(plans[0], { open: true }));
  } else {
    const visible = plans.slice(0, 40);
    const list = el('div', { className: 'review-files' }, ...visible.map((plan) => planDetails(plan)));
    body.append(list);
    if (plans.length > visible.length) {
      const remaining = plans.slice(visible.length);
      const load = el('button', { className: 'button ghost small review-load-more', type: 'button' },
        translated(() => (t('ui.loadAllFiles', { v0: plans.length }))));
      load.addEventListener('click', () => {
        list.append(...remaining.map((plan) => planDetails(plan)));
        load.remove();
      });
      body.append(load);
    }
  }
  const card = el('div', {
    className: 'review-card',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-labelledby': 'reviewTitle',
    'aria-describedby': 'reviewSubtitle',
  },
    el('div', { className: 'review-head' },
      el('div', { className: 'review-head-icon', 'aria-hidden': 'true' }, icon('check')),
      el('div', {},
        el('h2', { id: 'reviewTitle', className: 'review-title', textContent: translated(() => (title)) }),
        el('p', { id: 'reviewSubtitle', className: 'review-subtitle', textContent: translated(() => (subtitle)) }),
      ),
      el('button', { className: 'review-close', type: 'button', 'aria-label': translated(() => (t('ui.close'))), textContent: '×' }),
    ),
    body,
    el('div', { className: 'review-foot' },
      el('p', { className: 'review-foot-note', textContent: translated(() => (mode === 'batch' ? t('ui.filesWillBeRewrittenInTheBrowser', { v0: plans.length }) : t('ui.noUploadsAllProcessingIsLocal'))) }),
      el('div', { className: 'review-actions' }, cancelButton, confirmButton),
    ),
  );
  const backdrop = el('div', { className: 'review-backdrop' }, card);
  document.body.append(backdrop);
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
  const focusables = () => [...card.querySelectorAll('button:not(:disabled), [href], input:not(:disabled), summary')];
  const onKeydown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      finish({ confirmed: false, lowMemory: false, keepOriginalExt: null });
      return;
    }
    if (event.key !== 'Tab') return;
    const items = focusables();
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
  cancelButton.addEventListener('click', () => finish({ confirmed: false, lowMemory: false, keepOriginalExt: null }));
  card.querySelector('.review-close').addEventListener('click', () => finish({ confirmed: false, lowMemory: false, keepOriginalExt: null }));
  confirmButton.addEventListener('click', () => finish({
    confirmed: true,
    lowMemory: Boolean(lowMemoryInput?.checked),
    memoryOverride: Boolean(memoryOverrideInput?.checked),
    keepOriginalExt: extKeepInput ? Boolean(extKeepInput.checked) : null,
  }));
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) finish({ confirmed: false, lowMemory: false, keepOriginalExt: null });
  });
  current = backdrop;
  cancelButton.focus();
  return promise;
}
export function closeReviewDialog(value = false) {
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
export function isReviewOpen() {
  return Boolean(current);
}