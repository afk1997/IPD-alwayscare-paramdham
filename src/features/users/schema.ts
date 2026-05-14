import { z } from 'zod';

export const ROLES = ['STAFF', 'DOCTOR', 'ADMIN'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  STAFF: 'Floor staff',
  DOCTOR: 'Doctor',
  ADMIN: 'Admin',
};

export const InviteUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(120),
  role: z.enum(ROLES),
  temporaryPassword: z.string().min(8, 'At least 8 characters'),
});

export type InviteUserInput = z.infer<typeof InviteUserSchema>;

export const UpdateUserSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(120).optional(),
  role: z.enum(ROLES).optional(),
  active: z.boolean().optional(),
});

export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
