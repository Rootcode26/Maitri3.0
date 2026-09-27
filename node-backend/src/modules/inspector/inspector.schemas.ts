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
  q: z.string().trim().min(1).max(120).optional(),
  mine: z.stringbool().optional(),
  unassigned: z.stringbool().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export const assignApprovalSchema = z.object({
  assigneeId: z.uuid().nullable(),
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

export const inspectionParamsSchema = z.object({ inspectionId: z.uuid() });

export const scheduleInspectionSchema = z.object({
  projectId: z.uuid(),
  approvalId: z.uuid(),
  scheduledAt: z.iso.datetime({ offset: true }),
  notes: z.string().trim().max(2_000).optional(),
});

export const updateInspectionSchema = z
  .object({
    status: z.enum(['scheduled', 'completed', 'cancelled']).optional(),
    outcome: z.enum(['satisfactory', 'needs_follow_up', 'failed']).nullable().optional(),
    scheduledAt: z.iso.datetime({ offset: true }).optional(),
    notes: z.string().trim().max(2_000).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one field to update',
  })
  .superRefine((value, ctx) => {
    if (value.outcome && value.status && value.status !== 'completed') {
      ctx.addIssue({
        code: 'custom',
        path: ['outcome'],
        message: 'An outcome can only be recorded when the inspection is completed',
      });
    }
  });

export type InspectorQueueQuery = z.infer<typeof inspectorQueueQuerySchema>;
export type ApprovalDecisionInput = z.infer<typeof approvalDecisionSchema>;
export type DocumentReviewInput = z.infer<typeof documentReviewSchema>;
export type CreateClarificationInput = z.infer<typeof createClarificationSchema>;
export type ScheduleInspectionInput = z.infer<typeof scheduleInspectionSchema>;
export type UpdateInspectionInput = z.infer<typeof updateInspectionSchema>;
export type AssignApprovalInput = z.infer<typeof assignApprovalSchema>;
