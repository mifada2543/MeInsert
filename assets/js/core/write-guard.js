/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
/* MeInsert — safety gate for suspicious metadata writes. */
import { t } from '../i18n/index.js';
export function preserveFailedWrite(state, result) {
  if (result?.integrity?.status !== 'failed') return false;
  state.result = result;
  return true;
}
export function isCommittedResult(result) {
  return Boolean(result) && result.integrity?.status !== 'failed';
}
export function allowResultDownload(result, confirmDownload) {
  if (!result?.blob) return false;
  if (result.integrity?.status !== 'failed') return true;
  return confirmDownload(t('ui.failedIntegrityDownloadConfirm')) === true;
}
