import { Pill } from '@/components/ui/Pill';
import type { AnimalStatus } from '@prisma/client';

const STATUS_LABELS: Record<AnimalStatus, string> = {
  CRITICAL: 'Critical',
  STABLE: 'Stable',
  OBSERVATION: 'Observation',
  DISCHARGED: 'Discharged',
  DECEASED: 'Deceased',
};

const STATUS_TONE: Record<AnimalStatus, 'critical' | 'stable' | 'observation' | 'neutral'> = {
  CRITICAL: 'critical',
  STABLE: 'stable',
  OBSERVATION: 'observation',
  DISCHARGED: 'neutral',
  DECEASED: 'neutral',
};

interface Props {
  status: AnimalStatus;
}

export function StatusBadge({ status }: Props) {
  return <Pill status={STATUS_TONE[status]}>{STATUS_LABELS[status]}</Pill>;
}
