interface AppErrorOptions {
  statusCode?: number;
  code?: string;
  details?: unknown;
  cause?: unknown;
}

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details: unknown;
  readonly isOperational = true;

  constructor(
    message: string,
    { statusCode = 500, code = 'INTERNAL_SERVER_ERROR', details, cause }: AppErrorOptions = {},
  ) {
    if (!Number.isInteger(statusCode) || statusCode < 400 || statusCode > 599) {
      throw new RangeError('AppError statusCode must be an integer between 400 and 599');
    }

    if (!/^[A-Z][A-Z0-9_]*$/.test(code)) {
      throw new TypeError('AppError code must use uppercase snake case');
    }

    super(message, { cause });
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;

    Error.captureStackTrace(this, AppError);
  }
}
