/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import { t, translated } from '../i18n/index.js';
import { el, qs } from './dom.js';

export const POLICY_ACK_KEY = 'meinsert.policyAck';
export const POLICY_ACK_DAYS = 30;
const DAY_MS = 86400000;

/** Resolve localStorage without letting a sandboxed/blocked store throw. */
function getStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/**
 * True when the stored acknowledgement timestamp is still within the window.
 * Missing, corrupt and non-integer values count as not acknowledged; future
 * timestamps count as acknowledged to tolerate clock skew.
 */
export function isAcknowledged(storage, now = Date.now()) {
  try {
    const raw = storage?.getItem(POLICY_ACK_KEY);
    if (raw === null || raw === undefined) return false;
    const value = String(raw).trim();
    if (!/^-?\d+$/.test(value)) return false;
    const ack = Number(value);
    if (!Number.isFinite(ack)) return false;
    return now - ack < POLICY_ACK_DAYS * DAY_MS;
  } catch {
    return false;
  }
}

/** Persist the acknowledgement time. Never throws; reports success via boolean. */
export function acknowledge(storage, now = Date.now()) {
  try {
    if (!storage) return false;
    storage.setItem(POLICY_ACK_KEY, String(now));
    return true;
  } catch {
    return false;
  }
}

let initialized = false;

/** Mount the non-modal policy notice once on editor pages that opt in. */
export function initPolicyNotice() {
  if (initialized || typeof document === 'undefined' || !document.body) return;
  initialized = true;
  if (qs('.policy-notice')) return;
  const storage = getStorage();
  if (isAcknowledged(storage)) return;

  const dismiss = () => {
    acknowledge(storage);
    card.remove();
  };

  const title = el('h2', {
    className: 'policy-notice__title',
    textContent: translated(() => t('ui.policyNoticeTitle')),
  });
  const body = el('p', { className: 'policy-notice__body' },
    translated(() => t('ui.policyNoticeBody')),
    ' ',
    el('a', { href: './privacy.html', textContent: translated(() => t('ui.privacy')) }),
    ' · ',
    el('a', { href: './Terms.html', textContent: translated(() => t('ui.termsOfUse')) }),
  );
  const ackButton = el('button', {
    type: 'button',
    className: 'policy-notice__ack',
    textContent: translated(() => t('ui.policyNoticeAck')),
    on: { click: dismiss },
  });
  const actions = el('div', { className: 'policy-notice__actions' }, ackButton);

  const card = el('aside', {
    className: 'policy-notice',
    role: 'region',
    'aria-label': translated(() => t('ui.policyNoticeTitle')),
  }, title, body, actions);
  document.body.append(card);

  globalThis.addEventListener?.('storage', (event) => {
    if (event.key !== POLICY_ACK_KEY) return;
    if (!isAcknowledged({ getItem: () => event.newValue })) return;
    qs('.policy-notice')?.remove();
  });
}
