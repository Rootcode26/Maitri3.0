import { z } from 'zod';

export const verificationParamsSchema = z.object({
  verificationCode: z
    .string()
    .trim()
    .regex(/^[a-f0-9]{24}$/, 'Invalid verification code'),
});

export const revokeCertificateSchema = z.object({
  reason: z.string().trim().min(10).max(2_000),
});

export type RevokeCertificateInput = z.infer<typeof revokeCertificateSchema>;
