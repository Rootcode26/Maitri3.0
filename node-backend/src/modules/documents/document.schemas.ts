import { z } from 'zod';

const keySchema = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .regex(/^[a-z0-9-]+$/, 'Key may only contain lowercase letters, digits and hyphens.');

export const uploadDocumentSchema = z.object({
  approvalKey: keySchema(60),
  documentKey: keySchema(100),
});

export type UploadDocumentInput = z.infer<typeof uploadDocumentSchema>;

export const projectIdParamSchema = z.uuid('A valid project id is required.');
export const documentIdParamSchema = z.uuid('A valid document id is required.');
