import type { ErrorRequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { z, ZodError } from 'zod';

import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { AppError } from '../errors/app-error.js';

const { JsonWebTokenError, NotBeforeError, TokenExpiredError } = jwt;

interface ErrorResponse {
  status: 'error';
  code: string;
  message: string;
  details?: unknown;
}

const isMalformedJsonError = (error: unknown): error is SyntaxError & { type: string } =>
  error instanceof SyntaxError && 'type' in error && error.type === 'entity.parse.failed';

const hasErrorType = (error: unknown, type: string): error is Error & { type: string } =>
  error instanceof Error && 'type' in error && error.type === type;

const getExposedHttpStatus = (error: unknown): number | undefined => {
  if (!(error instanceof Error) || !('expose' in error) || error.expose !== true) return undefined;

  const status =
    'statusCode' in error && typeof error.statusCode === 'number'
      ? error.statusCode
      : 'status' in error && typeof error.status === 'number'
        ? error.status
        : undefined;

  return status !== undefined && Number.isInteger(status) && status >= 400 && status <= 499
    ? status
    : undefined;
};

export const errorHandler: ErrorRequestHandler = (error, request, response, next) => {
  if (response.headersSent) {
    next(error);
    return;
  }

  let statusCode = 500;
  let body: ErrorResponse = {
    status: 'error',
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Internal server error',
  };

  const exposedStatus = getExposedHttpStatus(error);

  if (error instanceof AppError) {
    statusCode = error.statusCode;
    body = {
      status: 'error',
      code: error.code,
      message: error.message,
      ...(error.details === undefined ? {} : { details: error.details }),
    };
  } else if (error instanceof TokenExpiredError) {
    statusCode = 401;
    body = {
      status: 'error',
      code: 'JWT_EXPIRED',
      message: 'Authentication token has expired',
    };
  } else if (error instanceof NotBeforeError) {
    statusCode = 401;
    body = {
      status: 'error',
      code: 'JWT_NOT_ACTIVE',
      message: 'Authentication token is not active yet',
    };
  } else if (error instanceof JsonWebTokenError) {
    statusCode = 401;
    body = {
      status: 'error',
      code: 'JWT_INVALID',
      message: 'Authentication token is invalid',
    };
  } else if (error instanceof ZodError) {
    statusCode = 400;
    body = {
      status: 'error',
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      details: z.flattenError(error),
    };
  } else if (isMalformedJsonError(error)) {
    statusCode = 400;
    body = {
      status: 'error',
      code: 'INVALID_JSON',
      message: 'Request body contains invalid JSON',
    };
  } else if (hasErrorType(error, 'entity.too.large')) {
    statusCode = 413;
    body = {
      status: 'error',
      code: 'PAYLOAD_TOO_LARGE',
      message: 'Request body exceeds the allowed size',
    };
  } else if (exposedStatus !== undefined) {
    statusCode = exposedStatus;
    body = {
      status: 'error',
      code: 'HTTP_ERROR',
      message: error instanceof Error ? error.message : 'Request failed',
    };
  } else if (env.NODE_ENV === 'development' && error instanceof Error) {
    body.details = error.message;
  }

  const logContext = {
    err: error,
    method: request.method,
    path: request.originalUrl,
    requestId: request.id,
    statusCode,
  };

  if (statusCode >= 500) {
    logger.error(logContext, 'Request failed unexpectedly');
  } else {
    logger.warn(logContext, 'Request rejected');
  }

  response.status(statusCode).json(body);
};
