/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import { el } from './dom.js';
import { icon } from './icons.js';
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
      el('strong', { textContent: label }),
      operation.native ? el('span', { className: 'review-native', textContent: operation.native }) : null,
    ),
    el('div', { className: 'review-operation-value' },
      el('span', { className: `review-before${operation.action === 'remove' ? ' is-removed' : ''}`, textContent: before }),
      arrow,
      el('span', { className: `review-after${operation.action === 'remove' ? ' is-removed' : ''}`, textContent: after }),
    ),
  );
}
function operationGroup(title, operations, description = '') {
  if (!operations.length) return null;
  return el('section', { className: 'review-group' },
    el('div', { className: 'review-group-head' },
      el('h3', { textContent: title }),
      el('span', { className: 'review-count', textContent: String(operations.length) }),
      description ? el('p', { textContent: description }) : null,
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
      el('span', { textContent: risk.message }),
    ));
  }
  return el('section', { className: 'review-group' },
    el('div', { className: 'review-group-head' }, el('h3', { textContent: 'Peringatan' })),
    list,
  );
}
function planDetails(plan, { open = false } = {}) {
  const operations = plan.operations || [];
  const fields = operations.filter((operation) => operation.kind === 'field');
  const custom = operations.filter((operation) => operation.kind === 'custom');
  const raw = operations.filter((operation) => operation.kind === 'raw');
  const cover = operations.filter((operation) => operation.kind === 'cover');
  const unchanged = plan.unchanged || {};
  const details = el('details', { className: 'review-file', open });
  const fileLabel = plan.fileName || plan.outputName || plan.format?.label || 'File';
  const summary = el('summary', { className: 'review-file-summary' },
    el('span', { className: 'review-file-name', textContent: fileLabel }),
    el('span', { className: 'review-file-format', textContent: plan.format?.label || plan.format?.id || '' }),
    el('span', { className: 'review-file-count', textContent: `${operations.length} perubahan` }),
  );
  const body = el('div', { className: 'review-file-body' },
    plan.outputName && plan.outputName !== fileLabel
      ? el('p', { className: 'review-output', textContent: `Nama hasil: ${plan.outputName}` })
      : null,
    operationGroup('Field', fields),
    operationGroup('Tag kustom', custom),
    operationGroup('Hapus tag mentah', raw),
    operationGroup('Sampul', cover),
    el('p', { className: 'review-unchanged' },
      `${unchanged.fields || 0} field, ${unchanged.custom || 0} tag kustom, dan ${unchanged.raw || 0} tag mentah tetap tidak berubah.`,
    ),
  );
  details.append(summary, body);
  return details;
}
function summaryChips(plans) {
  const operations = plans.reduce((sum, plan) => sum + (plan.operations?.length || 0), 0);
  const unchanged = plans.reduce((sum, plan) => sum + (plan.unchanged?.fields || 0) + (plan.unchanged?.custom || 0) + (plan.unchanged?.raw || 0), 0);
  return el('div', { className: 'review-summary' },
    el('span', { className: 'review-chip is-strong' }, `${operations} perubahan`),
    el('span', { className: 'review-chip' }, `${plans.length} file`),
    el('span', { className: 'review-chip' }, `${unchanged} metadata tetap`),
  );
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
    textContent: mode === 'batch' ? 'Batal' : 'Kembali ke editor',
  });
  const risks = uniqueRisks(plans);
  const danger = risks.some((risk) => risk.severity === 'danger');
  const confirmButton = el('button', {
    className: `button primary review-btn-confirm${danger ? ' is-danger' : ''}`,
    type: 'button',
    textContent: mode === 'batch'
      ? `${danger ? 'Tetap terapkan' : 'Terapkan'} ke ${plans.length} file`
      : danger ? 'Tetap simpan' : 'Simpan metadata',
  });
  const title = mode === 'batch' ? 'Periksa batch sebelum menerapkan' : 'Periksa sebelum menyimpan';
  const subtitle = mode === 'batch'
    ? 'Pastikan seluruh perubahan di bawah ini sudah benar. Setelah dikonfirmasi, file akan diproses.'
    : 'Periksa seluruh perubahan. File asli tidak ditimpa; hasil dapat diunduh setelah verifikasi.';

  const body = el('div', { className: 'review-body' },
    summaryChips(plans),
    risksBlock(risks),
  );
  if (mode === 'single') {
    body.append(planDetails(plans[0], { open: true }));
  } else {
    const visible = plans.slice(0, 40);
    const list = el('div', { className: 'review-files' }, ...visible.map((plan) => planDetails(plan)));
    body.append(list);
    if (plans.length > visible.length) {
      const remaining = plans.slice(visible.length);
      const load = el('button', { className: 'button ghost small review-load-more', type: 'button' },
        `Muat semua ${plans.length} file`);
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
        el('h2', { id: 'reviewTitle', className: 'review-title', textContent: title }),
        el('p', { id: 'reviewSubtitle', className: 'review-subtitle', textContent: subtitle }),
      ),
      el('button', { className: 'review-close', type: 'button', 'aria-label': 'Tutup', textContent: '×' }),
    ),
    body,
    el('div', { className: 'review-foot' },
      el('p', { className: 'review-foot-note', textContent: mode === 'batch' ? `${plans.length} file akan ditulis ulang di browser.` : 'Tidak ada upload; semua proses lokal.' }),
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
      finish(false);
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
  cancelButton.addEventListener('click', () => finish(false));
  card.querySelector('.review-close').addEventListener('click', () => finish(false));
  confirmButton.addEventListener('click', () => finish(true));
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) finish(false);
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
