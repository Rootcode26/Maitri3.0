import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { AppError } from '../src/errors/app-error.js';
import { errorHandler } from '../src/middleware/error-handler.js';

const createTestApp = () => {
  const app = express();

  app.use(express.json({ limit: '32b' }));
  app.get('/app-error', () => {
    throw new AppError('Resource not found', {
      statusCode: 404,
      code: 'RESOURCE_NOT_FOUND',
      details: { resource: 'demo' },
    });
  });
  app.get('/validation-error', () => {
    z.object({ id: z.uuid() }).parse({ id: 'invalid' });
  });
  app.get('/unexpected-error', () => {
    throw new Error('Sensitive internal details');
  });
  app.get('/primitive-error', () => {
    throw 'non-error failure';
  });
  app.get('/exposed-http-error', () => {
    const error = Object.assign(new Error('Unsupported media type'), {
      status: 415,
      expose: true,
    });
    throw error;
  });
  app.post('/json', (_request, response) => {
    response.status(204).send();
  });
  app.use(errorHandler);

  return app;
};

describe('error handler', () => {
  it('returns the status and safe metadata from an AppError', async () => {
    const response = await request(createTestApp()).get('/app-error');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      status: 'error',
      code: 'RESOURCE_NOT_FOUND',
      message: 'Resource not found',
      details: { resource: 'demo' },
    });
  });

  it('formats Zod errors as bad-request responses', async () => {
    const response = await request(createTestApp()).get('/validation-error');

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      status: 'error',
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      details: {
        fieldErrors: {
          id: expect.any(Array),
        },
      },
    });
  });

  it('returns a useful response for malformed JSON', async () => {
    const response = await request(createTestApp())
      .post('/json')
      .set('Content-Type', 'application/json')
      .send('{"broken":');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      status: 'error',
      code: 'INVALID_JSON',
      message: 'Request body contains invalid JSON',
    });
  });

  it('does not expose unexpected error details outside development', async () => {
    const response = await request(createTestApp()).get('/unexpected-error');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      status: 'error',
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Internal server error',
    });
  });

  it('handles thrown non-Error values safely', async () => {
    const response = await request(createTestApp()).get('/primitive-error');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      status: 'error',
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Internal server error',
    });
  });

  it('preserves safe messages from explicitly exposed 4xx HTTP errors', async () => {
    const response = await request(createTestApp()).get('/exposed-http-error');

    expect(response.status).toBe(415);
    expect(response.body).toEqual({
      status: 'error',
      code: 'HTTP_ERROR',
      message: 'Unsupported media type',
    });
  });

  it('returns 413 without echoing an oversized body', async () => {
    const response = await request(createTestApp())
      .post('/json')
      .set('Content-Type', 'application/json')
      .send({ content: 'a'.repeat(100) });

    expect(response.status).toBe(413);
    expect(response.body).toEqual({
      status: 'error',
      code: 'PAYLOAD_TOO_LARGE',
      message: 'Request body exceeds the allowed size',
    });
  });
});
