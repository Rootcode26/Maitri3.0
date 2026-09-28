import { z } from 'zod';

import { userRoles } from './auth.types.js';
import { industries } from './auth.constants.js';

const indianPhoneNumberSchema = z
  .string()
  .trim()
  .regex(/^\+91[6-9][0-9]{9}$/, 'Phone number must be a valid Indian E.164 number');

const passwordSchema = z
  .string()
  .min(8, 'Password must contain at least 8 characters')
  .max(128, 'Password must contain at most 128 characters');

const registrationBase = {
  name: z.string().trim().min(1).max(150),
  phoneNumber: indianPhoneNumberSchema,
  password: passwordSchema,
};

// Only applicants self-register. Inspector accounts are provisioned from the
// ministry-provided list (see scripts/seed-inspectors.ts) and cannot be created
// through this endpoint.
export const registerSchema = z
  .object({ ...registrationBase, role: z.literal('applicant'), industry: z.enum(industries) })
  .strict();

export const loginSchema = z.object({
  phoneNumber: indianPhoneNumberSchema,
  password: z.string().min(1).max(128),
  rememberMe: z.boolean().default(false),
  expectedRole: z.enum(userRoles).optional(),
});

export const verifyOtpSchema = z.object({
  phoneNumber: indianPhoneNumberSchema,
  otp: z.string().regex(/^\d{6}$/, 'OTP must contain exactly 6 digits'),
});

export const resendOtpSchema = z.object({
  phoneNumber: indianPhoneNumberSchema,
});

export const forgotPasswordSchema = z.object({
  phoneNumber: indianPhoneNumberSchema,
});

export const resetPasswordSchema = z.object({
  phoneNumber: indianPhoneNumberSchema,
  otp: z.string().regex(/^\d{6}$/, 'OTP must contain exactly 6 digits'),
  newPassword: passwordSchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
