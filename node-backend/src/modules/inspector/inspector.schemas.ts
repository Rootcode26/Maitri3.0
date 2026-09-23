import { z } from 'zod';

export const projectIdParamsSchema = z.object({ projectId: z.uuid() });
export const approvalParamsSchema = z.object({ projectId: z.uuid(), approvalId: z.uuid() });
export const documentParamsSchema = z.object({ projectId: z.uuid(), documentId: z.uuid() });
export const clarificationParamsSchema = z.object({
  projectId: z.uuid(),
  clarificationId: z.uuid(),
});

export const inspectorQueueQuerySchema = z.object({
  status: z
    .enum(['pending', 'under_review', 'correction_required', 'approved', 'rejected'])
    .optional(),
  industry: z.enum(['food', 'textile', 'steel']).optional(),
  district: z.string().trim().min(1).max(80).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export const approvalDecisionSchema = z
  .object({
    decision: z.enum(['approved', 'correction_required', 'rejected']),
    note: z.string().trim().max(2_000).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.decision !== 'approved' && !value.note) {
      ctx.addIssue({
        code: 'custom',
        path: ['note'],
        message: 'A reason is required for correction or rejection',
      });
    }
  });

export const documentReviewSchema = z
  .object({
    status: z.enum(['accepted', 'correction_required', 'rejected']),
    comment: z.string().trim().max(2_000).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.status !== 'accepted' && !value.comment) {
      ctx.addIssue({
        code: 'custom',
        path: ['comment'],
        message: 'A comment is required for correction or rejection',
      });
    }
  });

export const createClarificationSchema = z.object({
  message: z.string().trim().min(10).max(2_000),
  documentId: z.uuid().optional(),
  dueAt: z.iso.datetime({ offset: true }).optional(),
});

export type InspectorQueueQuery = z.infer<typeof inspectorQueueQuerySchema>;
export type ApprovalDecisionInput = z.infer<typeof approvalDecisionSchema>;
export type DocumentReviewInput = z.infer<typeof documentReviewSchema>;
export type CreateClarificationInput = z.infer<typeof createClarificationSchema>;
