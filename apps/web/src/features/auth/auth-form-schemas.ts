import { z } from "zod";

const indianMobile = /^[6-9]\d{9}$/;
const personName = /^[\p{L}][\p{L}\p{M} .'-]*$/u;
export const industrySchema = z.enum(["food", "textile", "steel"]);

export const phoneSchema = z
  .string()
  .trim()
  .min(1, "Enter your mobile number.")
  .regex(indianMobile, "Enter a valid 10-digit Indian mobile number.");

export const passwordSchema = z
  .string()
  .min(8, "Password must contain at least 8 characters.")
  .max(128, "Password must contain at most 128 characters.");

export const otpSchema = z
  .string()
  .min(1, "Enter the verification code.")
  .regex(/^\d{6}$/, "Enter the complete 6-digit verification code.");

export const loginFormSchema = z.object({
  phone: phoneSchema,
  password: z.string().min(1, "Enter your password.").max(128, "Password is too long."),
  rememberMe: z.boolean(),
});

const registerBaseSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Enter your full name.")
    .max(150, "Name must contain at most 150 characters.")
    .regex(personName, "Name can contain letters, spaces, apostrophes, hyphens and full stops only."),
  phone: phoneSchema,
  password: passwordSchema,
  department: z.string(),
  industry: industrySchema,
});
export const applicantRegisterFormSchema = registerBaseSchema;
export const inspectorRegisterFormSchema = registerBaseSchema.extend({ department: z.string().min(1, "Select your department.") });

export const forgotPasswordFormSchema = z.object({ phone: phoneSchema });
export const otpFormSchema = z.object({ otp: otpSchema });
export const resetPasswordFormSchema = z.object({ otp: otpSchema, newPassword: passwordSchema });

export type LoginFormValues = z.infer<typeof loginFormSchema>;
export type RegisterFormValues = z.infer<typeof registerBaseSchema>;
export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordFormSchema>;
export type OtpFormValues = z.infer<typeof otpFormSchema>;
export type ResetPasswordFormValues = z.infer<typeof resetPasswordFormSchema>;
