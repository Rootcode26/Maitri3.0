import { describe, expect, it } from 'vitest';

import {
  approvalDecisionSchema,
  createClarificationSchema,
  documentReviewSchema,
  inspectorQueueQuerySchema,
} from '../src/modules/inspector/inspector.schemas.js';

describe('inspector schemas', () => {
  it('applies safe pagination defaults and caps the page size', () => {
    expect(inspectorQueueQuerySchema.parse({})).toMatchObject({ page: 1, pageSize: 20 });
    expect(inspectorQueueQuerySchema.safeParse({ pageSize: 101 }).success).toBe(false);
  });

  it('requires reasons for correction and rejection decisions', () => {
    expect(approvalDecisionSchema.safeParse({ decision: 'approved' }).success).toBe(true);
    expect(approvalDecisionSchema.safeParse({ decision: 'rejected' }).success).toBe(false);
    expect(
      approvalDecisionSchema.safeParse({ decision: 'rejected', note: 'Required file is invalid' })
        .success,
    ).toBe(true);
  });

  it('requires a comment when a document needs correction or rejection', () => {
    expect(documentReviewSchema.safeParse({ status: 'accepted' }).success).toBe(true);
    expect(documentReviewSchema.safeParse({ status: 'correction_required' }).success).toBe(false);
    expect(
      documentReviewSchema.safeParse({ status: 'correction_required', comment: 'Upload all pages' })
        .success,
    ).toBe(true);
  });

  it('validates clarification messages and optional deadlines', () => {
    expect(createClarificationSchema.safeParse({ message: 'Too short' }).success).toBe(false);
    expect(
      createClarificationSchema.safeParse({
        message: 'Please confirm the installed furnace capacity.',
        dueAt: 'not-a-date',
      }).success,
    ).toBe(false);
    expect(
      createClarificationSchema.safeParse({
        message: 'Please confirm the installed furnace capacity.',
        dueAt: '2026-10-01T18:29:59.000Z',
      }).success,
    ).toBe(true);
  });
});
