import { z } from 'zod';
import type { Role } from './enums';

export const OTP_PURPOSES = ['SIGNUP', 'PASSWORD_RESET'] as const;
export type OtpPurpose = (typeof OTP_PURPOSES)[number];

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, 'Email is too long')
  .email('Enter a valid email address');

/**
 * 8–72 characters (bcrypt ignores anything after 72 bytes) with at least one letter and one digit.
 */
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters')
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/\d/, 'Password must contain a number');

export const otpCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, 'Enter the 6-digit code');

const name = (label: string) =>
  z.string().trim().min(1, `${label} is required`).max(50, `${label} is too long`);

export const profileFieldsSchema = z.object({
  firstName: name('First name'),
  lastName: name('Last name'),
  year: z.coerce.number().int().min(1, 'Select your year').max(6, 'Select your year'),
  school: z.string().trim().min(1, 'Select your school').max(100),
  enrollmentNumber: z
    .string()
    .trim()
    .min(3, 'Enter your enrollment number')
    .max(30, 'Enrollment number is too long')
    .regex(/^[A-Za-z0-9/-]+$/, 'Use only letters, digits, / and -'),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ()-]{7,20}$/, 'Enter a valid phone number')
    .nullable()
    .optional(),
});

export const requestOtpSchema = z
  .object({ email: emailSchema, purpose: z.enum(OTP_PURPOSES) })
  .strict();

export const verifyOtpSchema = z
  .object({ email: emailSchema, purpose: z.enum(OTP_PURPOSES), code: otpCodeSchema })
  .strict();

export const registerSchema = profileFieldsSchema
  .extend({ verificationToken: z.string().min(1), password: passwordSchema })
  .strict();

export const loginSchema = z
  .object({ email: emailSchema, password: z.string().min(1, 'Enter your password').max(200) })
  .strict();

export const resetPasswordSchema = z
  .object({ verificationToken: z.string().min(1), newPassword: passwordSchema })
  .strict();

export const updateProfileSchema = profileFieldsSchema
  .partial()
  .strict()
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'Provide at least one field to update',
  });

export type RequestOtpInput = z.infer<typeof requestOtpSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

/** The signed-in user's own profile. */
export interface MeDto {
  id: string;
  email: string;
  role: Role;
  universityId: string;
  firstName: string;
  lastName: string;
  year: number;
  school: string;
  enrollmentNumber: string;
  phone: string | null;
  avatarUrl: string | null;
  createdAt: string;
  /** A shared sample account (one-click demo sign-in); its profile can't be changed. */
  isDemo: boolean;
}

export interface AuthResponse {
  accessToken: string;
  /** Seconds until the access token expires; refresh before then. */
  expiresIn: number;
  user: MeDto;
}

export interface VerifyOtpResponse {
  verificationToken: string;
  expiresIn: number;
  /** For sign-up: the university the email belongs to, with the schools to choose from. */
  university?: { id: string; name: string; schools: string[] };
}

export interface MessageResponse {
  message: string;
}

export interface UniversityDto {
  id: string;
  name: string;
  schools: string[];
}
