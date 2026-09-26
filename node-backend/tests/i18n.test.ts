import cookieParser from 'cookie-parser';
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { localizationMiddleware, resolveLanguage } from '../src/i18n/index.js';

const createTestApp = () => {
  const app = express();
  app.use(cookieParser());
  app.use(localizationMiddleware);
  app.get('/approval', (_request, response) => {
    response.json({
      status: 'success',
      data: {
        title: 'Factory registration',
        documents: [{ name: 'Factory floor plan' }],
        applicantComment: 'Please inspect the west entrance.',
      },
    });
  });
  return app;
};

describe('backend localization', () => {
  it('negotiates supported Accept-Language values and ignores unsupported ones', () => {
    expect(resolveLanguage('mr-IN,mr;q=0.9,en;q=0.8')).toBe('mr');
    expect(resolveLanguage('fr-FR,hi;q=0.8')).toBe('hi');
    expect(resolveLanguage('fr-FR')).toBe('en');
  });

  it('uses the UI language cookie ahead of the browser header', async () => {
    const response = await request(createTestApp())
      .get('/approval')
      .set('Accept-Language', 'en')
      .set('Cookie', 'udyogsetu_language=mr');

    expect(response.headers['content-language']).toBe('mr');
    expect(response.headers.vary).toContain('Accept-Language');
    expect(response.headers.vary).toContain('Cookie');
    expect(response.body.data.title).toBe('कारखाना नोंदणी');
    expect(response.body.data.documents[0].name).toBe('कारखान्याचा मजला आराखडा');
    expect(response.body.data.applicantComment).toBe('Please inspect the west entrance.');
  });

  it('returns Hindi system text without changing API codes', async () => {
    const response = await request(createTestApp())
      .get('/approval')
      .set('Accept-Language', 'hi-IN');

    expect(response.headers['content-language']).toBe('hi');
    expect(response.body.status).toBe('success');
    expect(response.body.data.title).toBe('कारखाना पंजीकरण');
  });
});
