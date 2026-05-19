import { PatientList } from '@/features/animals/components/PatientList';
import type { AnimalStatus } from '@prisma/client';

const STATUS_SET = new Set<AnimalStatus>(['CRITICAL', 'STABLE', 'OBSERVATION']);

function asStatus(v: string | undefined): AnimalStatus | undefined {
  if (!v) return undefined;
  return STATUS_SET.has(v as AnimalStatus) ? (v as AnimalStatus) : undefined;
}

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; species?: string }>;
}) {
  const params = await searchParams;
  return (
    <PatientList
      search={params.q || undefined}
      status={asStatus(params.status)}
      species={params.species || undefined}
    />
  );
}
