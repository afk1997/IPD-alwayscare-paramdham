import type { Role as PrismaRole } from '@prisma/client';
import { ROLE_LABELS, type Role } from '../schema';

const TONES: Record<Role, string> = {
  STAFF: 'bg-paper-2 text-muted',
  DOCTOR: 'bg-accent-soft text-accent-ink',
  ADMIN: 'bg-observation-bg text-observation',
  SUPER_ADMIN: 'bg-critical-bg text-critical',
  VIEWER: 'bg-paper-2 text-soft',
};

interface Props {
  role: PrismaRole;
}

export function RoleBadge({ role }: Props) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${TONES[role as Role]}`}
    >
      {ROLE_LABELS[role as Role]}
    </span>
  );
}
