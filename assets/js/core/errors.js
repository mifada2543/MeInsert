/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
export class AppError extends Error {
  constructor(code, message, detail = '') {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.detail = detail;
  }
}

export function unsupported(message, detail = '') {
  return new AppError('UNSUPPORTED', message, detail);
}

export function processingError(message, detail = '') {
  return new AppError('PROCESSING_FAILED', message, detail);
}

export function serializeError(error) {
  if (error instanceof AppError) {
    return { code: error.code, message: error.message, detail: error.detail };
  }
  return {
    code: error?.code || 'PROCESSING_FAILED',
    message: error?.message || String(error),
    detail: error?.stack ? String(error.stack).split('\n').slice(0, 5).join('\n') : '',
  };
}
