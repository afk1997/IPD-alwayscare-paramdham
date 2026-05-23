import { z } from 'zod';

export const ROLES = ['STAFF', 'DOCTOR', 'ADMIN', 'SUPER_ADMIN', 'VIEWER'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  STAFF: 'Floor staff',
  DOCTOR: 'Doctor',
  ADMIN: 'Admin',
  SUPER_ADMIN: 'Super admin',
  VIEWER: 'Viewer',
};

// Lightweight floor — clinic staff hand each other temporary passwords;
// the strict 12-char/3-class rule got in the way for everyday invites.
// Keep a small minimum so we don't accept empty/one-char strings, and
// otherwise trust the operator's judgement.
export const PasswordSchema = z.string().min(6, 'At least 6 characters');

export const InviteUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(120),
  role: z.enum(ROLES),
  temporaryPassword: PasswordSchema,
});

export type InviteUserInput = z.infer<typeof InviteUserSchema>;

export const UpdateUserSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(120).optional(),
  role: z.enum(ROLES).optional(),
  active: z.boolean().optional(),
  // Optional: when present, hash and update the user's password.
  // Empty string is treated as "no change" so the EditUserForm can
  // submit a blank field without resetting the password.
  password: z.union([PasswordSchema, z.literal('')]).optional(),
});

export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
