import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { PawPrint } from 'lucide-react';
import Link from 'next/link';
import { listAnimals } from '../queries';
import { PatientCard } from './PatientCard';

export async function PatientList() {
  const animals = await listAnimals();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Patients</h1>
          <p className="mt-1 text-sm text-muted">
            {animals.length} {animals.length === 1 ? 'animal' : 'animals'} currently admitted
          </p>
        </div>
        <Link href="/patients/new">
          <Button>Admit new</Button>
        </Link>
      </div>

      {animals.length === 0 ? (
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
