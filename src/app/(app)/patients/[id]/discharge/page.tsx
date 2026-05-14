import { DischargeForm } from '@/features/animals/lifecycle/components/DischargeForm';
import { getAnimal } from '@/features/animals/queries';
import { notFound } from 'next/navigation';

export default async function DischargePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const animal = await getAnimal(id);
  if (!animal) notFound();
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-2xl font-bold tracking-tight">Discharge {animal.name}</h1>
      <DischargeForm animalId={id} />
    </div>
  );
}
