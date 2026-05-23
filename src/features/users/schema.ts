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

// AUTH-10: strengthen the new-account password floor. At least 12
// characters, with three of four character classes (lower / upper /
// digit / special). The dev seed accounts still bypass this because
// they're created via prisma.upsert, not this schema.
export const PasswordSchema = z
  .string()
  .min(12, 'At least 12 characters')
  .refine((p) => {
    let classes = 0;
    if (/[a-z]/.test(p)) classes += 1;
    if (/[A-Z]/.test(p)) classes += 1;
    if (/[0-9]/.test(p)) classes += 1;
    if (/[^A-Za-z0-9]/.test(p)) classes += 1;
    return classes >= 3;
  }, 'Use a mix of letters, numbers, and symbols');

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
});

export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
