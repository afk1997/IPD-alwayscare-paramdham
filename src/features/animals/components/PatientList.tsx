import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import type { AnimalStatus } from '@prisma/client';
import { PawPrint } from 'lucide-react';
import Link from 'next/link';
import { listAnimals } from '../queries';
import { PatientCard } from './PatientCard';
import { PatientListFilters } from './PatientListFilters';

interface Props {
  search?: string | undefined;
  status?: AnimalStatus | undefined;
  species?: string | undefined;
}

export async function PatientList({ search, status, species }: Props = {}) {
  const animals = await listAnimals({
    take: 200,
    ...(search ? { search } : {}),
    ...(status ? { status } : {}),
    ...(species ? { species } : {}),
  });
  const hasFilters = Boolean(search || status || species);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl tracking-tight">Patients</h1>
          <p className="mt-1 text-muted text-sm">
            {animals.length} {animals.length === 1 ? 'animal' : 'animals'}
            {hasFilters ? ' matching filters' : ' currently admitted'}
          </p>
        </div>
        <Link href="/patients/new">
          <Button>Admit new</Button>
        </Link>
      </div>

      <PatientListFilters
        initialSearch={search ?? ''}
        initialStatus={status ?? 'ALL'}
        initialSpecies={species ?? ''}
      />

      {animals.length === 0 ? (
        hasFilters ? (
          <p className="px-1 py-2 text-muted text-sm">No animals match these filters.</p>
        ) : (
          <EmptyState
            icon={PawPrint}
            title="No patients yet"
            description="Start with your first admission to see the list populate."
            action={
              <Link href="/patients/new">
                <Button>Admit new patient</Button>
              </Link>
            }
          />
        )
      ) : (
        <div className="flex flex-col gap-2">
          {animals.map((a) => (
            <PatientCard key={a.id} animal={a} />
          ))}
        </div>
      )}
    </div>
  );
}
