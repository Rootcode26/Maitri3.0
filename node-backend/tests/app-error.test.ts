import { describe, expect, it } from 'vitest';

import { AppError } from '../src/errors/app-error.js';

describe('AppError', () => {
  it('uses safe defaults for an internal error', () => {
    const error = new AppError('Something failed');

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('AppError');
    expect(error.statusCode).toBe(500);
    expect(error.code).toBe('INTERNAL_SERVER_ERROR');
    expect(error.isOperational).toBe(true);
  });

  it('stores API error metadata and the original cause', () => {
    const cause = new Error('Original failure');
    const details = { field: 'email' };
    const error = new AppError('Email is required', {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      details,
      cause,
    });

    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.details).toEqual(details);
    expect(error.cause).toBe(cause);
  });

  it.each([399, 600, 400.5])('rejects invalid HTTP status code %s', (statusCode) => {
    expect(() => new AppError('Invalid', { statusCode })).toThrow(RangeError);
  });

  it.each(['lower_case', 'HAS-DASH', '1_INVALID'])('rejects invalid error code %s', (code) => {
    expect(() => new AppError('Invalid', { code })).toThrow(TypeError);
  });
});
