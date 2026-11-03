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
